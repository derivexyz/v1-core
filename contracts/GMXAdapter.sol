//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

// Libraries
import "./libraries/Math.sol";

// Inherited
import "./BaseExchangeAdapter.sol";

// Interfaces
import "./interfaces/gmx/IVault.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/IERC20Decimals.sol";
import "./OptionMarket.sol";

/**
 * @title GMXAdapter
 * @author Lyra
 * @dev Manages access to exchange functions on GMX.
 */
contract GMXAdapter is BaseExchangeAdapter {
  using DecimalMath for uint;
  using SafeCast for uint;
  using SafeCast for int;

  IVault public vault;

  /// @dev Asset to chainlink feed
  mapping(address => AggregatorV2V3Interface) public chainlinkFeeds;

  /// @dev option market to min percentage that swap should return compared to amount calculated by prices. 1e18 is 100%
  mapping(address => uint) public minReturnPercent;

  /// @dev option market to constant used to estimate fee. 1.01e18 means we always estimate 1% fee to be charged
  mapping(address => uint) public staticSwapFeeEstimate;

  /// @dev option market to max price variance tolerance percentage
  mapping(address => uint) public priceVarianceCBPercent;

  /// @dev option market to risk free interest rate
  mapping(address => int) public override rateAndCarry;

  /// @dev option market to chainlink staleness duration
  mapping(address => uint) public chainlinkStalenessCheck;

  uint public constant GMX_PRICE_PRECISION = 10 ** 30;

  /// @dev payable fallback for receiving fee refunds from position request cancellations TODO: test this
  receive() external payable {}

  ///////////
  // Admin //
  ///////////

  /// @notice Sets the GMX vault contract
  function setVaultContract(IVault _vault) external onlyOwner {
    if (address(_vault) == address(0)) revert InvalidAddress(address(this), address(_vault));

    vault = _vault;

    emit GMXVaultAddressUpdated(address(_vault));
  }

  /**
   * @notice Sets an assets chainlink pricefeed
   */
  function setChainlinkFeed(address _asset, AggregatorV2V3Interface _assetPriceFeed) external onlyOwner {
    if (_asset == address(0)) revert InvalidAddress(address(this), _asset);
    if (address(_assetPriceFeed) == (address(0))) revert InvalidPriceFeedAddress(address(this), _assetPriceFeed);

    chainlinkFeeds[_asset] = _assetPriceFeed;

    emit ChainlinkAggregatorUpdated(_asset, address(_assetPriceFeed));
  }

  /**
   * @notice set min return percentage for an option market
   */
  function setMinReturnPercent(address _optionMarket, uint _minReturnPercent) external onlyOwner {
    if (_minReturnPercent > 1.2e18 || _minReturnPercent < 0.8e18) revert InvalidMinReturnPercentage();
    minReturnPercent[_optionMarket] = _minReturnPercent;

    emit MinReturnPercentageUpdate(_optionMarket, _minReturnPercent);
  }

  /**
   * @notice set static swap fee multiplier for an option market
   */
  function setStaticSwapFeeEstimate(address _optionMarket, uint _staticSwapFeeEstimate) external onlyOwner {
    if (_staticSwapFeeEstimate < 1e18) revert InvalidStaticSwapFeeEstimate();
    staticSwapFeeEstimate[_optionMarket] = _staticSwapFeeEstimate;

    emit StaticSwapFeeMultiplierUpdated(_optionMarket, _staticSwapFeeEstimate);
  }

  /**
   * @notice price variance tolerance
   */
  function setPriceVarianceCBPercent(address _optionMarket, uint _priceVarianceCBPercent) external onlyOwner {
    priceVarianceCBPercent[_optionMarket] = _priceVarianceCBPercent;

    emit PriceVarianceToleranceUpdated(_optionMarket, _priceVarianceCBPercent);
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

  /////////////
  // Getters //
  /////////////

  /**
   * @notice Gets spot price of the optionMarket's base asset.
   * @dev All rates are denominated in terms of quoteAsset.
   * @param optionMarket optionMarket address
   * @param pricing enum to specify which pricing to use
   */
  function getSpotPriceForMarket(
    address optionMarket,
    PriceType pricing
  ) external view override notPaused(optionMarket) returns (uint spotPrice) {
    uint clPrice = _getChainlinkPrice(optionMarket);

    // skip variance check on max and min if refernce price is requested
    if (pricing == PriceType.REFERENCE) return clPrice;

    address baseAsset = address(OptionMarket(optionMarket).baseAsset());

    // check both min and max prices are within deviation threshold from reference price
    uint maxPrice = _getMaxPrice(baseAsset);
    uint minPrice = _getMinPrice(baseAsset);

    _checkPriceVariance(optionMarket, maxPrice, clPrice);
    _checkPriceVariance(optionMarket, minPrice, clPrice);

    if (pricing == PriceType.MAX_PRICE) return maxPrice;
    else return minPrice;
  }

  /**
   * @dev check that the price is within variance tolerance with the reference price
   */
  function _checkPriceVariance(address optionMarket, uint price, uint refPrice) internal view {
    uint diffPercent = Math.abs(price.divideDecimalRound(refPrice).toInt256() - SignedDecimalMath.UNIT);
    if (diffPercent > priceVarianceCBPercent[optionMarket]) {
      revert PriceVarianceTooHigh(address(this), price, refPrice, priceVarianceCBPercent[optionMarket]);
    }
  }

  /**
   * @notice Gets spot price of the optionMarket's base asset used for settlement
   */
  function getSettlementPriceForMarket(
    address optionMarket,
    uint
  ) external view override notPaused(optionMarket) returns (uint spotPrice) {
    return _getChainlinkPrice(optionMarket);
  }

  /**
   * @notice get min price from GMX vault
   * @return price in 18 decimals
   */
  function _getMinPrice(address asset) internal view returns (uint) {
    uint minPrice = vault.getMinPrice(asset);
    return ConvertDecimals.normaliseTo18(minPrice, GMX_PRICE_PRECISION);
  }

  /**
   * @notice get max price from GMX vault
   * @return price in 18 decimals
   */
  function _getMaxPrice(address asset) internal view returns (uint) {
    uint minPrice = vault.getMaxPrice(asset);
    return ConvertDecimals.normaliseTo18(minPrice, GMX_PRICE_PRECISION);
  }

  /**
   * @notice get base asset price from Chainlink aggregator
   * @param optionMarket option market address
   * @return spotPrice price in 18 decimals
   */
  function _getChainlinkPrice(address optionMarket) internal view notPaused(optionMarket) returns (uint spotPrice) {
    AggregatorV2V3Interface assetPriceFeed = chainlinkFeeds[address(OptionMarket(optionMarket).baseAsset())];
    if (assetPriceFeed == AggregatorV2V3Interface(address(0))) {
      revert InvalidPriceFeedAddress(address(this), assetPriceFeed);
    }

    // use latestRoundData because getLatestAnswer is deprecated
    (, int answer, , uint updatedAt, ) = assetPriceFeed.latestRoundData();
    if (answer <= 0 || block.timestamp - updatedAt < chainlinkStalenessCheck[optionMarket]) {
      revert InvalidAnswer(address(this), answer, updatedAt);
    }
    spotPrice = ConvertDecimals.convertTo18(answer.toUint256(), assetPriceFeed.decimals());
  }

  ////////////////////
  // Estimate swaps //
  ////////////////////

  /**
   * @notice Returns the base needed to swap from the amount quote
   * @dev All rates are denominated in terms of quoteAsset.
   */
  function estimateExchangeToExactQuote(
    address _optionMarket,
    uint _amountQuote
  ) public view override returns (uint baseNeeded) {
    uint tokenInPrice = _getMinPrice(address(OptionMarket(_optionMarket).baseAsset()));
    uint tokenOutPrice = _getMaxPrice(address(OptionMarket(_optionMarket).quoteAsset()));

    return _estimateExchangeFee(_optionMarket, tokenInPrice, tokenOutPrice, _amountQuote);
  }

  /**
   * @notice Returns the quote needed to swap from the amount base
   * @dev All rates are denominated in terms of quoteAsset.
   */
  function estimateExchangeToExactBase(
    address _optionMarket,
    uint _amountBase
  ) public view override returns (uint quoteNeeded) {
    uint tokenInPrice = _getMinPrice(address(OptionMarket(_optionMarket).quoteAsset()));
    uint tokenOutPrice = _getMaxPrice(address(OptionMarket(_optionMarket).baseAsset()));

    return _estimateExchangeFee(_optionMarket, tokenInPrice, tokenOutPrice, _amountBase);
  }

  /**
   * @dev estimate amount of input needed, estimate with static swap fee
   * @param optionMarket option market address to map to estimate fee
   * @param tokenInPrice input token price
   * @param tokenOutPrice output token price
   * @param tokenOutAmt amount of output token needed
   * @param tokenInAmt of amount needed, considering a fee estimation
   */
  function _estimateExchangeFee(
    address optionMarket,
    uint tokenInPrice,
    uint tokenOutPrice,
    uint tokenOutAmt
  ) internal view returns (uint tokenInAmt) {
    if (staticSwapFeeEstimate[optionMarket] < 1e18) {
      revert InvalidStaticSwapFeeEstimate();
    }
    return
      tokenOutPrice
        .multiplyDecimalRound(tokenOutAmt)
        .multiplyDecimalRound(staticSwapFeeEstimate[optionMarket])
        .divideDecimal(tokenInPrice);
  }

  ///////////
  // Swaps //
  ///////////

  /**
   * @notice Swaps base for quote
   * @dev All rates are denominated in terms of quoteAsset.
   *
   * @param _optionMarket the baseAsset used for this _optionMarket
   * @param _amountBase the amount of base to be swapped. In 18 decimals
   * @return quoteReceived amount quote received in 18 decimals
   */
  function exchangeFromExactBase(
    address _optionMarket,
    uint _amountBase
  ) public override notPaused(_optionMarket) returns (uint quoteReceived) {
    IERC20Decimals baseAsset = OptionMarket(_optionMarket).baseAsset();
    IERC20Decimals quoteAsset = OptionMarket(_optionMarket).quoteAsset();

    uint tokenInPrice = _getMinPrice(address(baseAsset));
    uint tokenOutPrice = _getMaxPrice(address(quoteAsset));

    if (staticSwapFeeEstimate[_optionMarket] < 1e18) {
      revert InvalidStaticSwapFeeEstimate();
    }
    uint minOut = tokenInPrice
      .multiplyDecimal(minReturnPercent[_optionMarket])
      .multiplyDecimal(_amountBase)
      .divideDecimal(tokenOutPrice);

    // Transfer base to vault for the swap
    uint scaledAmtBase = _receiveAsset(baseAsset, _amountBase);
    _transferAsset(baseAsset, address(vault), _amountBase);

    // Swap and transfer directly to the requester
    uint rawQuoteReceived = vault.swap(address(baseAsset), address(quoteAsset), msg.sender);

    // complying to standard of adapter always taking in 1e18 and returning 1e18
    quoteReceived = ConvertDecimals.convertTo18(rawQuoteReceived, quoteAsset.decimals());

    if (quoteReceived < minOut) {
      revert InsufficientSwap(quoteReceived, minOut, baseAsset, quoteAsset, msg.sender);
    }

    emit BaseSwappedForQuote(_optionMarket, msg.sender, scaledAmtBase, quoteReceived);
  }

  /**
   * @notice Swaps quote for base
   * @dev All rates are denominated in terms of quoteAsset.
   * @dev this implementation "WILL NOT" give you exact base after swap.
   *
   * @param _optionMarket the baseAsset used for this _optionMarket
   * @param _amountBase the desired amount of base to receive
   * @param _quoteLimit the max amount of quote that can be used
   */
  function exchangeToExactBaseWithLimit(
    address _optionMarket,
    uint _amountBase,
    uint _quoteLimit
  ) public override notPaused(_optionMarket) returns (uint quoteSpent, uint baseReceived) {
    IERC20Decimals quoteAsset = OptionMarket(_optionMarket).quoteAsset();
    IERC20Decimals baseAsset = OptionMarket(_optionMarket).baseAsset();

    uint quoteNeeded = estimateExchangeToExactBase(_optionMarket, _amountBase);
    if (quoteNeeded > _quoteLimit) {
      // We'll still try the transfer with the given limit, but if we receive too little we'll revert
      quoteNeeded = _quoteLimit;
    }

    quoteSpent = _receiveAsset(quoteAsset, quoteNeeded);
    _transferAsset(quoteAsset, address(vault), quoteNeeded);

    // GMX Vault swaps and then sends tokenOut to msg.sender
    baseReceived = vault.swap(address(quoteAsset), address(baseAsset), msg.sender);

    // convert to 18 decimals
    uint convertedBaseReceived = ConvertDecimals.convertTo18(baseReceived, baseAsset.decimals());

    if (convertedBaseReceived < _amountBase) {
      revert InsufficientSwap(convertedBaseReceived, _amountBase, quoteAsset, baseAsset, msg.sender);
    }

    emit QuoteSwappedForBase(_optionMarket, msg.sender, quoteSpent, convertedBaseReceived);
    return (quoteNeeded, convertedBaseReceived);
  }

  ////////////
  // Errors //
  ////////////
  error InvalidMinReturnPercentage();
  error InvalidStaticSwapFeeEstimate();
  error InvalidPriceFeedAddress(address thrower, AggregatorV2V3Interface inputAddress);
  error InvalidAnswer(address thrower, int answer, uint updatedAt);
  error PriceVarianceTooHigh(address thrower, uint price, uint refPrice, uint priceVarianceCBPercent);
  error InvalidRiskFreeRate();

  //////////////
  //  Events  //
  //////////////
  event MinReturnPercentageUpdate(address indexed optionMarket, uint256 minReturnPercentage);
  event StaticSwapFeeMultiplierUpdated(address indexed optionMarket, uint256 swapFeeEstimate);
  event PriceVarianceToleranceUpdated(address indexed optionMarket, uint256 priceVarianceTolerance);
  event ChainlinkAggregatorUpdated(address indexed asset, address indexed aggregator);
  event RiskFreeRateUpdated(int256 newRate);
  event GMXVaultAddressUpdated(address vault);
}
