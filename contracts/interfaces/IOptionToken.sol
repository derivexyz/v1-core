//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";

interface IOptionToken is IERC1155, IERC1155MetadataURI {
  function setURI(string memory newURI) external;

  function mint(
    address account,
    uint id,
    uint amount
  ) external;

  function burn(
    address account,
    uint id,
    uint amount
  ) external;
}
