//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

interface ILiquidityCertificate {
  struct CertificateData {
    uint liquidity;
    uint enteredAt;
    uint burnableAt;
  }

  function MIN_LIQUIDITY() external view returns (uint);

  function liquidityPool() external view returns (address);

  function certificates(address owner) external view returns (uint[] memory);

  function liquidity(uint certificateId) external view returns (uint);

  function enteredAt(uint certificateId) external view returns (uint);

  function burnableAt(uint certificateId) external view returns (uint);

  function certificateData(uint certificateId) external view returns (CertificateData memory);

  function mint(
    address owner,
    uint liquidityAmount,
    uint expiryAtCreation
  ) external returns (uint);

  function setBurnableAt(
    address spender,
    uint certificateId,
    uint timestamp
  ) external;

  function burn(address spender, uint certificateId) external;

  function split(uint certificateId, uint percentageSplit) external returns (uint);
}
