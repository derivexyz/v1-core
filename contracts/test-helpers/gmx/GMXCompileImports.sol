//SPDX-License-Identifier: ISC
pragma solidity 0.6.12;

import "gmx/contracts/tokens/Token.sol";
import "gmx/contracts/oracle/PriceFeed.sol";
import "gmx/contracts/core/Vault.sol";
import "gmx/contracts/peripherals/Timelock.sol";
import "gmx/contracts/tokens/USDG.sol";
import "gmx/contracts/core/Router.sol";
import "gmx/contracts/peripherals/Reader.sol";
import "gmx/contracts/core/ShortsTracker.sol";
import "gmx/contracts/core/PositionRouter.sol";
import "gmx/contracts/referrals/ReferralStorage.sol";
import "gmx/contracts/tokens/YieldTracker.sol";
import "gmx/contracts/core/VaultPriceFeed.sol";
import "gmx/contracts/tokens/TimeDistributor.sol";
import "gmx/contracts/oracle/FastPriceFeed.sol";
import "gmx/contracts/oracle/FastPriceEvents.sol";
import "gmx/contracts/core/VaultErrorController.sol";

/**
 * @dev Contract is used to import all the contracts that are needed for integration testing the GMX contracts.
 */
contract GMXCompileImports {
  constructor() public {
    // this is empty
  }
}
