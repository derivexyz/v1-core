//SPDX-License-Identifier:ISC
pragma solidity 0.8.16;

import "../BaseExchangeAdapter.sol";

contract TestBaseExchangeAdapter is BaseExchangeAdapter {
  function testTransferAsset(IERC20Decimals asset, address recipient, uint amount) external {
    _transferAsset(asset, recipient, amount);
  }
}
