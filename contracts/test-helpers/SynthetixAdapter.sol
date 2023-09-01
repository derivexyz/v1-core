//SPDX-License-Identifier: ISC

//
//  ___    _____     _   _  _____  _____     ___    ___    _   _  _  ___    _       _
// (  _`\ (  _  )   ( ) ( )(  _  )(_   _)   |  _`\ (  _`\ ( ) ( )(_)(  _`\ ( )  _  ( )
// | | ) || ( ) |   | `\| || ( ) |  | |     | (_) )| (_(_)| | | || || (_(_)| | ( ) | |
// | | | )| | | |   | , ` || | | |  | |     | ,  / |  _)_ | | | || ||  _)_ | | | | | |
// | |_) || (_) |   | |`\ || (_) |  | |     | |\ \ | (_( )| \_/ || || (_( )| (_/ \_) |
// (____/'(_____)   (_) (_)(_____)  (_)     (_) (_)(____/'`\___/'(_)(____/'`\___x___/'
//

pragma solidity 0.8.16;

// Libraries
import "../synthetix/DecimalMath.sol";
import "../libraries/ConvertDecimals.sol";

// Inherited
import "../BaseExchangeAdapter.sol";

// Interfaces
import "../interfaces/ISynthetix.sol";
import "../interfaces/IAddressResolver.sol";
import "../interfaces/IExchanger.sol";
import "../interfaces/IExchangeRates.sol";
import "../interfaces/IDelegateApprovals.sol";
import "../interfaces/IERC20Decimals.sol";
import "../OptionMarket.sol";

/**
 * @title SynthetixAdapter
 * @author Lyra
 * @dev Manages access to exchange functions on Synthetix.
 * The OptionMarket contract address is used as the key to access the relevant exchange parameters for the market.
 */
