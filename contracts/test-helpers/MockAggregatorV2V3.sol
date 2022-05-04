//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface AggregatorV2V3Interface {
  function latestRound() external view returns (uint);

  function decimals() external view returns (uint8);

  function getAnswer(uint roundId) external view returns (int);

  function getTimestamp(uint roundId) external view returns (uint);

  function getRoundData(uint80 _roundId)
    external
    view
    returns (
      uint80 roundId,
      int answer,
      uint startedAt,
      uint updatedAt,
      uint80 answeredInRound
    );

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int answer,
      uint startedAt,
      uint updatedAt,
      uint80 answeredInRound
    );
}

contract MockAggregatorV2V3 is AggregatorV2V3Interface {
  uint80 public roundId = 0;
  uint8 public keyDecimals = 0;

  struct Entry {
    uint80 roundId;
    int answer;
    uint startedAt;
    uint updatedAt;
    uint80 answeredInRound;
  }

  mapping(uint => Entry) public entries;

  bool public allRoundDataShouldRevert;
  bool public latestRoundDataShouldRevert;

  constructor() {}

  // Mock setup function
  function setLatestAnswer(int answer, uint timestamp) external {
    roundId++;
    entries[roundId] = Entry({
      roundId: roundId,
      answer: answer,
      startedAt: timestamp,
      updatedAt: timestamp,
      answeredInRound: roundId
    });
  }

  function setLatestAnswerWithRound(
    int answer,
    uint timestamp,
    uint80 _roundId
  ) external {
    roundId = _roundId;
    entries[roundId] = Entry({
      roundId: roundId,
      answer: answer,
      startedAt: timestamp,
      updatedAt: timestamp,
      answeredInRound: roundId
    });
  }

  function setAllRoundDataShouldRevert(bool _shouldRevert) external {
    allRoundDataShouldRevert = _shouldRevert;
  }

  function setLatestRoundDataShouldRevert(bool _shouldRevert) external {
    latestRoundDataShouldRevert = _shouldRevert;
  }

  function setDecimals(uint8 _decimals) external {
    keyDecimals = _decimals;
  }

  function latestRoundData()
    external
    view
    returns (
      uint80,
      int,
      uint,
      uint,
      uint80
    )
  {
    if (latestRoundDataShouldRevert) {
      revert("latestRoundData reverted");
    }
    return getRoundData(uint80(latestRound()));
  }

  function latestRound() public view returns (uint) {
    return roundId;
  }

  function decimals() external view returns (uint8) {
    return keyDecimals;
  }

  function getAnswer(uint _roundId) external view returns (int) {
    Entry memory entry = entries[_roundId];
    return entry.answer;
  }

  function getTimestamp(uint _roundId) external view returns (uint) {
    Entry memory entry = entries[_roundId];
    return entry.updatedAt;
  }

  function getRoundData(uint80 _roundId)
    public
    view
    returns (
      uint80,
      int,
      uint,
      uint,
      uint80
    )
  {
    if (allRoundDataShouldRevert) {
      revert("getRoundData reverted");
    }

    Entry memory entry = entries[_roundId];
    // Emulate a Chainlink aggregator
    require(entry.updatedAt > 0, "No data present");
    return (entry.roundId, entry.answer, entry.startedAt, entry.updatedAt, entry.answeredInRound);
  }
}
