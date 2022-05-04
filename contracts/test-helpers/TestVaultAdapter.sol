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
    result = openPosition(params);
  }

  function closePositionExt(TradeInputParameters memory params) external returns (TradeResult memory result) {
    result = closePosition(params);
  }

  function forceClosePositionExt(TradeInputParameters memory params) external returns (TradeResult memory result) {
    result = forceClosePosition(params);
  }

  function splitPositionExt(
    uint positionId,
    uint newAmount,
    uint newCollateral,
    address recipient
  ) external returns (uint newPositionId) {
    newPositionId = splitPosition(positionId, newAmount, newCollateral, recipient);
  }

  function mergePositionsExt(uint[] memory positionIds) external {
    mergePositions(positionIds);
  }

  function exchangeFromExactQuoteExt(uint amountQuote, uint minBaseReceived) external returns (uint baseReceived) {
    baseReceived = exchangeFromExactQuote(amountQuote, minBaseReceived);
  }

  function exchangeToExactQuoteExt(uint amountQuote, uint maxBaseUsed) external returns (uint quoteReceived) {
    quoteReceived = exchangeToExactQuote(amountQuote, maxBaseUsed);
  }

  function exchangeFromExactBaseExt(uint amountBase, uint minQuoteReceived) external returns (uint quoteReceived) {
    quoteReceived = exchangeFromExactBase(amountBase, minQuoteReceived);
  }

  function exchangeToExactBaseExt(uint amountBase, uint maxQuoteUsed) external returns (uint baseReceived) {
    baseReceived = exchangeToExactBase(amountBase, maxQuoteUsed);
  }

  function swapStablesExt(
    address from,
    address to,
    uint amount,
    uint expected,
    address receiver
  ) external returns (uint amountOut, int swapFee) {
    (amountOut, swapFee) = swapStables(from, to, amount, expected, receiver);
  }

  function getBoardExt(uint boardId) external view returns (Board memory board) {
    board = getBoard(boardId);
  }

  function getStrikesExt(uint[] memory strikeIds) external view returns (Strike[] memory allStrikes) {
    allStrikes = getStrikes(strikeIds);
  }

  function getVolsExt(uint[] memory strikeIds) external view returns (uint[] memory vols) {
    vols = getVols(strikeIds);
  }

  function getDeltasExt(uint[] memory strikeIds) external view returns (int[] memory callDeltas) {
    callDeltas = getDeltas(strikeIds);
  }

  function getVegasExt(uint[] memory strikeIds) external view returns (uint[] memory vegas) {
    vegas = getVegas(strikeIds);
  }

  function getPurePremiumForStrikeExt(uint strikeId) external view returns (uint call, uint put) {
    (call, put) = getPurePremiumForStrike(strikeId);
  }

  function getFreeLiquidityExt() external view returns (uint freeLiquidity) {
    freeLiquidity = getFreeLiquidity();
  }

  function getMarketParamsExt() external view returns (MarketParams memory params) {
    params = getMarketParams();
  }

  function getExchangeParamsExt() external view returns (ExchangeRateParams memory params) {
    params = getExchangeParams();
  }

  function getMinCollateralExt(
    OptionType optionType,
    uint strikePrice,
    uint expiry,
    uint spotPrice,
    uint amount
  ) external view returns (uint minCollateral) {
    minCollateral = getMinCollateral(optionType, strikePrice, expiry, spotPrice, amount);
  }

  function getMinCollateralForPositionExt(uint positionId) external view returns (uint minCollateral) {
    minCollateral = getMinCollateralForPosition(positionId);
  }

  function getMinCollateralForStrikeExt(
    OptionType optionType,
    uint strikeId,
    uint amount
  ) external view returns (uint minCollateral) {
    minCollateral = getMinCollateralForStrike(optionType, strikeId, amount);
  }

  function getPositionsExt(uint[] memory positionIds) external view returns (OptionPosition[] memory allPositions) {
    allPositions = getPositions(positionIds);
  }

  function getLiveBoardsExt() external view returns (uint[] memory liveBoards) {
    liveBoards = getLiveBoards();
  }
}
