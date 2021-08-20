//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";

// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IOptionMarket.sol";
import "./interfaces/ILiquidityCertificate.sol";
import "./interfaces/IPoolHedger.sol";
import "./interfaces/IShortCollateral.sol";

/**
 * @title LiquidityPool
 * @author Lyra
 * @dev Holds funds from LPs, which are used for the following purposes:
 * 1. Collateralising options sold by the OptionMarket.
 * 2. Buying options from users.
 * 3. Delta hedging the LPs.
 * 4. Storing funds for expired in the money options.
 */
contract LiquidityPool is ILiquidityPool {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  ////
  // Constants
  ////
  ILyraGlobals internal globals;
  IOptionMarket internal optionMarket;
  ILiquidityCertificate internal liquidityCertificate;
  IShortCollateral internal shortCollateral;
  IPoolHedger internal poolHedger;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;
  uint internal constant INITIAL_RATE = 1e18;

  ////
  // Variables
  ////
  mapping(uint => string) internal errorMessages;

  bool internal initialized = false;

  /// @dev Amount of collateral locked for outstanding calls and puts sold to users
  Collateral public override lockedCollateral;
  /**
   * @dev Total amount of quoteAsset held to pay out users who have locked/waited for their tokens to be burnable. As
   * well as keeping track of all settled option's usd value.
   */
  uint internal totalQuoteAmountReserved;
  /// @dev Total number of tokens that will be removed from the totalTokenSupply at the end of the round.
  uint internal tokensBurnableForRound;
  /// @dev Funds entering the pool in the next round.
  uint public override queuedQuoteFunds;
  /// @dev Total amount of tokens that represents the total amount of pool shares
  uint internal totalTokenSupply;
  /// @dev Counter for reentrancy guard.
  uint internal counter = 1;

  /**
   * @dev Mapping of timestamps to conversion rates of liquidity to tokens. To get the token value of a certificate;
   * `certificate.liquidity / expiryToTokenValue[certificate.enteredAt]`
   */
  mapping(uint => uint) public override expiryToTokenValue;

  constructor() {}

  /**
   * @dev Initialize the contract.
   *
   * @param _optionMarket OptionMarket address
   * @param _liquidityCertificate LiquidityCertificate address
   * @param _quoteAsset Quote Asset address
   * @param _poolHedger PoolHedger address
   */
  function init(
    ILyraGlobals _globals,
    IOptionMarket _optionMarket,
    ILiquidityCertificate _liquidityCertificate,
    IPoolHedger _poolHedger,
    IShortCollateral _shortCollateral,
    IERC20 _quoteAsset,
    IERC20 _baseAsset,
    string[] memory _errorMessages
  ) external {
    require(!initialized, "already initialized");
    globals = _globals;
    optionMarket = _optionMarket;
    liquidityCertificate = _liquidityCertificate;
    shortCollateral = _shortCollateral;
    poolHedger = _poolHedger;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;
    require(_errorMessages.length == uint(Error.Last), "error msg count");
    for (uint i = 0; i < _errorMessages.length; i++) {
      errorMessages[i] = _errorMessages[i];
    }
    initialized = true;
  }

  ////////////////////////////////////////////////////////////////
  // Dealing with providing liquidity and withdrawing liquidity //
  ////////////////////////////////////////////////////////////////

  /**
   * @dev Deposits liquidity to the pool. This assumes users have authorised access to the quote ERC20 token. Will add
   * any deposited amount to the queuedQuoteFunds until the next round begins.
   *
   * @param beneficiary The account that will receive the liquidity certificate.
   * @param amount The amount of quoteAsset to deposit.
   */
  function deposit(address beneficiary, uint amount) external override returns (uint) {
    // Assume we have the allowance to take the amount they are depositing
    queuedQuoteFunds = queuedQuoteFunds.add(amount);
    uint certificateId = liquidityCertificate.mint(beneficiary, amount, optionMarket.maxExpiryTimestamp());
    emit Deposit(beneficiary, certificateId, amount);
    _require(quoteAsset.transferFrom(msg.sender, address(this), amount), Error.QuoteTransferFailed);
    return certificateId;
  }

  /**
   * @notice Signals withdraw of liquidity from the pool.
   * @dev It is not possible to withdraw during a round, thus a user can signal to withdraw at the time the round ends.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
  function signalWithdrawal(uint certificateId) external override {
    ILiquidityCertificate.CertificateData memory certificateData = liquidityCertificate.certificateData(certificateId);
    uint maxExpiryTimestamp = optionMarket.maxExpiryTimestamp();

    _require(certificateData.burnableAt == 0, Error.AlreadySignalledWithdrawal);
    _require(
      certificateData.enteredAt != maxExpiryTimestamp && expiryToTokenValue[certificateData.burnableAt] == 0,
      Error.SignallingBetweenRounds
    );

    if (certificateData.enteredAt == 0) {
      // Dividing by INITIAL_RATE is redundant as initial rate is 1 unit
      tokensBurnableForRound = tokensBurnableForRound.add(certificateData.liquidity);
    } else {
      tokensBurnableForRound = tokensBurnableForRound.add(
        certificateData.liquidity.divideDecimal(expiryToTokenValue[certificateData.enteredAt])
      );
    }

    liquidityCertificate.setBurnableAt(msg.sender, certificateId, maxExpiryTimestamp);

    emit WithdrawSignaled(certificateId, tokensBurnableForRound);
  }

  /**
   * @dev Undo a previously signalled withdraw. Certificate owner must have signalled withdraw to call this function,
   * and cannot unsignal if the token is already burnable or burnt.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
  function unSignalWithdrawal(uint certificateId) external override {
    ILiquidityCertificate.CertificateData memory certificateData = liquidityCertificate.certificateData(certificateId);

    // Cannot unsignal withdrawal if the token is burnable/hasn't signalled exit
    _require(certificateData.burnableAt != 0, Error.UnSignalMustSignalFirst);
    _require(expiryToTokenValue[certificateData.burnableAt] == 0, Error.UnSignalAlreadyBurnable);

    liquidityCertificate.setBurnableAt(msg.sender, certificateId, 0);

    if (certificateData.enteredAt == 0) {
      // Dividing by INITIAL_RATE is redundant as initial rate is 1 unit
      tokensBurnableForRound = tokensBurnableForRound.sub(certificateData.liquidity);
    } else {
      tokensBurnableForRound = tokensBurnableForRound.sub(
        certificateData.liquidity.divideDecimal(expiryToTokenValue[certificateData.enteredAt])
      );
    }

    emit WithdrawUnSignaled(certificateId, tokensBurnableForRound);
  }

  /**
   * @dev Withdraws liquidity from the pool.
   *
   * This requires tokens to have been locked until the round ending at the burnableAt timestamp has been ended.
   * This will burn the liquidityCertificates and have the quote asset equivalent at the time be reserved for the users.
   *
   * @param beneficiary The account that will receive the withdrawn funds.
   * @param certificateId The id of the LiquidityCertificate.
   */
  function withdraw(address beneficiary, uint certificateId) external override returns (uint value) {
    ILiquidityCertificate.CertificateData memory certificateData = liquidityCertificate.certificateData(certificateId);
    uint maxExpiryTimestamp = optionMarket.maxExpiryTimestamp();

    // We allow people to withdraw if their funds haven't entered the system
    if (certificateData.enteredAt == maxExpiryTimestamp) {
      queuedQuoteFunds = queuedQuoteFunds.sub(certificateData.liquidity);
      liquidityCertificate.burn(msg.sender, certificateId);
      emit Withdraw(beneficiary, certificateId, certificateData.liquidity, totalQuoteAmountReserved);
      _require(quoteAsset.transfer(beneficiary, certificateData.liquidity), Error.QuoteTransferFailed);
      return certificateData.liquidity;
    }

    uint enterValue = certificateData.enteredAt == 0 ? INITIAL_RATE : expiryToTokenValue[certificateData.enteredAt];

    // expiryToTokenValue will only be set if the previous round has ended, and the next has not started
    uint currentRoundValue = expiryToTokenValue[maxExpiryTimestamp];

    // If they haven't signaled withdrawal, and it is between rounds
    if (certificateData.burnableAt == 0 && currentRoundValue != 0) {
      uint tokenAmt = certificateData.liquidity.divideDecimal(enterValue);
      totalTokenSupply = totalTokenSupply.sub(tokenAmt);
      value = tokenAmt.multiplyDecimal(currentRoundValue);
      liquidityCertificate.burn(msg.sender, certificateId);
      emit Withdraw(beneficiary, certificateId, value, totalQuoteAmountReserved);
      _require(quoteAsset.transfer(beneficiary, value), Error.QuoteTransferFailed);
      return value;
    }

    uint exitValue = expiryToTokenValue[certificateData.burnableAt];

    _require(certificateData.burnableAt != 0 && exitValue != 0, Error.WithdrawNotBurnable);

    value = certificateData.liquidity.multiplyDecimal(exitValue).divideDecimal(enterValue);

    // We can allow a 0 expiry for options created before any boards exist
    liquidityCertificate.burn(msg.sender, certificateId);

    totalQuoteAmountReserved = totalQuoteAmountReserved.sub(value);
    emit Withdraw(beneficiary, certificateId, value, totalQuoteAmountReserved);
    _require(quoteAsset.transfer(beneficiary, value), Error.QuoteTransferFailed);
    return value;
  }

  //////////////////////////////////////////////
  // Dealing with locking and expiry rollover //
  //////////////////////////////////////////////

  /**
   * @dev Return Token value.
   *
   * This token price is only accurate within the period between rounds.
   */
  function tokenPriceQuote() public view override returns (uint) {
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.ALL);

    if (totalTokenSupply == 0) {
      return INITIAL_RATE;
    }

    uint poolValue =
      getTotalPoolValueQuote(
        exchangeGlobals.spotPrice,
        poolHedger.getValueQuote(exchangeGlobals.short, exchangeGlobals.spotPrice)
      );
    return poolValue.divideDecimal(totalTokenSupply);
  }

  /**
   * @notice Ends a round.
   * @dev Should only be called after all boards have been liquidated.
   */
  function endRound() external override {
    // Round can only be ended if all boards have been liquidated, and can only be called once.
    uint maxExpiryTimestamp = optionMarket.maxExpiryTimestamp();
    // We must ensure all boards have been expired
    _require(optionMarket.getLiveBoards().length == 0, Error.EndRoundWithLiveBoards);
    // We can only end the round once
    _require(expiryToTokenValue[maxExpiryTimestamp] == 0, Error.EndRoundAlreadyEnded);
    // We want to make sure all base collateral has been exchanged
    _require(baseAsset.balanceOf(address(this)) == 0, Error.EndRoundMustExchangeBase);
    // We want to make sure there is no outstanding poolHedger balance. If there is collateral left in the poolHedger
    // it will not affect calculations.
    _require(poolHedger.getCurrentHedgedNetDelta() == 0, Error.EndRoundMustHedgeDelta);

    uint pricePerToken = tokenPriceQuote();

    // Store the value for the tokens that are burnable for this round
    expiryToTokenValue[maxExpiryTimestamp] = pricePerToken;

    // Reserve the amount of quote we need for the tokens that are burnable
    totalQuoteAmountReserved = totalQuoteAmountReserved.add(tokensBurnableForRound.multiplyDecimal(pricePerToken));
    emit QuoteReserved(tokensBurnableForRound.multiplyDecimal(pricePerToken), totalQuoteAmountReserved);

    totalTokenSupply = totalTokenSupply.sub(tokensBurnableForRound);
    tokensBurnableForRound = 0;

    emit RoundEnded(maxExpiryTimestamp, pricePerToken, totalQuoteAmountReserved, totalTokenSupply);
  }

  /**
   * @dev Starts a round. Can only be called by optionMarket contract when adding a board.
   *
   * @param lastMaxExpiryTimestamp The time at which the previous round ended.
   * @param newMaxExpiryTimestamp The time which funds will be locked until.
   */
  function startRound(uint lastMaxExpiryTimestamp, uint newMaxExpiryTimestamp) external override onlyOptionMarket {
    // As the value is never reset, this is when the first board is added
    if (lastMaxExpiryTimestamp == 0) {
      totalTokenSupply = queuedQuoteFunds;
    } else {
      _require(expiryToTokenValue[lastMaxExpiryTimestamp] != 0, Error.StartRoundMustEndRound);
      totalTokenSupply = totalTokenSupply.add(
        queuedQuoteFunds.divideDecimal(expiryToTokenValue[lastMaxExpiryTimestamp])
      );
    }
    queuedQuoteFunds = 0;

    emit RoundStarted(
      lastMaxExpiryTimestamp,
      newMaxExpiryTimestamp,
      totalTokenSupply,
      totalTokenSupply.multiplyDecimalRound(expiryToTokenValue[lastMaxExpiryTimestamp])
    );
  }

  /////////////////////////////////////////
  // Dealing with collateral for options //
  /////////////////////////////////////////

  /**
   * @dev external override function that will bring the base balance of this contract to match locked.base. This cannot be done
   * in the same transaction as locking the base, as exchanging on synthetix is too costly gas-wise.
   */
  function exchangeBase() external override reentrancyGuard {
    uint currentBaseBalance = baseAsset.balanceOf(address(this));

    // Add this additional check to prevent any soft locks at round end, as the base balance must be 0 to end the round.
    if (optionMarket.getLiveBoards().length == 0) {
      lockedCollateral.base = 0;
    }

    if (currentBaseBalance > lockedCollateral.base) {
      // Sell excess baseAsset
      ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
        globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.BASE_QUOTE);
      uint amount = currentBaseBalance - lockedCollateral.base;
      uint quoteReceived =
        exchangeGlobals.synthetix.exchange(exchangeGlobals.baseKey, amount, exchangeGlobals.quoteKey);
      _require(quoteReceived > 0, Error.ReceivedZeroFromBaseQuoteExchange);
      emit BaseSold(msg.sender, amount, quoteReceived);
    } else if (lockedCollateral.base > currentBaseBalance) {
      // Buy required amount of baseAsset
      ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
        globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.QUOTE_BASE);
      uint quoteToSpend =
        (lockedCollateral.base - currentBaseBalance)
          .divideDecimalRound(SafeDecimalMath.UNIT.sub(exchangeGlobals.quoteBaseFeeRate))
          .multiplyDecimalRound(exchangeGlobals.spotPrice);
      uint totalQuoteAvailable =
        quoteAsset.balanceOf(address(this)).sub(totalQuoteAmountReserved).sub(lockedCollateral.quote).sub(
          queuedQuoteFunds
        );
      // We want to always buy as much collateral as we can, even if it dips into the delta hedging portion.
      // But we cannot compromise funds that aren't useable by the pool.
      quoteToSpend = quoteToSpend > totalQuoteAvailable ? totalQuoteAvailable : quoteToSpend;
      uint amtReceived =
        exchangeGlobals.synthetix.exchange(exchangeGlobals.quoteKey, quoteToSpend, exchangeGlobals.baseKey);
      _require(amtReceived > 0, Error.ReceivedZeroFromQuoteBaseExchange);
      emit BasePurchased(msg.sender, quoteToSpend, amtReceived);
    }
  }

  /**
   * @notice Locks quote when the system sells a put option.
   *
   * @param amount The amount of quote to lock.
   * @param freeCollatLiq The amount of free collateral that can be locked.
   */
  function lockQuote(uint amount, uint freeCollatLiq) external override onlyOptionMarket {
    _require(amount <= freeCollatLiq, Error.LockingMoreQuoteThanIsFree);
    lockedCollateral.quote = lockedCollateral.quote.add(amount);
    emit QuoteLocked(amount, lockedCollateral.quote);
  }

  /**
   * @notice Purchases and locks base when the system sells a call option.
   *
   * @param amount The amount of baseAsset to purchase and lock.
   * @param exchangeGlobals The exchangeGlobals.
   * @param liquidity Free and used liquidity amounts.
   */
  function lockBase(
    uint amount,
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals,
    Liquidity memory liquidity
  ) external override onlyOptionMarket {
    uint currentBaseBal = baseAsset.balanceOf(address(this));

    uint desiredBase;
    uint availableQuote = liquidity.freeCollatLiquidity;

    if (lockedCollateral.base >= currentBaseBal) {
      uint outstanding = lockedCollateral.base - currentBaseBal;
      // We need to ignore any base we haven't purchased yet from our availableQuote
      availableQuote = availableQuote.add(outstanding.multiplyDecimal(exchangeGlobals.spotPrice));
      // But we want to make sure we will have enough quote to cover the debt owed on top of new base we want to lock
      desiredBase = amount.add(outstanding);
    } else {
      // We actually need to buy less, or none, if we already have excess balance
      uint excess = currentBaseBal - lockedCollateral.base;
      if (excess >= amount) {
        desiredBase = 0;
      } else {
        desiredBase = amount.sub(excess);
      }
    }
    uint quoteToSpend =
      desiredBase.divideDecimalRound(SafeDecimalMath.UNIT.sub(exchangeGlobals.quoteBaseFeeRate)).multiplyDecimalRound(
        exchangeGlobals.spotPrice
      );

    _require(availableQuote >= quoteToSpend, Error.LockingMoreBaseThanCanBeExchanged);

    lockedCollateral.base = lockedCollateral.base.add(amount);
    emit BaseLocked(amount, lockedCollateral.base);
  }

  /**
   * @notice Frees quote when the system buys back a put from the user.
   *
   * @param amount The amount of quote to free.
   */
  function freeQuoteCollateral(uint amount) external override onlyOptionMarket {
    _freeQuoteCollateral(amount);
  }

  /**
   * @notice Frees quote when the system buys back a put from the user.
   *
   * @param amount The amount of quote to free.
   */
  function _freeQuoteCollateral(uint amount) internal {
    // Handle rounding errors by returning the full amount when the requested amount is greater
    if (amount > lockedCollateral.quote) {
      amount = lockedCollateral.quote;
    }
    lockedCollateral.quote = lockedCollateral.quote.sub(amount);
    emit QuoteFreed(amount, lockedCollateral.quote);
  }

  /**
   * @notice Sells base and frees the proceeds of the sale.
   *
   * @param amountBase The amount of base to sell.
   */
  function freeBase(uint amountBase) external override onlyOptionMarket {
    _require(amountBase <= lockedCollateral.base, Error.FreeingMoreBaseThanLocked);
    lockedCollateral.base = lockedCollateral.base.sub(amountBase);
    emit BaseFreed(amountBase, lockedCollateral.base);
  }

  /**
   * @notice Sends the premium to a user who is selling an option to the pool.
   * @dev The caller must be the OptionMarket.
   *
   * @param recipient The address of the recipient.
   * @param amount The amount to transfer.
   * @param freeCollatLiq The amount of free collateral liquidity.
   */
  function sendPremium(
    address recipient,
    uint amount,
    uint freeCollatLiq
  ) external override onlyOptionMarket reentrancyGuard {
    _require(freeCollatLiq >= amount, Error.SendPremiumNotEnoughCollateral);
    _require(quoteAsset.transfer(recipient, amount), Error.QuoteTransferFailed);

    emit CollateralQuoteTransferred(recipient, amount);
  }

  //////////////////////////////////////////
  // Dealing with expired option premiums //
  //////////////////////////////////////////

  /**
   * @notice Manages collateral at the time of board liquidation, also converting base sent here from the OptionMarket.
   *
   * @param amountQuoteFreed Total amount of base to convert to quote, including profits from short calls.
   * @param amountQuoteReserved Total amount of base to convert to quote, including profits from short calls.
   * @param amountBaseFreed Total amount of collateral to liquidate.
   */
  function boardLiquidation(
    uint amountQuoteFreed,
    uint amountQuoteReserved,
    uint amountBaseFreed
  ) external override onlyOptionMarket {
    _freeQuoteCollateral(amountQuoteFreed);

    totalQuoteAmountReserved = totalQuoteAmountReserved.add(amountQuoteReserved);
    emit QuoteReserved(amountQuoteReserved, totalQuoteAmountReserved);

    lockedCollateral.base = lockedCollateral.base.sub(amountBaseFreed);
    emit BaseFreed(amountBaseFreed, lockedCollateral.base);
  }

  /**
   * @dev Transfers reserved quote. Sends `amount` of reserved quoteAsset to `user`.
   *
   * Requirements:
   *
   * - the caller must be `OptionMarket`.
   *
   * @param user The address of the user to send the quote.
   * @param amount The amount of quote to send.
   */
  function sendReservedQuote(address user, uint amount) external override onlyShortCollateral reentrancyGuard {
    // Should never happen, but added to prevent any potential rounding errors
    if (amount > totalQuoteAmountReserved) {
      amount = totalQuoteAmountReserved;
    }
    totalQuoteAmountReserved = totalQuoteAmountReserved.sub(amount);
    _require(quoteAsset.transfer(user, amount), Error.QuoteTransferFailed);

    emit ReservedQuoteSent(user, amount, totalQuoteAmountReserved);
  }

  ////////////////////////////
  // Getting Pool Liquidity //
  ////////////////////////////

  /**
   * @notice Returns the total pool value in quoteAsset.
   *
   * @param basePrice The price of the baseAsset.
   * @param usedDeltaLiquidity The amout of delta liquidity that has been used for hedging.
   */
  function getTotalPoolValueQuote(uint basePrice, uint usedDeltaLiquidity) public view override returns (uint) {
    return
      quoteAsset
        .balanceOf(address(this))
        .add(baseAsset.balanceOf(address(this)).multiplyDecimal(basePrice))
        .add(usedDeltaLiquidity)
        .sub(totalQuoteAmountReserved)
        .sub(queuedQuoteFunds);
  }

  /**
   * @notice Returns the used and free amounts for collateral and delta liquidity.
   *
   * @param basePrice The price of the base asset.
   * @param short The address of the short contract.
   */
  function getLiquidity(uint basePrice, ICollateralShort short) public view override returns (Liquidity memory) {
    Liquidity memory liquidity;

    liquidity.usedDeltaLiquidity = poolHedger.getValueQuote(short, basePrice);
    liquidity.usedCollatLiquidity = lockedCollateral.quote.add(lockedCollateral.base.multiplyDecimal(basePrice));

    uint totalLiquidity = getTotalPoolValueQuote(basePrice, liquidity.usedDeltaLiquidity);

    uint collatPortion = (totalLiquidity * 2) / 3;
    uint deltaPortion = totalLiquidity.sub(collatPortion);

    if (liquidity.usedCollatLiquidity > collatPortion) {
      collatPortion = liquidity.usedCollatLiquidity;
      deltaPortion = totalLiquidity.sub(collatPortion);
    } else if (liquidity.usedDeltaLiquidity > deltaPortion) {
      deltaPortion = liquidity.usedDeltaLiquidity;
      collatPortion = totalLiquidity.sub(deltaPortion);
    }

    liquidity.freeDeltaLiquidity = deltaPortion.sub(liquidity.usedDeltaLiquidity);
    liquidity.freeCollatLiquidity = collatPortion.sub(liquidity.usedCollatLiquidity);

    return liquidity;
  }

  //////////
  // Misc //
  //////////

  /**
   * @notice Sends quoteAsset to the PoolHedger.
   * @dev This function will transfer whatever free delta liquidity is available.
   * The hedger must determine what to do with the amount received.
   *
   * @param exchangeGlobals The exchangeGlobals.
   * @param amount The amount requested by the PoolHedger.
   */
  function transferQuoteToHedge(ILyraGlobals.ExchangeGlobals memory exchangeGlobals, uint amount)
    external
    override
    onlyPoolHedger
    reentrancyGuard
    returns (uint)
  {
    Liquidity memory liquidity = getLiquidity(exchangeGlobals.spotPrice, exchangeGlobals.short);

    uint available = liquidity.freeDeltaLiquidity;
    if (available < amount) {
      amount = available;
    }
    _require(quoteAsset.transfer(address(poolHedger), amount), Error.QuoteTransferFailed);

    emit DeltaQuoteTransferredToPoolHedger(amount);

    return amount;
  }

  function _require(bool pass, Error error) internal view {
    require(pass, errorMessages[uint(error)]);
  }

  ///////////////
  // Modifiers //
  ///////////////

  modifier onlyPoolHedger virtual {
    _require(msg.sender == address(poolHedger), Error.OnlyPoolHedger);
    _;
  }

  modifier onlyOptionMarket virtual {
    _require(msg.sender == address(optionMarket), Error.OnlyOptionMarket);
    _;
  }

  modifier onlyShortCollateral virtual {
    _require(msg.sender == address(shortCollateral), Error.OnlyShortCollateral);
    _;
  }

  modifier reentrancyGuard virtual {
    counter = counter.add(1); // counter adds 1 to the existing 1 so becomes 2
    uint guard = counter; // assigns 2 to the "guard" variable
    _;
    _require(guard == counter, Error.ReentrancyDetected);
  }

  /**
   * @dev Emitted when liquidity is deposited.
   */
  event Deposit(address indexed beneficiary, uint indexed certificateId, uint amount);
  /**
   * @dev Emitted when withdrawal is signaled.
   */
  event WithdrawSignaled(uint indexed certificateId, uint tokensBurnableForRound);
  /**
   * @dev Emitted when a withdrawal is unsignaled.
   */
  event WithdrawUnSignaled(uint indexed certificateId, uint tokensBurnableForRound);
  /**
   * @dev Emitted when liquidity is withdrawn.
   */
  event Withdraw(address indexed beneficiary, uint indexed certificateId, uint value, uint totalQuoteAmountReserved);
  /**
   * @dev Emitted when a round ends.
   */
  event RoundEnded(
    uint indexed maxExpiryTimestamp,
    uint pricePerToken,
    uint totalQuoteAmountReserved,
    uint totalTokenSupply
  );
  /**
   * @dev Emitted when a round starts.
   */
  event RoundStarted(
    uint indexed lastMaxExpiryTimestmp,
    uint indexed newMaxExpiryTimestmp,
    uint totalTokenSupply,
    uint totalPoolValueQuote
  );
  /**
   * @dev Emitted when quote is locked.
   */
  event QuoteLocked(uint quoteLocked, uint lockedCollateralQuote);
  /**
   * @dev Emitted when base is locked.
   */
  event BaseLocked(uint baseLocked, uint lockedCollateralBase);
  /**
   * @dev Emitted when quote is freed.
   */
  event QuoteFreed(uint quoteFreed, uint lockedCollateralQuote);
  /**
   * @dev Emitted when base is freed.
   */
  event BaseFreed(uint baseFreed, uint lockedCollateralBase);
  /**
   * @dev Emitted when base is purchased.
   */
  event BasePurchased(address indexed caller, uint quoteSpent, uint amountPurchased);
  /**
   * @dev Emitted when base is sold.
   */
  event BaseSold(address indexed caller, uint amountSold, uint quoteReceived);
  /**
   * @dev Emitted when collateral is liquidated. This combines LP profit from short calls and freeing base collateral
   */
  event CollateralLiquidated(
    uint totalAmountToLiquidate,
    uint baseFreed,
    uint quoteReceived,
    uint lockedCollateralBase
  );
  /**
   * @dev Emitted when quote is reserved.
   */
  event QuoteReserved(uint amountQuoteReserved, uint totalQuoteAmountReserved);
  /**
   * @dev Emitted when reserved quote is sent.
   */
  event ReservedQuoteSent(address indexed user, uint amount, uint totalQuoteAmountReserved);
  /**
   * @dev Emitted when collatQuote is transferred.
   */
  event CollateralQuoteTransferred(address indexed recipient, uint amount);
  /**
   * @dev Emitted when quote is transferred to hedge.
   */
  event DeltaQuoteTransferredToPoolHedger(uint amount);
}
