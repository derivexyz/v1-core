//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";
// Inherited
// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPoolHedger.sol";
import "./interfaces/ILyraGlobals.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IOptionMarket.sol";
import "./interfaces/IShortCollateral.sol";

/**
 * @title ShortCollateral
 * @author Lyra
 * @dev Holds collateral from users who are selling (shorting) options to the OptionMarket.
 */
contract ShortCollateral is IShortCollateral {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  bool internal initialized = false;

  IOptionMarket internal optionMarket;
  ILiquidityPool internal liquidityPool;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;

  constructor() {}

  /**
   * @dev Initialize the contract.
   *
   * @param _optionMarket OptionMarket address
   * @param _liquidityPool LiquidityPool address
   * @param _quoteAsset Quote asset address
   * @param _baseAsset Base asset address
   */
  function init(
    IOptionMarket _optionMarket,
    ILiquidityPool _liquidityPool,
    IERC20 _quoteAsset,
    IERC20 _baseAsset
  ) external {
    require(!initialized, "contract already initialized");
    optionMarket = _optionMarket;
    liquidityPool = _liquidityPool;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;
    initialized = true;
  }

  /**
   * @dev Transfers quoteAsset to the recipient.
   *
   * @param recipient The recipient of the transfer.
   * @param amount The amount to send.
   */
  function sendQuoteCollateral(address recipient, uint amount) external override onlyOptionMarket {
    uint currentBalance = quoteAsset.balanceOf(address(this));
    if (amount > currentBalance) {
      amount = currentBalance;
    }
    require(quoteAsset.transfer(recipient, amount), "transfer failed");
    emit QuoteSent(recipient, amount);
  }

  /**
   * @dev Transfers baseAsset to the recipient.
   *
   * @param recipient The recipient of the transfer.
   * @param amount The amount to send.
   */
  function sendBaseCollateral(address recipient, uint amount) external override onlyOptionMarket {
    uint currentBalance = baseAsset.balanceOf(address(this));
    if (amount > currentBalance) {
      amount = currentBalance;
    }
    require(baseAsset.transfer(recipient, amount), "transfer failed");
    emit BaseSent(recipient, amount);
  }

  /**
   * @dev Transfers quoteAsset and baseAsset to the LiquidityPool.
   *
   * @param amountBase The amount of baseAsset to transfer.
   * @param amountQuote The amount of quoteAsset to transfer.
   */
  function sendToLP(uint amountBase, uint amountQuote) external override onlyOptionMarket {
    uint currentBaseBalance = baseAsset.balanceOf(address(this));
    if (amountBase > currentBaseBalance) {
      amountBase = currentBaseBalance;
    }
    if (amountBase > 0) {
      require(baseAsset.transfer(address(liquidityPool), amountBase), "base transfer failed");
      emit BaseSent(address(liquidityPool), amountBase);
    }

    uint currentQuoteBalance = quoteAsset.balanceOf(address(this));
    if (amountQuote > currentQuoteBalance) {
      amountQuote = currentQuoteBalance;
    }
    if (amountQuote > 0) {
      require(quoteAsset.transfer(address(liquidityPool), amountQuote), "quote transfer failed");
      emit QuoteSent(address(liquidityPool), amountQuote);
    }
  }

  /**
   * @dev Called by the OptionMarket when the owner of an option settles.
   *
   * @param listingId The OptionListing.
   * @param receiver The address of the receiver.
   * @param tradeType The TradeType.
   * @param amount The amount to settle.
   * @param strike The strike price of the OptionListing.
   * @param priceAtExpiry The price of baseAsset at expiry.
   * @param listingToShortCallBaseReturned The amount of baseAsset to be returned.
   */
  function processSettle(
    uint listingId,
    address receiver,
    IOptionMarket.TradeType tradeType,
    uint amount,
    uint strike,
    uint priceAtExpiry,
    uint listingToShortCallBaseReturned
  ) external override onlyOptionMarket {
    // Check board has been liquidated
    require(priceAtExpiry != 0, "board must be liquidated");
    require(amount > 0, "option position is 0");

    if (tradeType == IOptionMarket.TradeType.SHORT_CALL) {
      require(
        baseAsset.transfer(receiver, listingToShortCallBaseReturned.multiplyDecimal(amount)),
        "base transfer failed"
      );
    } else if (tradeType == IOptionMarket.TradeType.LONG_CALL && strike < priceAtExpiry) {
      // long call finished in the money
      liquidityPool.sendReservedQuote(receiver, (priceAtExpiry - strike).multiplyDecimal(amount));
    } else if (tradeType == IOptionMarket.TradeType.SHORT_PUT) {
      // If the listing finished in the money;
      // = we pay out the priceAtExpiry (strike - (strike - priceAtExpiry) == priceAtExpiry)
      // Otherwise pay back the strike...
      uint balance = quoteAsset.balanceOf(address(this));
      uint owed = amount.multiplyDecimal((strike > priceAtExpiry) ? priceAtExpiry : strike);
      require(
        quoteAsset.transfer(
          receiver,
          // Return the full balance if owed > balance due to rounding errors
          owed > balance ? balance : owed
        ),
        "quote transfer failed"
      );
    } else if (tradeType == IOptionMarket.TradeType.LONG_PUT && strike > priceAtExpiry) {
      // user was long put and it finished in the money
      liquidityPool.sendReservedQuote(receiver, (strike - priceAtExpiry).multiplyDecimal(amount));
    }

    emit OptionsSettled(listingId, receiver, strike, priceAtExpiry, tradeType, amount);
  }

  // Modifiers

  modifier onlyOptionMarket virtual {
    require(msg.sender == address(optionMarket), "only OptionMarket");
    _;
  }

  // Events

  /**
   * @dev Emitted when an Option is settled.
   */
  event OptionsSettled(
    uint indexed listingId,
    address indexed optionOwner,
    uint strike,
    uint priceAtExpiry,
    IOptionMarket.TradeType tradeType,
    uint amount
  );

  /**
   * @dev Emitted when quote is sent to either a user or the LiquidityPool
   */
  event QuoteSent(address indexed receiver, uint amount);
  /**
   * @dev Emitted when base is sent to either a user or the LiquidityPool
   */
  event BaseSent(address indexed receiver, uint amount);
}
