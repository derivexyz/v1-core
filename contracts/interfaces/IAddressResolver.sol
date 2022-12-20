//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

// https://docs.synthetix.io/contracts/source/interfaces/iaddressresolver
interface IAddressResolver {
  function getAddress(bytes32 name) external view returns (address);
}
