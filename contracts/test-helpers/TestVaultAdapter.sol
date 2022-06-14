//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "../periphery/VaultAdapter.sol";

contract TestVaultAdapter is VaultAdapter {
  constructor() {}

  function setLyraAddressesExt(
    address _curveSwap,
    address _optionToken,
    address _optionMarket,
    address _liquidityPool,
    address _shortCollateral,
    address _synthetixAdapter,
    address _optionPricer,
    address _greekCache,
    address _quoteAsset,
    address _baseAsset,
    address _feeCounter
  ) external onlyOwner {
    setLyraAddresses(
      _curveSwap,
      _optionToken,
      _optionMarket,
      _liquidityPool,
      _shortCollateral,
      _synthetixAdapter,
      _optionPricer,
      _greekCache,
      _quoteAsset,
      _baseAsset,
      _feeCounter
    );
  }

  function openPositionExt(TradeInputParameters memory params) external returns (TradeResult memory result) {
    result = _openPosition(params);
  }

  function closePositionExt(TradeInputParameters memory params) external returns (TradeResult memory result) {
    result = _closePosition(params);
  }

  function forceClosePositionExt(TradeInputParameters memory params) external returns (TradeResult memory result) {
    result = _forceClosePosition(params);
  }

  function splitPositionExt(
    uint positionId,
    uint newAmount,
    uint newCollateral,
    address recipient
  ) external returns (uint newPositionId) {
    newPositionId = _splitPosition(positionId, newAmount, newCollateral, recipient);
  }

  function mergePositionsExt(uint[] memory positionIds) external {
    _mergePositions(positionIds);
  }

  function exchangeFromExactQuoteExt(uint amountQuote, uint minBaseReceived) external returns (uint baseReceived) {
    baseReceived = _exchangeFromExactQuote(amountQuote, minBaseReceived);
  }

  function exchangeToExactQuoteExt(uint amountQuote, uint maxBaseUsed) external returns (uint quoteReceived) {
    quoteReceived = _exchangeToExactQuote(amountQuote, maxBaseUsed);
  }

  function exchangeFromExactBaseExt(uint amountBase, uint minQuoteReceived) external returns (uint quoteReceived) {
    quoteReceived = _exchangeFromExactBase(amountBase, minQuoteReceived);
  }

  function exchangeToExactBaseExt(uint amountBase, uint maxQuoteUsed) external returns (uint baseReceived) {
    baseReceived = _exchangeToExactBase(amountBase, maxQuoteUsed);
  }

  function swapStablesExt(
    address from,
    address to,
    uint amount,
    uint expected,
    address receiver
  ) external returns (uint amountOut) {
    amountOut = _swapStables(from, to, amount, expected, receiver);
  }

  function getBoardExt(uint boardId) external view returns (Board memory board) {
    board = _getBoard(boardId);
  }

  function getStrikesExt(uint[] memory strikeIds) external view returns (Strike[] memory allStrikes) {
    allStrikes = _getStrikes(strikeIds);
  }

  function getVolsExt(uint[] memory strikeIds) external view returns (uint[] memory vols) {
    vols = _getVols(strikeIds);
  }

  function getDeltasExt(uint[] memory strikeIds) external view returns (int[] memory callDeltas) {
    callDeltas = _getDeltas(strikeIds);
  }

  function getVegasExt(uint[] memory strikeIds) external view returns (uint[] memory vegas) {
    vegas = _getVegas(strikeIds);
  }

  function getPurePremiumExt(
    uint secondsToExpiry,
    uint vol,
    uint spotPrice,
    uint strikePrice
  ) external view returns (uint call, uint put) {
    (call, put) = _getPurePremium(secondsToExpiry, vol, spotPrice, strikePrice);
  }

  function getPurePremiumForStrikeExt(uint strikeId) external view returns (uint call, uint put) {
    (call, put) = _getPurePremiumForStrike(strikeId);
  }

  function getLiquidityExt() external view returns (Liquidity memory liquidity) {
    liquidity = _getLiquidity();
  }

  function getFreeLiquidityExt() external view returns (uint freeLiquidity) {
    freeLiquidity = _getFreeLiquidity();
  }

  function getMarketParamsExt() external view returns (MarketParams memory params) {
    params = _getMarketParams();
  }

  function getExchangeParamsExt() external view returns (ExchangeRateParams memory params) {
    params = _getExchangeParams();
  }

  function getMinCollateralExt(
    OptionType optionType,
    uint strikePrice,
    uint expiry,
    uint spotPrice,
    uint amount
  ) external view returns (uint minCollateral) {
    minCollateral = _getMinCollateral(optionType, strikePrice, expiry, spotPrice, amount);
  }

  function getMinCollateralForPositionExt(uint positionId) external view returns (uint minCollateral) {
    minCollateral = _getMinCollateralForPosition(positionId);
  }

  function getMinCollateralForStrikeExt(
    OptionType optionType,
    uint strikeId,
    uint amount
  ) external view returns (uint minCollateral) {
    minCollateral = _getMinCollateralForStrike(optionType, strikeId, amount);
  }

  function getPositionsExt(uint[] memory positionIds) external view returns (OptionPosition[] memory allPositions) {
    allPositions = _getPositions(positionIds);
  }

  function getLiveBoardsExt() external view returns (uint[] memory liveBoards) {
    liveBoards = _getLiveBoards();
  }
}
