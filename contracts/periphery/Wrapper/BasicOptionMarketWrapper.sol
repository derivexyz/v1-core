//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "../../OptionMarket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasicOptionMarketWrapper
 */
contract BasicOptionMarketWrapper is Ownable {
  struct OptionMarketContracts {
    IERC20 quoteAsset;
    IERC20 baseAsset;
    OptionToken optionToken;
  }

  mapping(OptionMarket => OptionMarketContracts) public marketContracts;

  constructor() Ownable() {}

  function updateMarket(OptionMarket optionMarket, OptionMarketContracts memory _marketContracts) external onlyOwner {
    marketContracts[optionMarket] = _marketContracts;

    marketContracts[optionMarket].quoteAsset.approve(address(optionMarket), type(uint).max);
    marketContracts[optionMarket].baseAsset.approve(address(optionMarket), type(uint).max);
  }

  function openPosition(
    OptionMarket optionMarket,
    OptionMarket.TradeInputParameters memory params,
    uint extraCollateral
  ) external returns (OptionMarket.Result memory result) {
    OptionMarketContracts memory c = marketContracts[optionMarket];

    if (params.positionId != 0) {
      c.optionToken.transferFrom(msg.sender, address(this), params.positionId);
    }

    _takeExtraCollateral(c, params.optionType, extraCollateral);

    result = optionMarket.openPosition(params);

    _returnExcessFunds(c);

    c.optionToken.transferFrom(address(this), msg.sender, result.positionId);
  }

  function closePosition(
    OptionMarket optionMarket,
    OptionMarket.TradeInputParameters memory params,
    uint extraCollateral
  ) external returns (OptionMarket.Result memory result) {
    OptionMarketContracts memory c = marketContracts[optionMarket];

    if (params.positionId != 0) {
      c.optionToken.transferFrom(msg.sender, address(this), params.positionId);
    }

    _takeExtraCollateral(c, params.optionType, extraCollateral);

    result = optionMarket.closePosition(params);

    _returnExcessFunds(c);

    if (c.optionToken.getPositionState(result.positionId) == OptionToken.PositionState.ACTIVE) {
      c.optionToken.transferFrom(address(this), msg.sender, params.positionId);
    }
  }

  function forceClosePosition(
    OptionMarket optionMarket,
    OptionMarket.TradeInputParameters memory params,
    uint extraCollateral
  ) external returns (OptionMarket.Result memory result) {
    OptionMarketContracts memory c = marketContracts[optionMarket];

    if (params.positionId != 0) {
      c.optionToken.transferFrom(msg.sender, address(this), params.positionId);
    }

    _takeExtraCollateral(c, params.optionType, extraCollateral);

    result = optionMarket.forceClosePosition(params);

    _returnExcessFunds(c);

    if (c.optionToken.getPositionState(result.positionId) == OptionToken.PositionState.ACTIVE) {
      c.optionToken.transferFrom(address(this), msg.sender, params.positionId);
    }
  }

  function _takeExtraCollateral(
    OptionMarketContracts memory c,
    OptionMarket.OptionType optionType,
    uint extraCollateral
  ) internal {
    if (!_isLong(optionType)) {
      if (extraCollateral != 0) {
        if (_isBaseCollateral(optionType)) {
          c.baseAsset.transferFrom(msg.sender, address(this), extraCollateral);
        } else {
          c.quoteAsset.transferFrom(msg.sender, address(this), extraCollateral);
        }
      }
    }
  }

  function _returnExcessFunds(OptionMarketContracts memory c) internal {
    uint quoteBal = c.quoteAsset.balanceOf(address(this));
    if (quoteBal > 0) {
      c.quoteAsset.transfer(msg.sender, quoteBal);
    }
    uint baseBal = c.baseAsset.balanceOf(address(this));
    if (baseBal > 0) {
      c.baseAsset.transfer(msg.sender, baseBal);
    }
  }

  function _isLong(OptionMarket.OptionType optionType) internal pure returns (bool) {
    return (optionType < OptionMarket.OptionType.SHORT_CALL_BASE);
  }

  function _isCall(OptionMarket.OptionType optionType) internal pure returns (bool) {
    return (optionType != OptionMarket.OptionType.SHORT_PUT_QUOTE && optionType != OptionMarket.OptionType.LONG_PUT);
  }

  function _isBaseCollateral(OptionMarket.OptionType optionType) internal pure returns (bool) {
    return (optionType == OptionMarket.OptionType.SHORT_CALL_BASE);
  }
}
