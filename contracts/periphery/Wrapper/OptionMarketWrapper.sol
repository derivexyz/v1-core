//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Inherited
import "./OptionMarketWrapperWithSwaps.sol";

/**
 * @title CompressedOptionMarketWrapper
 * @author Lyra
 * @dev Allows users to open/close positions in any market with multiple stablecoins
 */
contract OptionMarketWrapper is OptionMarketWrapperWithSwaps {
  /////////////////////////////////////////////
  // Specific functions with packed calldata //
  /////////////////////////////////////////////

  // TODO: convert these structs to comments which explain offset/sizes
  struct OpenLongParams {
    uint8 market; // 8
    uint8 token; // 16
    bool isCall; // 24
    uint8 iterations; // 32
    uint32 strikeId; // 64
    uint32 maxCost; // 96
    uint32 inputAmount; // 128
    uint64 size; // 192
  }

  /**
   * @param params Is a compressed uint which contains the following fields:
   * loc | type   | name         | description
   * ------------------------------------------
   * 0   | uint8  | market       | market id as set in `addMarket`
   * 8   | uint8  | inputAsset   | asset the caller is sending to the contract
   * 16  | bool   | isCall       | whether the purchased option is a cll or put
   * 24  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.
   * 32  | uint32 | strikeId     | The strikeId to be traded
   * 64  | uint32 | maxCost      | The maximum amount the user will pay for all the options purchased - there must have at least this much left over after a stable swap
   * 96  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)
   * 128 | uint64 | amount       | The amount of options the user is purchasing (compressed to 8 d.p.)
   * Total 192 bits
   */
  function openLong(uint params) external returns (uint totalCost) {
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: idToMarket[uint8(params)],
      strikeId: _parseUint32(params >> 32),
      positionId: 0,
      iterations: _parseUint8(params >> 24),
      currentCollateral: 0,
      setCollateralTo: 0,
      optionType: uint8(params >> 16) > 0 ? OptionMarket.OptionType.LONG_CALL : OptionMarket.OptionType.LONG_PUT,
      amount: _parseUint64Amount(params >> 128),
      minCost: 0,
      maxCost: _parseUint32Amount(params >> 64),
      inputAmount: _convertDecimal(_parseUint32(params >> 96), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _openPosition(positionParams);
    totalCost = returnDetails.totalCost;
  }

  struct AddLongParams {
    uint8 market; // 8
    uint8 token; // 16
    uint8 iterations; // 24
    uint32 positionId; // 56
    uint32 maxCost; // 88
    uint32 inputAmount; // 120
    uint64 size; // 164
  }

  function addLong(uint params) external returns (uint totalCost) {
    OptionMarket optionMarket = idToMarket[uint8(params)];
    OptionMarketContracts memory c = marketContracts[optionMarket];
    OptionToken.PositionWithOwner memory position = c.optionToken.getPositionWithOwner(uint(uint32(params >> 24)));
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: optionMarket,
      strikeId: position.strikeId,
      positionId: position.positionId,
      iterations: _parseUint8(params >> 16),
      currentCollateral: 0,
      setCollateralTo: 0,
      optionType: position.optionType,
      amount: _parseUint64Amount(params >> 120),
      minCost: 0,
      maxCost: _parseUint32Amount(params >> 56),
      inputAmount: _convertDecimal(_parseUint32(params >> 88), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _openPosition(positionParams);
    totalCost = returnDetails.totalCost;
  }

  struct RemoveLongParams {
    uint8 market; // 8
    uint8 token; // 16
    uint8 iterations; // 24
    bool isForceClose; // 32
    uint32 positionId; // 64
    uint32 inputAmount; // 96
    uint64 size; // 160
    uint32 minReceived; // 192
  }

  function reduceLong(uint params) external returns (uint totalReceived) {
    OptionMarket optionMarket = idToMarket[uint8(params)];
    OptionMarketContracts memory c = marketContracts[optionMarket];
    OptionToken.PositionWithOwner memory position = c.optionToken.getPositionWithOwner(uint(uint32(params >> 32)));
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: optionMarket,
      strikeId: position.strikeId,
      positionId: position.positionId,
      iterations: _parseUint8(params >> 16),
      currentCollateral: 0,
      setCollateralTo: 0,
      optionType: position.optionType,
      amount: _parseUint64Amount(params >> 96),
      minCost: _parseUint32Amount(params >> 160),
      maxCost: type(uint).max,
      inputAmount: _convertDecimal(_parseUint32(params >> 64), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _closePosition(positionParams, (uint8(params >> 24) > 0));
    totalReceived = returnDetails.totalCost;
  }

  struct CloseLongParams {
    uint8 market; // 8
    uint8 token; // 16
    uint8 iterations; // 24
    bool isForceClose; // 32
    uint32 positionId; // 64
    uint32 inputAmount; // 96
    uint32 minReceived; // 128
  }

  function closeLong(uint params) external returns (uint totalReceived) {
    OptionMarket optionMarket = idToMarket[uint8(params)];
    OptionMarketContracts memory c = marketContracts[optionMarket];
    OptionToken.PositionWithOwner memory position = c.optionToken.getPositionWithOwner(uint(uint32(params >> 32)));
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: optionMarket,
      strikeId: position.strikeId,
      positionId: position.positionId,
      iterations: _parseUint8(params >> 16),
      currentCollateral: 0,
      setCollateralTo: 0,
      optionType: position.optionType,
      amount: position.amount,
      minCost: _parseUint32Amount(params >> 96),
      maxCost: type(uint).max,
      inputAmount: _convertDecimal(_parseUint32(params >> 64), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _closePosition(positionParams, (uint8(params >> 24) > 0));
    totalReceived = returnDetails.totalCost;
  }

  struct OpenShortParams {
    uint8 market; // 8
    uint8 token; // 16
    OptionMarket.OptionType optionType; // 24
    uint8 iterations; // 32
    uint32 strikeId; // 64
    uint32 minReceived; // 96
    uint32 inputAmount; // 128
    uint64 size; // 192
    uint64 collateral; // 256
  }

  function openShort(uint params) external returns (uint totalReceived) {
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: idToMarket[uint8(params)],
      strikeId: uint(uint32(params >> 32)),
      positionId: 0,
      iterations: _parseUint8(params >> 24),
      currentCollateral: 0,
      setCollateralTo: _parseUint64Amount(params >> 192),
      optionType: OptionMarket.OptionType(uint8(params >> 16)),
      amount: _parseUint64Amount(params >> 128),
      minCost: _parseUint32Amount(params >> 64),
      maxCost: type(uint).max,
      inputAmount: _convertDecimal(_parseUint32(params >> 96), inputAsset),
      inputAsset: inputAsset
    });

    if (_isLong(positionParams.optionType)) {
      revert OnlyShorts(address(this), positionParams.optionType);
    }

    ReturnDetails memory returnDetails = _openPosition(positionParams);
    totalReceived = returnDetails.totalCost;
  }

  struct AddShortParams {
    uint8 market; // 8
    uint8 token; // 16
    uint8 iterations; // 24
    uint32 positionId; // 56
    uint32 inputAmount; // 88
    uint32 minReceived; // 120
    uint64 size; // 184
    uint64 absoluteCollateral; // 248
  }

  function addShort(uint params) external returns (uint totalReceived) {
    OptionMarket optionMarket = idToMarket[uint8(params)];
    OptionMarketContracts memory c = marketContracts[optionMarket];
    OptionToken.PositionWithOwner memory position = c.optionToken.getPositionWithOwner(uint(uint32(params >> 24)));
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: optionMarket,
      strikeId: position.strikeId,
      positionId: position.positionId,
      iterations: _parseUint8(params >> 16),
      setCollateralTo: _parseUint64Amount(params >> 184),
      currentCollateral: position.collateral,
      optionType: position.optionType,
      amount: _parseUint64Amount(params >> 120),
      minCost: _parseUint32Amount(params >> 88),
      maxCost: type(uint).max,
      inputAmount: _convertDecimal(_parseUint32(params >> 56), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _openPosition(positionParams);
    totalReceived = returnDetails.totalCost;
  }

  struct RemoveShortParams {
    uint8 market; // 8
    uint8 token; // 16
    uint8 iterations; // 24
    bool isForceClose; // 32
    uint32 positionId; // 64
    uint32 inputAmount; // 96
    uint32 maxCost; // 128
    uint64 size; // 196
    uint64 absoluteCollateral; // 256
  }

  function reduceShort(uint params) external returns (uint totalCost) {
    OptionMarket optionMarket = idToMarket[uint8(params)];
    OptionMarketContracts memory c = marketContracts[optionMarket];
    OptionToken.PositionWithOwner memory position = c.optionToken.getPositionWithOwner(uint(uint32(params >> 32)));
    ERC20 inputAsset = idToERC[uint8(params >> 8)];

    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: optionMarket,
      strikeId: position.strikeId,
      positionId: position.positionId,
      iterations: _parseUint8(params >> 16),
      setCollateralTo: _parseUint64Amount(params >> 196),
      currentCollateral: position.collateral,
      optionType: position.optionType,
      amount: _parseUint64Amount(params >> 128),
      minCost: 0,
      maxCost: _parseUint32Amount(params >> 96),
      inputAmount: _convertDecimal(_parseUint32(params >> 64), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _closePosition(positionParams, (uint8(params >> 24) > 0));
    totalCost = returnDetails.totalCost;
  }

  struct CloseShortParams {
    uint8 market; // 8
    uint8 token; // 16
    uint8 iterations; // 24
    bool isForceClose; // 32
    uint32 positionId; // 64
    uint32 inputAmount; // 96
    uint32 maxCost; // 128
  }

  // Emits ShortTrade
  function closeShort(uint params) external returns (uint totalCost) {
    OptionMarket optionMarket = idToMarket[uint8(params)];
    OptionMarketContracts memory c = marketContracts[optionMarket];
    OptionToken.PositionWithOwner memory position = c.optionToken.getPositionWithOwner(uint(uint32(params >> 32)));

    ERC20 inputAsset = idToERC[uint8(params >> 8)];
    OptionPositionParams memory positionParams = OptionPositionParams({
      optionMarket: optionMarket,
      strikeId: position.strikeId,
      positionId: position.positionId,
      iterations: _parseUint8(params >> 16),
      currentCollateral: position.collateral,
      setCollateralTo: 0,
      optionType: position.optionType,
      amount: position.amount,
      minCost: 0,
      maxCost: _parseUint32Amount(params >> 96),
      inputAmount: _convertDecimal(_parseUint32(params >> 64), inputAsset),
      inputAsset: inputAsset
    });

    ReturnDetails memory returnDetails = _closePosition(positionParams, (uint8(params >> 24) > 0));
    totalCost = returnDetails.totalCost;
  }

  ///////////
  // Utils //
  ///////////

  function _parseUint8(uint inp) internal pure returns (uint) {
    return uint(uint8(inp));
  }

  function _parseUint32Amount(uint inp) internal pure returns (uint) {
    return _parseUint32(inp) * 1e16;
  }

  function _parseUint32(uint inp) internal pure returns (uint) {
    return uint(uint32(inp));
  }

  function _parseUint64Amount(uint inp) internal pure returns (uint) {
    return uint(uint64(inp)) * 1e10;
  }

  function _convertDecimal(uint amount, ERC20 inputAsset) internal view returns (uint newAmount) {
    newAmount = amount * (10**(cachedDecimals[inputAsset] - 2)); // 2 dp
  }

  ////////////
  // Errors //
  ////////////

  error OnlyShorts(address thrower, OptionMarket.OptionType optionType);
}
