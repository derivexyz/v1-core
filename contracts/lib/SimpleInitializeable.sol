// SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

/**
 * @title SimpleInitializeable
 * @author Lyra
 * @dev Contract to enable a function to be marked as the initializer
 */
abstract contract SimpleInitializeable {
  bool internal initialized = false;

  modifier initializer {
    if (initialized) {
      revert AlreadyInitialised(address(this));
    }
    initialized = true;
    _;
  }

  ////////////
  // Errors //
  ////////////
  error AlreadyInitialised(address thrower);
}
