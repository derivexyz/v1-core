//SPDX-License-Identifier: ISC
// contract to mock snx futures market

pragma solidity 0.8.16;

import "../../interfaces/IFuturesMarket.sol";
import "../../synthetix/Owned.sol";
import "../../libraries/SimpleInitializable.sol";

// import "openzeppelin-solidity-2.3.0/contracts/math/SafeMath.sol";
// import "../libraries/SignedSafeMath.sol";
// import "./SignedSafeDecimalMath.sol";
// import "./SafeDecimalMath.sol";

contract TestFuturesMarket is Owned, SimpleInitializable {
  mapping(address => Position) public positions_map;
  bytes32 public marketKey;

  // taken from https://github.com/Synthetixio/synthetix/blob/v2.77.0-alpha/contracts/interfaces/IFuturesMarketBaseTypes.sol
  // If margin/size are positive, the position is long; if negative then it is short.
  struct Position {
    uint64 id;
    uint64 lastFundingIndex;
    uint128 margin;
    uint128 lastPrice;
    int128 size;
  }

  // convenience struct for passing params between position modification helper functions
  struct TradeParams {
    int sizeDelta;
    uint price;
  }

  constructor() Owned() {}

  function init(bytes32 _marketKey) external onlyOwner initializer {
    marketKey = _marketKey;
  }

  // bytes32 redudant in testing.
  function modifyPositionWithTracking(int sizeDelta, bytes32) external {
    TradeParams memory trade = TradeParams({sizeDelta: sizeDelta, price: 0});
    Position memory oldPos = positions_map[msg.sender];
    mockTrade(oldPos, trade);
    emit positionModified(sizeDelta);
  }

  function transferMargin(int marginDelta) external {}

  function mockTrade(
    Position memory oldPosition,
    TradeParams memory params
  ) internal returns (Position memory newPosition) {
    newPosition = Position({
      id: oldPosition.id,
      lastFundingIndex: oldPosition.lastFundingIndex,
      margin: 1,
      lastPrice: oldPosition.lastPrice,
      size: int128(oldPosition.size + params.sizeDelta)
    });
    positions_map[msg.sender] = newPosition;
  }

  function positions(
    address account
  ) external view returns (uint64 id, uint64 fundingIndex, uint128 margin, uint128 lastPrice, int128 size) {
    id = positions_map[account].id;
    fundingIndex = positions_map[account].lastFundingIndex;
    margin = positions_map[account].margin;
    lastPrice = positions_map[account].lastPrice;
    size = positions_map[account].size;
  }

  event positionModified(int indexed);
}
