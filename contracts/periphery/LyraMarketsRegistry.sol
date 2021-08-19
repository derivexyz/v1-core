//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

/**
 * @title LyraMarketsRegistry
 * @author Lyra
 * @dev Registry that allow external services to keep track of the deployments Lyra Markets
 */
contract LyraMarketsRegistry is Ownable {
  using EnumerableSet for EnumerableSet.AddressSet;

  struct MarketAddresses {
    address liquidityPool;
    address liquidityCertificate;
    address optionGreekCache;
    address optionMarketPricer;
    address poolHedger;
    address shortCollateral;
    address quoteAsset;
    address baseAsset;
    address optionToken;
  }

  EnumerableSet.AddressSet internal optionMarkets;
  mapping(address => MarketAddresses) public optionMarketsAddresses;

  event MarketAdded(
    address optionMarket,
    address liquidityPool,
    address liquidityCertificate,
    address optionGreekCache,
    address optionMarketPricer,
    address poolHedger,
    address shortCollateral,
    address quoteAsset,
    address baseAsset,
    address optionToken
  );

  event MarketRemoved(address optionMarket);

  /**
   * @dev Method to register the addresses of a new deployments market
   *
   * @param optionMarket Address of the optionMarket contract
   * @param liquidityPool Address of the liquidityPool contract
   * @param liquidityCertificate Address of the liquidityCertificate contract
   * @param optionGreekCache Address of the optionGreekCache contract
   * @param optionMarketPricer Address of the optionMarketPricer contract
   * @param poolHedger Address of the poolHedger contract
   * @param shortCollateral Address of the shortCollateral contract
   * @param quoteAsset Address of quote asset
   * @param baseAsset Address of base asset
   * @param optionToken Address of optionToken contract
   */
  function addMarket(
    address optionMarket,
    address liquidityPool,
    address liquidityCertificate,
    address optionGreekCache,
    address optionMarketPricer,
    address poolHedger,
    address shortCollateral,
    address quoteAsset,
    address baseAsset,
    address optionToken
  ) external onlyOwner {
    require(optionMarkets.add(optionMarket), "market already present");
    optionMarketsAddresses[optionMarket] = MarketAddresses(
      liquidityPool,
      liquidityCertificate,
      optionGreekCache,
      optionMarketPricer,
      poolHedger,
      shortCollateral,
      quoteAsset,
      baseAsset,
      optionToken
    );

    emit MarketAdded(
      optionMarket,
      liquidityPool,
      liquidityCertificate,
      optionGreekCache,
      optionMarketPricer,
      poolHedger,
      shortCollateral,
      quoteAsset,
      baseAsset,
      optionToken
    );
  }

  /**
   * @dev Method to remove a market
   *
   * @param optionMarket Address of the optionMarket contract
   */
  function removeMarket(address optionMarket) external onlyOwner {
    require(optionMarkets.remove(optionMarket), "market not present");
    delete optionMarketsAddresses[optionMarket];

    emit MarketRemoved(optionMarket);
  }

  /**
   * @dev Gets the list of addresses of deployments OptionMarket contracts
   *
   * @return Array of OptionMarket addresses
   */
  function getOptionMarkets() external view returns (address[] memory) {
    address[] memory list = new address[](optionMarkets.length());
    for (uint i = 0; i < optionMarkets.length(); i++) {
      list[i] = optionMarkets.at(i);
    }
    return list;
  }

  /**
   * @dev Gets the addresses of the contracts associated to an OptionMarket contract
   *
   * @param optionMarketList Array of optionMarket contract addresses
   * @return Array of struct containing the associated contract addresses
   */
  function getOptionMarketsAddresses(address[] calldata optionMarketList)
    external
    view
    returns (MarketAddresses[] memory)
  {
    MarketAddresses[] memory marketAddresses = new MarketAddresses[](optionMarketList.length);
    for (uint i = 0; i < optionMarketList.length; i++) {
      marketAddresses[i] = optionMarketsAddresses[optionMarketList[i]];
    }
    return marketAddresses;
  }
}
