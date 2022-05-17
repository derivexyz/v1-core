//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

interface ICurve {
  function exchange_with_best_rate(
    address _from,
    address _to,
    uint _amount,
    uint _expected,
    address _receiver
  ) external payable returns (uint amountOut);

  function exchange_underlying(
    int128 _from,
    int128 _to,
    uint _amount,
    uint _expected
  ) external payable returns (uint amountOut);

  function get_best_rate(
    address _from,
    address _to,
    uint _amount
  ) external view returns (address pool, uint amountOut);
}
