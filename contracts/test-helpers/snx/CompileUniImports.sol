//SPDX-License-Identifier: ISC
pragma solidity =0.7.6;

//interface
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @dev Contract is used to import all the contracts that are needed for integration testing the GMX contracts.
 */
contract SnxImports {
  constructor() {
    // this is empty
  }
}