contract SynthetixAdapter is BaseExchangeAdapter {
  using DecimalMath for uint;

  /**
   * @dev Structs to help reduce the number of calls between other contracts and this one
   * Grouped in usage for a particular contract/use case
   */
  struct ExchangeParams {
    // snx oracle exchange rate for base
    uint spotPrice;
    // snx quote asset identifier key
    bytes32 quoteKey;
    // snx base asset identifier key
    bytes32 baseKey;
    // snx spot exchange rate from quote to base
    uint quoteBaseFeeRate;
    // snx spot exchange rate from base to quote
    uint baseQuoteFeeRate;
  }

  IAddressResolver public addressResolver;

  bytes32 private constant CONTRACT_SYNTHETIX = "ProxySynthetix";
  bytes32 private constant CONTRACT_EXCHANGER = "Exchanger";
  bytes32 private constant CONTRACT_EXCHANGE_RATES = "ExchangeRates";
  bytes32 private constant CONTRACT_DELEGATE_APPROVALS = "DelegateApprovals";

  // Cached addresses that can be updated via a public function
  ISynthetix public synthetix;
  IExchanger public exchanger;
  IExchangeRates public exchangeRates;
  IDelegateApprovals public delegateApprovals;

  // Variables related to calculating premium/fees
  mapping(address => bytes32) public quoteKey;
  mapping(address => bytes32) public baseKey;
  mapping(address => address) public rewardAddress;
  mapping(address => bytes32) public trackingCode;

  /// @dev risk free interest rate
  mapping(address => int256) public override rateAndCarry;

  /////////////
  // Setters //
  /////////////

  /**
   * @dev Set the address of the Synthetix address resolver.
   *
   * @param _addressResolver The address of Synthetix's AddressResolver.
   */
  function setAddressResolver(IAddressResolver _addressResolver) external onlyOwner {
    addressResolver = _addressResolver;
    updateSynthetixAddresses();
    emit AddressResolverSet(addressResolver);
  }

  /**
   * @dev Set the synthetixAdapter for a specific OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _quoteKey The key of the quoteAsset.
   * @param _baseKey The key of the baseAsset.
   */
  function setGlobalsForContract(
    address _contractAddress,
    bytes32 _quoteKey,
    bytes32 _baseKey,
    address _rewardAddress,
    bytes32 _trackingCode
  ) external onlyOwner {
    if (_rewardAddress == address(0)) {
      revert InvalidAddress(address(this), _rewardAddress);
    }
    quoteKey[_contractAddress] = _quoteKey;
    baseKey[_contractAddress] = _baseKey;
    rewardAddress[_contractAddress] = _rewardAddress;
    trackingCode[_contractAddress] = _trackingCode;
    emit GlobalsSetForContract(_contractAddress, _quoteKey, _baseKey, _rewardAddress, _trackingCode);
  }

  /**
   * @notice update risk free rate by owner
   * @param _rate risk free rate with 18 decimals
   */
  function setRiskFreeRate(address _optionMarket, int _rate) external onlyOwner {
    if (_rate > 50e18 || _rate < -50e18) revert InvalidRiskFreeRate();
    rateAndCarry[_optionMarket] = _rate;

    emit RiskFreeRateUpdated(_rate);
  }

  //////////////////////
  // Address Resolver //
  //////////////////////

  /**
   * @dev Public function to update synthetix addresses Lyra uses. The addresses are cached this way for gas efficiency.
   */
  function updateSynthetixAddresses() public {
    synthetix = ISynthetix(addressResolver.getAddress(CONTRACT_SYNTHETIX));
    exchanger = IExchanger(addressResolver.getAddress(CONTRACT_EXCHANGER));
    exchangeRates = IExchangeRates(addressResolver.getAddress(CONTRACT_EXCHANGE_RATES));
    delegateApprovals = IDelegateApprovals(addressResolver.getAddress(CONTRACT_DELEGATE_APPROVALS));

    emit SynthetixAddressesUpdated(synthetix, exchanger, exchangeRates, delegateApprovals);
  }

  /////////////
  // Getters //
  /////////////
  /**
   * @notice Returns the price of the baseAsset.
   *
   * @param _contractAddress The address of the OptionMarket.
   */
  function getSpotPriceForMarket(
    address _contractAddress,
    BaseExchangeAdapter.PriceType
  ) external view override notPaused(_contractAddress) returns (uint spotPrice) {
    return getSpotPrice(baseKey[_contractAddress]);
  }

  /**
   * @notice Returns the price of the baseAsset used for settlement.
   *
   * @param _contractAddress The address of the OptionMarket.
   */
  function getSettlementPriceForMarket(
    address _contractAddress,
    uint
  ) external view override notPaused(_contractAddress) returns (uint spotPrice) {
    return getSpotPrice(baseKey[_contractAddress]);
  }

  /**
   * @notice Gets spot price of an asset.
   * @dev All rates are denominated in terms of sUSD,
   * so the price of sUSD is always $1.00, and is never stale.
   *
   * @param to The key of the synthetic asset.
   */
  function getSpotPrice(bytes32 to) public view returns (uint) {
    (uint spotPrice, bool invalid) = exchangeRates.rateAndInvalid(to);
    if (spotPrice == 0 || invalid) {
      revert RateIsInvalid(address(this), spotPrice, invalid);
    }
    return spotPrice;
  }

  /**
   * @notice Returns the ExchangeParams.
   *
   * @param optionMarket The address of the OptionMarket.
   */
  function getExchangeParams(
    address optionMarket
  ) public view notPaused(optionMarket) returns (ExchangeParams memory exchangeParams) {
    exchangeParams = ExchangeParams({
      spotPrice: 0,
      quoteKey: quoteKey[optionMarket],
      baseKey: baseKey[optionMarket],
      quoteBaseFeeRate: 0,
      baseQuoteFeeRate: 0
    });

    exchangeParams.spotPrice = getSpotPrice(exchangeParams.baseKey);
    exchangeParams.quoteBaseFeeRate = exchanger.feeRateForExchange(exchangeParams.quoteKey, exchangeParams.baseKey);
    exchangeParams.baseQuoteFeeRate = exchanger.feeRateForExchange(exchangeParams.baseKey, exchangeParams.quoteKey);
  }

  /////////////////////////////////////////
  // Exchanging QuoteAsset for BaseAsset //
  /////////////////////////////////////////

  /**
   * @notice Swap an exact amount of quote for base.
   *
   * @param optionMarket The base asset of this option market to receive
   * @param amountQuote The exact amount of quote to be used for the swap
   * @return baseReceived The amount of base received from the swap
   */
  function exchangeFromExactQuote(
    address optionMarket,
    uint amountQuote
  ) external override returns (uint baseReceived) {
    return _exchangeQuoteForBase(optionMarket, amountQuote);
  }

  /**
   * @notice Swap quote for an exact amount of base.
   *
   * @param optionMarket The base asset of this option market to receive
   * @param amountBase The exact amount of base to receive from the swap
   * @return quoteSpent The amount of quote spent on the swap
   * @return baseReceived The amount of base received
   */
  function exchangeToExactBase(
    address optionMarket,
    uint amountBase
  ) external override returns (uint quoteSpent, uint baseReceived) {
    return _exchangeToExactBaseWithLimit(optionMarket, amountBase, type(uint).max);
  }

  /**
   * @notice Swap quote for base with a limit on the amount of quote to be spent.
   *
   * @param optionMarket The base asset of this option market to receive
   * @param amountBase The exact amount of base to receive from the swap
   * @param quoteLimit The maximum amount of quote to spend for base
   * @return quoteSpent The amount of quote spent on the swap
   * @return baseReceived The amount of baes received from the swap
   */
  function exchangeToExactBaseWithLimit(
    address optionMarket,
    uint amountBase,
    uint quoteLimit
  ) external override returns (uint quoteSpent, uint baseReceived) {
    return _exchangeToExactBaseWithLimit(optionMarket, amountBase, quoteLimit);
  }

  function _exchangeToExactBaseWithLimit(
    address optionMarket,
    uint amountBase,
    uint quoteLimit
  ) internal returns (uint quoteSpent, uint baseReceived) {
    ExchangeParams memory exchangeParams = getExchangeParams(optionMarket);
    uint quoteToSpend = _estimateExchangeToExactBase(optionMarket, amountBase);
    if (quoteToSpend > quoteLimit) {
      revert QuoteBaseExchangeExceedsLimit(
        address(this),
        amountBase,
        quoteToSpend,
        quoteLimit,
        exchangeParams.spotPrice,
        exchangeParams.quoteKey,
        exchangeParams.baseKey
      );
    }

    return (quoteToSpend, _exchangeQuoteForBase(optionMarket, quoteToSpend));
  }

  function _exchangeQuoteForBase(address optionMarket, uint amountQuote) internal returns (uint baseReceived) {
    IERC20Decimals quoteAsset = IERC20Decimals(OptionMarket(optionMarket).quoteAsset());
    IERC20Decimals baseAsset = IERC20Decimals(OptionMarket(optionMarket).baseAsset());

    uint scaledAmtQuote = _receiveAsset(quoteAsset, amountQuote);

    if (amountQuote == 0) {
      return 0;
    }
    baseReceived = synthetix.exchangeOnBehalfWithTracking(
      address(this),
      quoteKey[optionMarket],
      scaledAmtQuote,
      baseKey[optionMarket],
      rewardAddress[optionMarket],
      trackingCode[optionMarket]
    );
    if (amountQuote > 1e10 && baseReceived == 0) {
      revert ReceivedZeroFromExchange(
        address(this),
        quoteKey[optionMarket],
        baseKey[optionMarket],
        amountQuote,
        baseReceived
      );
    }

    quoteAsset.transfer(msg.sender, quoteAsset.balanceOf(address(this)));
    if (!baseAsset.transfer(msg.sender, baseAsset.balanceOf(address(this)))) {
      revert TransferFailed(
        address(this),
        OptionMarket(optionMarket).baseAsset(),
        address(this),
        msg.sender,
        baseReceived
      );
    }

    emit QuoteSwappedForBase(optionMarket, msg.sender, scaledAmtQuote, baseReceived);
    return baseReceived;
  }

  /**
   * @notice Returns an estimated amount of quote required to swap for the specified amount of base.
   *
   * @param _optionMarket The option market address
   * @param _amountBase The amount of base to receive
   * @return quoteNeeded The amount of quote required to received the amount of base requested
   */
  function estimateExchangeToExactBase(
    address _optionMarket,
    uint _amountBase
  ) external view override returns (uint quoteNeeded) {
    return _estimateExchangeToExactBase(_optionMarket, _amountBase);
  }

  /**
   * @notice Returns an estimated amount of quote required to swap for the specified amount of base.
   *
   * @param _optionMarket The option market address
   * @param _amountBase The amount of base to receive
   * @return quoteNeeded The amount of quote required to received the amount of base requested
   */
  function _estimateExchangeToExactBase(
    address _optionMarket,
    uint _amountBase
  ) internal view returns (uint quoteNeeded) {
    ExchangeParams memory exchangeParams = getExchangeParams(_optionMarket);
    return
      _amountBase.divideDecimalRound(DecimalMath.UNIT - exchangeParams.quoteBaseFeeRate).multiplyDecimalRound(
        exchangeParams.spotPrice
      );
  }

  /////////////////////////////////////////
  // Exchanging BaseAsset for QuoteAsset //
  /////////////////////////////////////////

  /**
   * @notice Swap an exact amount of base for quote.
   *
   * @param optionMarket The base asset of this optionMarket to be used
   * @param amountBase The exact amount of base to be used for the swap
   * @return quoteReceived The amount of quote received from the swap
   */
  function exchangeFromExactBase(address optionMarket, uint amountBase) external override returns (uint quoteReceived) {
    return _exchangeBaseForQuote(optionMarket, amountBase);
  }

  /**
   * @notice Swap base for an exact amount of quote
   *
   * @param optionMarket The base asset of this optionMarket to be used
   * @param amountQuote The exact amount of quote to receive
   * @return baseSpent The amount of baseSpent on the swap
   * @return quoteReceived The amount of quote received from the swap
   */
  function exchangeToExactQuote(
    address optionMarket,
    uint amountQuote
  ) external override returns (uint baseSpent, uint quoteReceived) {
    return _exchangeToExactQuoteWithLimit(optionMarket, amountQuote, type(uint).max);
  }

  /**
   * @notice Swap base for an exact amount of quote with a limit on the amount of base to be used
   *
   * @param optionMarket The base asset of this optionMarket to be used
   * @param amountQuote The exact amount of quote to receive
   * @param baseLimit The limit on the amount of base to be used
   * @return baseSpent The amount of base spent on the swap
   * @return quoteReceived The amount of quote received from the swap
   */
  function exchangeToExactQuoteWithLimit(
    address optionMarket,
    uint amountQuote,
    uint baseLimit
  ) public override returns (uint baseSpent, uint quoteReceived) {
    return _exchangeToExactQuoteWithLimit(optionMarket, amountQuote, baseLimit);
  }

  function _exchangeToExactQuoteWithLimit(
    address optionMarket,
    uint amountQuote,
    uint baseLimit
  ) internal returns (uint baseSpent, uint quoteReceived) {
    ExchangeParams memory exchangeParams = getExchangeParams(optionMarket);
    uint baseToSpend = estimateExchangeToExactQuote(optionMarket, amountQuote);
    if (baseToSpend > baseLimit) {
      revert BaseQuoteExchangeExceedsLimit(
        address(this),
        amountQuote,
        baseToSpend,
        baseLimit,
        exchangeParams.spotPrice,
        exchangeParams.baseKey,
        exchangeParams.quoteKey
      );
    }

    return (baseToSpend, _exchangeBaseForQuote(optionMarket, baseToSpend));
  }

  function _exchangeBaseForQuote(address optionMarket, uint amountBase) internal returns (uint quoteReceived) {
    IERC20Decimals quoteAsset = IERC20Decimals(OptionMarket(optionMarket).quoteAsset());
    IERC20Decimals baseAsset = IERC20Decimals(OptionMarket(optionMarket).baseAsset());

    uint scaledAmtBase = _receiveAsset(baseAsset, amountBase);

    if (amountBase == 0) {
      return 0;
    }
    // swap exactly `amountBase` baseAsset for quoteAsset
    quoteReceived = synthetix.exchangeOnBehalfWithTracking(
      address(this),
      baseKey[optionMarket],
      scaledAmtBase,
      quoteKey[optionMarket],
      rewardAddress[optionMarket],
      trackingCode[optionMarket]
    );

    if (amountBase > 1e10 && quoteReceived == 0) {
      revert ReceivedZeroFromExchange(
        address(this),
        baseKey[optionMarket],
        quoteKey[optionMarket],
        amountBase,
        quoteReceived
      );
    }
    baseAsset.transfer(msg.sender, baseAsset.balanceOf(address(this)));
    if (!quoteAsset.transfer(msg.sender, quoteAsset.balanceOf(address(this)))) {
      revert TransferFailed(
        address(this),
        OptionMarket(optionMarket).quoteAsset(),
        address(this),
        msg.sender,
        quoteReceived
      );
    }

    emit BaseSwappedForQuote(optionMarket, msg.sender, scaledAmtBase, quoteReceived);
    return quoteReceived;
  }

  /**
   * @notice Returns an estimated amount of base required to swap for the amount of quote
   *
   * @param optionMarket The optionMarket address
   * @param amountQuote The amount of quote to swap to
   * @return baseNeeded The amount of base required for the swap
   */
  function estimateExchangeToExactQuote(
    address optionMarket,
    uint amountQuote
  ) public view override returns (uint baseNeeded) {
    ExchangeParams memory exchangeParams = getExchangeParams(optionMarket);
    return
      amountQuote.divideDecimalRound(DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate).divideDecimalRound(
        exchangeParams.spotPrice
      );
  }

  ////////////
  // Events //
  ////////////

  /**
   * @dev Emitted when the address resolver is set.
   */
  event AddressResolverSet(IAddressResolver addressResolver);
  /**
   * @dev Emitted when synthetix contracts are updated.
   */
  event SynthetixAddressesUpdated(
    ISynthetix synthetix,
    IExchanger exchanger,
    IExchangeRates exchangeRates,
    IDelegateApprovals delegateApprovals
  );
  /**
   * @dev Emitted when values for a given option market are set.
   */
  event GlobalsSetForContract(
    address indexed market,
    bytes32 quoteKey,
    bytes32 baseKey,
    address rewardAddress,
    bytes32 trackingCode
  );

  /**
   * @dev Emitted when rate is updated by the owner
   */
  event RiskFreeRateUpdated(int256 newRate);

  ////////////
  // Errors //
  ////////////

  // Exchanging
  error ReceivedZeroFromExchange(
    address thrower,
    bytes32 fromKey,
    bytes32 toKey,
    uint amountSwapped,
    uint amountReceived
  );

  error RateIsInvalid(address thrower, uint spotPrice, bool invalid);

  error InvalidRiskFreeRate();
}
