//SPDX-License-Identifier: ISC

pragma solidity 0.8.16;

interface IRouter {
  function addPlugin(address _plugin) external;

  function pluginTransfer(address _token, address _account, address _receiver, uint _amount) external;

  function pluginIncreasePosition(
    address _account,
    address _collateralToken,
    address _indexToken,
    uint _sizeDelta,
    bool _isLong
  ) external;

  function pluginDecreasePosition(
    address _account,
    address _collateralToken,
    address _indexToken,
    uint _collateralDelta,
    uint _sizeDelta,
    bool _isLong,
    address _receiver
  ) external returns (uint);

  function swap(address[] memory _path, uint _amountIn, uint _minOut, address _receiver) external;

  function approvePlugin(address _plugin) external;
}
