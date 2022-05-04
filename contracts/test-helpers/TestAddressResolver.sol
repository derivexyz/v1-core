//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IAddressResolver.sol";

contract TestAddressResolver is IAddressResolver, Ownable {
  mapping(bytes32 => address) public override getAddress;

  constructor() Ownable() {}

  function setAddresses(bytes32[] memory names, address[] memory locations) external {
    require(names.length == locations.length, "length mismatch");

    for (uint i = 0; i < names.length; i++) {
      getAddress[names[i]] = locations[i];
    }
  }
}
