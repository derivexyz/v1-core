//SPDX-License-Identifier: ISC
// Test contract to mimic the funcitonality of snx futures market manager

pragma solidity 0.8.16;

import "../../synthetix/Owned.sol";
import "../../libraries/SimpleInitializable.sol";
import "../../interfaces/perpsV2/IPerpsV2MarketConsolidated.sol";
import "../../interfaces/perpsV2/IFuturesMarketManager.sol";

import "hardhat/console.sol";

contract TestFuturesMarketManager is Owned, SimpleInitializable {
  mapping(bytes32 => address) public marketForKey;

  constructor() Owned() {}

  function init() external onlyOwner initializer {}

  function addMarkets(address[] memory marketsToAdd) external onlyOwner {
    address marketAddress = marketsToAdd[0];
    bytes32 marketKey = IPerpsV2MarketConsolidated(marketAddress).marketKey();

    if (marketForKey[marketKey] != address(0)) {
      revert MarketAlreadyExists(marketForKey[marketKey], marketAddress, marketKey);
    }

    console.log("adding market", marketAddress);

    marketForKey[marketKey] = marketAddress;
    emit MarketAdded(marketAddress, marketKey);
  }

  function _marketsForKeys(bytes32[] memory marketKeys) internal view returns (address[] memory) {
    address[] memory markets = new address[](marketKeys.length);
    for (uint i = 0; i < marketKeys.length; i++) {
      markets[i] = marketForKey[marketKeys[i]];
    }
    console.log("returning market keys", markets[0]);
    return markets;
  }

  function marketsForKeys(bytes32[] memory marketKeys) external view returns (address[] memory) {
    return _marketsForKeys(marketKeys);
  }

  error MarketAlreadyExists(address existing, address proposed, bytes32 key);

  event MarketAdded(address market, bytes32 marketKey);
}
