//SPDX-License-Identifier: MIT

import "openzeppelin-contracts-upgradeable-4.5.1/proxy/utils/Initializable.sol";
import "./AbstractOwned.sol";

pragma solidity ^0.8.9;

/**
 * @title OwnedUpgradeable
 * @author Lyra
 * @dev Modified owned contract to allow for the owner to be initialised by the calling proxy
 * @dev https://docs.synthetix.io/contracts/source/contracts/owned
 */
contract OwnedUpgradeable is AbstractOwned, Initializable {
  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  function __Ownable_init() internal onlyInitializing {
    owner = msg.sender;
  }
}
