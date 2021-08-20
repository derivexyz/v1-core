//SPDX-License-Identifier: ISC
pragma solidity >=0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/ISynthetix.sol";
// Debug
import "./ITestERC20.sol";
import "../synthetix/SafeDecimalMath.sol";
import "../interfaces/ILyraGlobals.sol";

contract TestSynthetix is ISynthetix {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  ILyraGlobals internal globals;
  ITestERC20 internal quoteAsset;

  mapping(bytes32 => ITestERC20) baseAssets;
  mapping(bytes32 => address) markets;

  event Exchange(
    address exchangeForAddress,
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  );

  bool initialized = false;

  constructor() {}

  function init(ILyraGlobals _globals, ITestERC20 _quoteAsset) external {
    require(!initialized);
    globals = _globals;
    quoteAsset = _quoteAsset;
    initialized = true;
  }

  function addBaseAsset(
    bytes32 ticker,
    ITestERC20 baseAsset,
    address market
  ) external {
    require(baseAsset != ITestERC20(0));
    require(market != address(0));
    baseAssets[ticker] = baseAsset;
    markets[ticker] = market;
  }

  function exchange(
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) public virtual override returns (uint amountReceived) {
    emit Exchange(msg.sender, sourceCurrencyKey, sourceAmount, destinationCurrencyKey);
    return exchangeOnBehalf(msg.sender, sourceCurrencyKey, sourceAmount, destinationCurrencyKey);
  }

  function exchangeOnBehalf(
    address exchangeForAddress,
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) public override returns (uint amountReceived) {
    require(exchangeForAddress == msg.sender, "cannot exchangeOnBehalf of someone else");
    uint fromRate;
    uint feeRate = 0;
    uint toRate;
    if (sourceCurrencyKey == "sUSD") {
      fromRate = 1e18;
      quoteAsset.burn(exchangeForAddress, sourceAmount);
    } else {
      address market = markets[sourceCurrencyKey];
      require(market != address(0), "invalid source currency key");
      ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
        globals.getExchangeGlobals(market, ILyraGlobals.ExchangeType.BASE_QUOTE);
      ITestERC20 baseAsset = baseAssets[sourceCurrencyKey];
      require(baseAsset != ITestERC20(0));
      baseAsset.burn(exchangeForAddress, sourceAmount);
      fromRate = exchangeGlobals.spotPrice;
      feeRate = exchangeGlobals.baseQuoteFeeRate;
    }

    if (destinationCurrencyKey == "sUSD") {
      uint amountConverted = sourceAmount.multiplyDecimalRound(fromRate);
      amountReceived = amountConverted.multiplyDecimalRound(1e18 - feeRate);
      quoteAsset.mint(exchangeForAddress, amountReceived);
    } else {
      address market = markets[destinationCurrencyKey];
      require(market != address(0), "invalid destination currency key");
      ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
        globals.getExchangeGlobals(market, ILyraGlobals.ExchangeType.QUOTE_BASE);
      ITestERC20 baseAsset = baseAssets[destinationCurrencyKey];
      toRate = exchangeGlobals.spotPrice;
      if (feeRate == 0) {
        feeRate = exchangeGlobals.quoteBaseFeeRate;
      }

      uint amountConverted = sourceAmount.multiplyDecimalRound(fromRate).divideDecimalRound(toRate);
      amountReceived = amountConverted.multiplyDecimalRound(1e18 - feeRate);

      baseAsset.mint(exchangeForAddress, amountReceived);
    }
  }
}
