//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "../OptionMarket.sol";
import "../libraries/BlackScholes.sol";
import "../synthetix/DecimalMath.sol";
import "../OptionToken.sol";
import "../LiquidityPool.sol";
import "../OptionGreekCache.sol";
import "../OptionMarketPricer.sol";
import "../SynthetixAdapter.sol";
import "../synthetix/Owned.sol";
import "./Wrapper/OptionMarketWrapper.sol";
import "./OptionMarketViewer.sol";

/**
 * @title OptionMarketViewer
 * @author Lyra
 * @dev Provides helpful functions to allow the dapp to operate more smoothly; logic in getPremiumForTrade is vital to
 * ensuring accurate prices are provided to the user.
 */
contract LyraRegistry is Owned {
  struct OptionMarketAddresses {
    LiquidityPool liquidityPool;
    LiquidityToken liquidityToken;
    OptionGreekCache greekCache;
    OptionMarket optionMarket;
    OptionMarketPricer optionMarketPricer;
    OptionToken optionToken;
    PoolHedger poolHedger;
    ShortCollateral shortCollateral;
    IERC20 quoteAsset;
    IERC20 baseAsset;
  }

  OptionMarket[] public optionMarkets;
  mapping(OptionMarket => OptionMarketAddresses) public marketAddresses;
  mapping(bytes32 => address) public globalAddresses;

  constructor() Owned() {}

  function updateGlobalAddresses(bytes32[] memory names, address[] memory addresses) external onlyOwner {
    require(names.length == addresses.length, "length mismatch");
    for (uint i = 0; i < names.length; i++) {
      globalAddresses[names[i]] = addresses[i];
      emit GlobalAddressUpdated(names[i], addresses[i]);
    }
  }

  function addMarket(OptionMarketAddresses memory newMarketAddresses) external onlyOwner {
    if (address(marketAddresses[newMarketAddresses.optionMarket].optionMarket) == address(0)) {
      optionMarkets.push(newMarketAddresses.optionMarket);
    }
    marketAddresses[newMarketAddresses.optionMarket] = newMarketAddresses;
    emit MarketUpdated(newMarketAddresses.optionMarket, newMarketAddresses);
  }

  function removeMarket(OptionMarket market) external onlyOwner {
    _removeMarket(market);
  }

  function _removeMarket(OptionMarket market) internal {
    // do something with marketAddresses ?
    uint index = 0;
    bool found = false;
    for (uint i = 0; i < optionMarkets.length; i++) {
      if (optionMarkets[i] == market) {
        index = i;
        found = true;
        break;
      }
    }
    if (!found) {
      revert RemovingInvalidMarket(address(this), address(market));
    }
    optionMarkets[index] = optionMarkets[optionMarkets.length - 1];
    optionMarkets.pop();

    emit MarketRemoved(market);
    delete marketAddresses[market];
  }

  /**
   * @dev Emitted when a global contract is added
   */
  event GlobalAddressUpdated(bytes32 indexed name, address addr);

  /**
   * @dev Emitted when an optionMarket is updated
   */
  event MarketUpdated(OptionMarket indexed optionMarket, OptionMarketAddresses market);

  /**
   * @dev Emitted when an optionMarket is removed
   */
  event MarketRemoved(OptionMarket indexed market);

  ////////////
  // Errors //
  ////////////
  error RemovingInvalidMarket(address thrower, address market);
}
