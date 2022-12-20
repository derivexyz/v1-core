//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface AggregatorInterface {
  function latestAnswer() external view returns (int);

  function latestRound() external view returns (uint);

  function getAnswer(uint roundId) external view returns (int);

  function getTimestamp(uint roundId) external view returns (uint);
}

interface AggregatorV3Interface {
  function decimals() external view returns (uint8);

  function getRoundData(
    uint80 _roundId
  ) external view returns (uint80 roundId, int answer, uint startedAt, uint updatedAt, uint80 answeredInRound);

  function latestRoundData()
    external
    view
    returns (uint80 roundId, int answer, uint startedAt, uint updatedAt, uint80 answeredInRound);
}

interface AggregatorV2V3Interface is AggregatorInterface, AggregatorV3Interface {}
