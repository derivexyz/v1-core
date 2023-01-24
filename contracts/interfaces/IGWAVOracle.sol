//SPDX-License-Identifier:ISC

pragma solidity 0.8.16;

// For full documentation refer to @lyrafinance/protocol/contracts/periphery/GWAVOracle.sol";

interface IGWAVOracle {
  function ivGWAV(uint boardId, uint secondsAgo) external view returns (uint);

  function skewGWAV(uint strikeId, uint secondsAgo) external view returns (uint);

  function volGWAV(uint strikeId, uint secondsAgo) external view returns (uint);

  function deltaGWAV(uint strikeId, uint secondsAgo) external view returns (int callDelta);

  function vegaGWAV(uint strikeId, uint secondsAgo) external view returns (uint vega);

  function optionPriceGWAV(uint strikeId, uint secondsAgo) external view returns (uint callPrice, uint putPrice);
}
