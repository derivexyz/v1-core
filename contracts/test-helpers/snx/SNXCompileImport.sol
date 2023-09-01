//SPDX-License-Identifier: ISC
pragma solidity 0.5.16;

import "synthetix/contracts/MixinPerpsV2MarketSettings.sol";
import "synthetix/contracts/PerpsV2ExchangeRate.sol";
import "synthetix/contracts/PerpsV2Market.sol";
import "synthetix/contracts/PerpsV2MarketBase.sol";
import "synthetix/contracts/PerpsV2MarketData.sol";
import "synthetix/contracts/PerpsV2MarketDelayedOrders.sol";
import "synthetix/contracts/PerpsV2MarketDelayedOrdersBase.sol";
import "synthetix/contracts/PerpsV2MarketDelayedOrdersOffchain.sol";
import "synthetix/contracts/PerpsV2MarketProxyable.sol";
import "synthetix/contracts/PerpsV2MarketSettings.sol";
import "synthetix/contracts/PerpsV2MarketState.sol";
import "synthetix/contracts/PerpsV2MarketViews.sol";
import "synthetix/contracts/ProxyPerpsV2.sol";
import "synthetix/contracts/FuturesMarketManager.sol";
import "synthetix/contracts/FuturesMarketSettings.sol";
import "synthetix/contracts/SafeDecimalMath.sol";
import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";
import "synthetix/contracts/SignedSafeMath.sol";
import "synthetix/contracts/SignedSafeDecimalMath.sol";
import "synthetix/contracts/SafeDecimalMath.sol";

/**
 * @dev Contract is used to import all the contracts that are needed for integration testing the GMX contracts.
 */
contract SNXCompileImports {
  constructor() public {
    // this is empty
  }
}
