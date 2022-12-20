//SPDX-License-Identifier: ISC
// Test contract to mimic the funcitonality of snx futures market manager

pragma solidity 0.8.16;

import "../../synthetix/Owned.sol";
import "../../libraries/SimpleInitializable.sol";
import "../../interfaces/IFuturesMarket.sol";
import "../../interfaces/IFuturesMarketManager.sol";

contract TestFuturesMarketManager is Owned, SimpleInitializable {
  mapping(bytes32 => address) public curMarkets;

  constructor() Owned() {}

  function init() external onlyOwner initializer {}

  function addMarkets(address[] memory marketsToAdd) external onlyOwner {
    address marketAddress = marketsToAdd[0];
    bytes32 marketKey = IFuturesMarket(marketAddress).marketKey();

    if (curMarkets[marketKey] != address(0)) {
      revert MarketAlreadyExists(curMarkets[marketKey], marketAddress, marketKey);
    }

    curMarkets[marketKey] = marketAddress;
    emit MarketAdded(marketAddress, marketKey);
  }

  function marketForKey(bytes32 marketKey) external view returns (address) {
    return curMarkets[marketKey];
  }

  error MarketAlreadyExists(address existing, address proposed, bytes32 key);

  event MarketAdded(address market, bytes32 marketKey);
}
