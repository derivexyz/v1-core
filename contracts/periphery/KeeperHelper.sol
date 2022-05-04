//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

//Interfaces
import "../OptionMarket.sol";

/**
 * @title KeeperHelper
 * @author Lyra
 * @dev A wrapper function that reduces the number of calls required for the keeperBot to liquidate positions
 */
contract KeeperHelper {
  OptionMarket public optionMarket;
  ShortCollateral public shortCollateral;
  bool public initialized;

  constructor() {}

  function init(OptionMarket _optionMarket, ShortCollateral _shortCollateral) external {
    require(!initialized, "Keeper Helper: already initialized");

    optionMarket = _optionMarket;
    shortCollateral = _shortCollateral;
  }

  /**
   * @dev Allows liquidations of multiple positions in a single call
   */
  function liquidateMany(uint[] memory positionIds) external {
    for (uint i = 0; i < positionIds.length; i++) {
      optionMarket.liquidatePosition(positionIds[i], msg.sender);
    }
  }

  /**
   * @dev Allows settlement of many positions in a single call.
   */
  function settleMany(uint[] memory positionIds) external {
    shortCollateral.settleOptions(positionIds);
  }
}
