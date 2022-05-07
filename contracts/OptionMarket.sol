//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Libraries
import "./synthetix/DecimalMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

// Inherited
import "./synthetix/Owned.sol";
import "./lib/SimpleInitializeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SynthetixAdapter.sol";
import "./LiquidityPool.sol";
import "./OptionToken.sol";
import "./OptionGreekCache.sol";
import "./SynthetixAdapter.sol";
import "./ShortCollateral.sol";
import "./OptionMarketPricer.sol";

/**
 * @title OptionMarket
 * @author Lyra
 * @dev An AMM which allows users to trade options. Supports both buying and selling options. Also handles liquidating
 * short positions.
 */
contract OptionMarket is Owned, SimpleInitializeable, ReentrancyGuard {
  using DecimalMath for uint;

  enum TradeDirection {
    OPEN,
    CLOSE,
    LIQUIDATE
  }

  enum OptionType {
    LONG_CALL,
    LONG_PUT,
    SHORT_CALL_BASE,
    SHORT_CALL_QUOTE,
    SHORT_PUT_QUOTE
  }

  /// @notice For returning more specific errors
  enum NonZeroValues {
    BASE_IV,
    SKEW,
    STRIKE_PRICE,
    ITERATIONS
  }

  ///////////////////
  // Internal Data //
  ///////////////////

  struct Strike {
    uint id;
    uint strikePrice;
    uint skew;
    uint longCall;
    uint shortCallBase;
    uint shortCallQuote;
    uint longPut;
    uint shortPut;
    uint boardId;
  }

  struct OptionBoard {
    uint id;
    uint expiry;
    uint iv;
    bool frozen;
    uint[] strikeIds;
  }

  ///////////////
  // In-memory //
  ///////////////

  struct OptionMarketParameters {
    uint maxBoardExpiry;
    address securityModule;
    uint feePortionReserved;
  }

  struct TradeInputParameters {
    uint strikeId;
    uint positionId;
    uint iterations;
    OptionType optionType;
    uint amount;
    uint setCollateralTo;
    uint minTotalCost;
    uint maxTotalCost;
  }

  struct TradeParameters {
    bool isBuy;
    bool isForceClose;
    TradeDirection tradeDirection;
    OptionType optionType;
    uint amount;
    uint expiry;
    uint strikePrice;
    LiquidityPool.Liquidity liquidity;
    SynthetixAdapter.ExchangeParams exchangeParams;
  }

  struct TradeEventData {
    uint expiry;
    uint strikePrice;
    OptionType optionType;
    TradeDirection tradeDirection;
    uint amount;
    uint setCollateralTo;
    bool isForceClose;
    uint spotPrice;
    uint reservedFee;
    uint totalCost;
  }

  struct LiquidationEventData {
    address rewardBeneficiary;
    address caller;
    uint returnCollateral; // quote || base
    uint lpPremiums; // quote || base
    uint lpFee; // quote || base
    uint liquidatorFee; // quote || base
    uint smFee; // quote || base
    uint insolventAmount; // quote
  }

  struct Result {
    uint positionId;
    uint totalCost;
    uint totalFee;
  }

  ///////////////
  // Variables //
  ///////////////

  SynthetixAdapter internal synthetixAdapter;
  LiquidityPool internal liquidityPool;
  OptionMarketPricer internal optionPricer;
  OptionGreekCache internal greekCache;
  ShortCollateral internal shortCollateral;
  OptionToken internal optionToken;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;

  uint internal nextStrikeId = 1;
  uint internal nextBoardId = 1;
  uint[] internal liveBoards;

  OptionMarketParameters public optionMarketParams;

  mapping(uint => OptionBoard) internal optionBoards;
  mapping(uint => Strike) internal strikes;
  mapping(uint => uint) public boardToPriceAtExpiry;
  mapping(uint => uint) public strikeToBaseReturnedRatio;

  constructor() Owned() {}

  /**
   * @dev Initialize the contract.
   */
  function init(
    SynthetixAdapter _synthetixAdapter,
    LiquidityPool _liquidityPool,
    OptionMarketPricer _optionPricer,
    OptionGreekCache _greekCache,
    ShortCollateral _shortCollateral,
    OptionToken _optionToken,
    IERC20 _quoteAsset,
    IERC20 _baseAsset
  ) external onlyOwner initializer {
    synthetixAdapter = _synthetixAdapter;
    liquidityPool = _liquidityPool;
    optionPricer = _optionPricer;
    greekCache = _greekCache;
    shortCollateral = _shortCollateral;
    optionToken = _optionToken;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;
  }

  /////////////////////
  // Admin functions //
  /////////////////////

  /**
   * @dev Creates a new OptionBoard which contains Strikes.
   *
   * @param expiry The timestamp when the board expires.
   * @param baseIV The initial value for implied volatility.
   * @param strikePrices The array of strikePrices offered for this expiry.
   * @param skews The array of skews for each strikePrice.
   * @param frozen Whether the board is frozen or not at creation.
   */
  function createOptionBoard(
    uint expiry,
    uint baseIV,
    uint[] memory strikePrices,
    uint[] memory skews,
    bool frozen
  ) external onlyOwner returns (uint) {
    // strikePrice and skew length must match and must have at least 1
    if (strikePrices.length != skews.length || strikePrices.length == 0) {
      revert StrikeSkewLengthMismatch(address(this), strikePrices.length, skews.length);
    }

    if (expiry <= block.timestamp || expiry > block.timestamp + optionMarketParams.maxBoardExpiry) {
      revert InvalidExpiryTimestamp(address(this), block.timestamp, expiry, optionMarketParams.maxBoardExpiry);
    }

    if (baseIV == 0) {
      revert ExpectedNonZeroValue(address(this), NonZeroValues.BASE_IV);
    }

    uint boardId = nextBoardId++;
    OptionBoard storage board = optionBoards[boardId];
    board.id = boardId;
    board.expiry = expiry;
    board.iv = baseIV;
    board.frozen = frozen;

    liveBoards.push(boardId);

    emit BoardCreated(boardId, expiry, baseIV, frozen);

    Strike[] memory newStrikes = new Strike[](strikePrices.length);
    for (uint i = 0; i < strikePrices.length; i++) {
      newStrikes[i] = _addStrikeToBoard(board, strikePrices[i], skews[i]);
    }

    greekCache.addBoard(board, newStrikes);

    return boardId;
  }

  /**
   * @dev Sets the frozen state of an OptionBoard.
   * @param boardId The id of the OptionBoard.
   * @param frozen Whether the board will be frozen or not.
   */
  function setBoardFrozen(uint boardId, bool frozen) external onlyOwner {
    OptionBoard storage board = optionBoards[boardId];
    if (board.id != boardId) {
      revert InvalidBoardId(address(this), boardId);
    }
    optionBoards[boardId].frozen = frozen;
    emit BoardFrozen(boardId, frozen);
  }

  /**
   * @dev Sets the baseIv of a frozen OptionBoard.
   * @param boardId The id of the OptionBoard.
   * @param baseIv The new baseIv value.
   */
  function setBoardBaseIv(uint boardId, uint baseIv) external onlyOwner {
    OptionBoard storage board = optionBoards[boardId];
    if (board.id != boardId) {
      revert InvalidBoardId(address(this), boardId);
    }
    if (baseIv == 0) {
      revert ExpectedNonZeroValue(address(this), NonZeroValues.BASE_IV);
    }
    if (!board.frozen) {
      revert BoardNotFrozen(address(this), boardId);
    }

    board.iv = baseIv;
    greekCache.setBoardIv(boardId, baseIv);
    emit BoardBaseIvSet(boardId, baseIv);
  }

  /**
   * @dev Sets the skew of an Strike of a frozen OptionBoard.
   * @param strikeId The id of the strike being modified.
   * @param skew The new skew value.
   */
  function setStrikeSkew(uint strikeId, uint skew) external onlyOwner {
    Strike storage strike = strikes[strikeId];
    if (strike.id != strikeId) {
      revert InvalidStrikeId(address(this), strikeId);
    }
    if (skew == 0) {
      revert ExpectedNonZeroValue(address(this), NonZeroValues.SKEW);
    }

    OptionBoard memory board = optionBoards[strike.boardId];
    if (!board.frozen) {
      revert BoardNotFrozen(address(this), board.id);
    }

    strike.skew = skew;
    greekCache.setStrikeSkew(strikeId, skew);
    emit StrikeSkewSet(strikeId, skew);
  }

  /**
   * @dev Add a strike to an existing board in the OptionMarket.
   *
   * @param boardId The id of the board which the strike will be added
   * @param strikePrice Strike of the Strike
   * @param skew Skew of the Strike
   */
  function addStrikeToBoard(
    uint boardId,
    uint strikePrice,
    uint skew
  ) external onlyOwner {
    OptionBoard storage board = optionBoards[boardId];
    if (board.id != boardId) revert InvalidBoardId(address(this), boardId);
    Strike memory strike = _addStrikeToBoard(board, strikePrice, skew);
    greekCache.addStrikeToBoard(boardId, strike.id, strikePrice, skew);
  }

  /**
   * @dev Add a strike to an existing board.
   */
  function _addStrikeToBoard(
    OptionBoard storage board,
    uint strikePrice,
    uint skew
  ) internal returns (Strike memory) {
    if (strikePrice == 0) {
      revert ExpectedNonZeroValue(address(this), NonZeroValues.STRIKE_PRICE);
    }
    if (skew == 0) {
      revert ExpectedNonZeroValue(address(this), NonZeroValues.SKEW);
    }

    uint strikeId = nextStrikeId++;
    strikes[strikeId] = Strike(strikeId, strikePrice, skew, 0, 0, 0, 0, 0, board.id);
    board.strikeIds.push(strikeId);
    emit StrikeAdded(board.id, strikeId, strikePrice, skew);
    return strikes[strikeId];
  }

  function forceSettleBoard(uint boardId) external onlyOwner {
    OptionBoard memory board = optionBoards[boardId];
    if (board.id != boardId) {
      revert InvalidBoardId(address(this), boardId);
    }
    if (!board.frozen) {
      revert BoardNotFrozen(address(this), boardId);
    }
    _clearAndSettleBoard(board);
  }

  function setOptionMarketParams(OptionMarketParameters memory _optionMarketParams) external onlyOwner {
    if (_optionMarketParams.feePortionReserved > DecimalMath.UNIT) {
      revert InvalidOptionMarketParams(address(this), _optionMarketParams);
    }
    optionMarketParams = _optionMarketParams;
    emit OptionMarketParamsSet(optionMarketParams);
  }

  function smClaim() external {
    if (msg.sender != optionMarketParams.securityModule) {
      revert OnlySecurityModule(address(this), msg.sender, optionMarketParams.securityModule);
    }
    uint quoteBal = quoteAsset.balanceOf(address(this));
    if (quoteBal > 0) {
      quoteAsset.transfer(msg.sender, quoteBal);
    }
    // While fees cannot accrue in base, this can help reclaim any accidental transfers into this contract
    uint baseBal = baseAsset.balanceOf(address(this));
    if (baseBal > 0) {
      baseAsset.transfer(msg.sender, baseBal);
    }
    emit SMClaimed(msg.sender, quoteBal, baseBal);
  }

  ///////////
  // Views //
  ///////////

  /**
   * @dev Returns the list of live board ids.
   */
  function getLiveBoards() external view returns (uint[] memory _liveBoards) {
    _liveBoards = new uint[](liveBoards.length);
    for (uint i = 0; i < liveBoards.length; i++) {
      _liveBoards[i] = liveBoards[i];
    }
  }

  function getNumLiveBoards() external view returns (uint numLiveBoards) {
    return liveBoards.length;
  }

  function getStrikeAndExpiry(uint strikeId) external view returns (uint strikePrice, uint expiry) {
    return (strikes[strikeId].strikePrice, optionBoards[strikes[strikeId].boardId].expiry);
  }

  /**
   * @dev Returns the strike ids for a given `boardId`.
   *
   * @param boardId The id of the relevant OptionBoard.
   */
  function getBoardStrikes(uint boardId) external view returns (uint[] memory) {
    uint[] memory strikeIds = new uint[](optionBoards[boardId].strikeIds.length);
    for (uint i = 0; i < optionBoards[boardId].strikeIds.length; i++) {
      strikeIds[i] = optionBoards[boardId].strikeIds[i];
    }
    return strikeIds;
  }

  function getStrike(uint strikeId) external view returns (Strike memory) {
    return strikes[strikeId];
  }

  function getOptionBoard(uint boardId) external view returns (OptionBoard memory) {
    return optionBoards[boardId];
  }

  function getStrikeAndBoard(uint strikeId) external view returns (Strike memory, OptionBoard memory) {
    Strike memory strike = strikes[strikeId];
    return (strike, optionBoards[strike.boardId]);
  }

  function getBoardAndStrikeDetails(uint boardId)
    external
    view
    returns (
      OptionBoard memory,
      Strike[] memory,
      uint[] memory,
      uint
    )
  {
    OptionBoard memory board = optionBoards[boardId];
    Strike[] memory boardStrikes = new Strike[](board.strikeIds.length);
    uint[] memory strikeToBaseReturnedRatios = new uint[](board.strikeIds.length);
    for (uint i = 0; i < board.strikeIds.length; i++) {
      boardStrikes[i] = strikes[board.strikeIds[i]];
      strikeToBaseReturnedRatios[i] = strikeToBaseReturnedRatio[board.strikeIds[i]];
    }
    return (board, boardStrikes, strikeToBaseReturnedRatios, boardToPriceAtExpiry[boardId]);
  }

  ////////////////////
  // User functions //
  ////////////////////

  function openPosition(TradeInputParameters memory params) external nonReentrant returns (Result memory result) {
    result = _openPosition(params);
    _checkCostInBounds(result.totalCost, params.minTotalCost, params.maxTotalCost);
  }

  function closePosition(TradeInputParameters memory params) external nonReentrant returns (Result memory result) {
    result = _closePosition(params, false);
    _checkCostInBounds(result.totalCost, params.minTotalCost, params.maxTotalCost);
  }

  function forceClosePosition(TradeInputParameters memory params) external nonReentrant returns (Result memory result) {
    result = _closePosition(params, true);
    _checkCostInBounds(result.totalCost, params.minTotalCost, params.maxTotalCost);
  }

  function addCollateral(uint positionId, uint amountCollateral) external nonReentrant {
    int pendingCollateral = int(amountCollateral);
    OptionType optionType = optionToken.addCollateral(positionId, amountCollateral);
    _routeUserCollateral(optionType, pendingCollateral);
  }

  function _checkCostInBounds(
    uint totalCost,
    uint minCost,
    uint maxCost
  ) internal view {
    if (totalCost < minCost || totalCost > maxCost) {
      revert TotalCostOutsideOfSpecifiedBounds(address(this), totalCost, minCost, maxCost);
    }
  }

  /////////////////////////
  // Opening and Closing //
  /////////////////////////

  /**
   * @dev Opens a position, which may be long call, long put, short call or short put.
   */
  function _openPosition(TradeInputParameters memory params) internal returns (Result memory result) {
    (TradeParameters memory trade, Strike storage strike, OptionBoard storage board) = _composeTrade(
      params.strikeId,
      params.optionType,
      params.amount,
      TradeDirection.OPEN,
      params.iterations,
      false
    );
    OptionMarketPricer.TradeResult[] memory tradeResults;
    (trade.amount, result.totalCost, result.totalFee, tradeResults) = _doTrade(
      strike,
      board,
      trade,
      params.iterations,
      params.amount
    );

    int pendingCollateral;
    // collateral logic happens within optionToken
    (result.positionId, pendingCollateral) = optionToken.adjustPosition(
      trade,
      params.strikeId,
      msg.sender,
      params.positionId,
      result.totalCost,
      params.setCollateralTo,
      true
    );

    uint reservedFee = result.totalFee.multiplyDecimal(optionMarketParams.feePortionReserved);

    _routeLPFundsOnOpen(trade, result.totalCost, reservedFee);
    _routeUserCollateral(trade.optionType, pendingCollateral);
    liquidityPool.updateCBs();

    emit Trade(
      msg.sender,
      params.strikeId,
      result.positionId,
      TradeEventData({
        expiry: trade.expiry,
        strikePrice: trade.strikePrice,
        optionType: params.optionType,
        tradeDirection: TradeDirection.OPEN,
        amount: trade.amount,
        setCollateralTo: params.setCollateralTo,
        isForceClose: false,
        spotPrice: trade.exchangeParams.spotPrice,
        reservedFee: reservedFee,
        totalCost: result.totalCost
      }),
      tradeResults,
      LiquidationEventData(address(0), address(0), 0, 0, 0, 0, 0, 0),
      block.timestamp
    );
  }

  /**
   * @dev Closes some amount of an open position. The user does not have to close the whole position.
   *
   */
  function _closePosition(TradeInputParameters memory params, bool forceClose) internal returns (Result memory result) {
    (TradeParameters memory trade, Strike storage strike, OptionBoard storage board) = _composeTrade(
      params.strikeId,
      params.optionType,
      params.amount,
      TradeDirection.CLOSE,
      params.iterations,
      forceClose
    );

    OptionMarketPricer.TradeResult[] memory tradeResults;
    (trade.amount, result.totalCost, result.totalFee, tradeResults) = _doTrade(
      strike,
      board,
      trade,
      params.iterations,
      params.amount
    );

    int pendingCollateral;
    // collateral logic happens within optionToken
    (result.positionId, pendingCollateral) = optionToken.adjustPosition(
      trade,
      params.strikeId,
      msg.sender,
      params.positionId,
      result.totalCost,
      params.setCollateralTo,
      false
    );

    uint reservedFee = result.totalFee.multiplyDecimal(optionMarketParams.feePortionReserved);

    _routeUserCollateral(trade.optionType, pendingCollateral);
    _routeLPFundsOnClose(trade, result.totalCost, reservedFee);
    liquidityPool.updateCBs();

    emit Trade(
      msg.sender,
      params.strikeId,
      result.positionId,
      TradeEventData({
        expiry: trade.expiry,
        strikePrice: trade.strikePrice,
        optionType: params.optionType,
        tradeDirection: TradeDirection.CLOSE,
        amount: params.amount,
        setCollateralTo: params.setCollateralTo,
        isForceClose: forceClose,
        reservedFee: reservedFee,
        spotPrice: trade.exchangeParams.spotPrice,
        totalCost: result.totalCost
      }),
      tradeResults,
      LiquidationEventData(address(0), address(0), 0, 0, 0, 0, 0, 0),
      block.timestamp
    );
  }

  /**
   * @dev Compile all trade related details
   */
  function _composeTrade(
    uint _strikeId,
    OptionType optionType,
    uint amount,
    TradeDirection _tradeDirection,
    uint iterations,
    bool isForceClose
  )
    internal
    view
    returns (
      TradeParameters memory trade,
      Strike storage strike,
      OptionBoard storage board
    )
  {
    if (iterations == 0) {
      revert ExpectedNonZeroValue(address(this), NonZeroValues.ITERATIONS);
    }

    strike = strikes[_strikeId];
    if (strike.id != _strikeId) {
      revert InvalidStrikeId(address(this), _strikeId);
    }
    board = optionBoards[strike.boardId];

    bool isBuy = (_tradeDirection == TradeDirection.OPEN) ? _isLong(optionType) : !_isLong(optionType);

    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(this));

    trade = TradeParameters({
      isBuy: isBuy,
      isForceClose: isForceClose,
      tradeDirection: _tradeDirection,
      optionType: optionType,
      amount: amount / iterations,
      expiry: board.expiry,
      strikePrice: strike.strikePrice,
      exchangeParams: exchangeParams,
      liquidity: liquidityPool.getLiquidity(exchangeParams.spotPrice, exchangeParams.short)
    });
  }

  function _isLong(OptionType optionType) internal pure returns (bool) {
    return (optionType == OptionType.LONG_CALL || optionType == OptionType.LONG_PUT);
  }

  /**
   * @dev Determine the cost of the trade and update the system's iv/skew/exposure parameters.
   *
   * @param strike The relevant Strike.
   * @param board The relevant OptionBoard.
   * @param trade The trade parameters.
   */
  function _doTrade(
    Strike storage strike,
    OptionBoard storage board,
    TradeParameters memory trade,
    uint iterations,
    uint expectedAmount
  )
    internal
    returns (
      uint totalAmount,
      uint totalCost,
      uint totalFee,
      OptionMarketPricer.TradeResult[] memory tradeResults
    )
  {
    // don't engage AMM if only collateral is added/removed
    if (trade.amount == 0) {
      if (expectedAmount != 0) {
        revert TradeIterationsHasRemainder(address(this), iterations, expectedAmount, 0, 0);
      }
      return (0, 0, 0, new OptionMarketPricer.TradeResult[](0));
    }

    if (board.frozen) {
      revert BoardIsFrozen(address(this), board.id);
    }
    if (board.expiry < block.timestamp) {
      revert BoardExpired(address(this), board.id, board.expiry, block.timestamp);
    }

    tradeResults = new OptionMarketPricer.TradeResult[](iterations);

    for (uint i = 0; i < iterations; i++) {
      if (i == iterations - 1) {
        trade.amount = expectedAmount - totalAmount;
      }
      _updateExposure(trade.amount, trade.optionType, strike, trade.tradeDirection == TradeDirection.OPEN);

      OptionMarketPricer.TradeResult memory tradeResult = optionPricer.updateCacheAndGetTradeResult(
        strike,
        trade,
        board.iv,
        board.expiry
      );

      board.iv = tradeResult.newBaseIv;
      strike.skew = tradeResult.newSkew;

      totalCost += tradeResult.totalCost;
      totalFee += tradeResult.totalFee;
      totalAmount += trade.amount;

      tradeResults[i] = tradeResult;
    }

    return (totalAmount, totalCost, totalFee, tradeResults);
  }

  error TradeIterationsHasRemainder(
    address thrower,
    uint iterations,
    uint expectedAmount,
    uint tradeAmount,
    uint totalAmount
  );

  /////////////////
  // Liquidation //
  /////////////////

  function liquidatePosition(uint positionId, address rewardBeneficiary) external nonReentrant {
    OptionToken.PositionWithOwner memory position = optionToken.getPositionWithOwner(positionId);

    (TradeParameters memory trade, Strike storage strike, OptionBoard storage board) = _composeTrade(
      position.strikeId,
      position.optionType,
      position.amount,
      TradeDirection.LIQUIDATE,
      1,
      true
    );

    // updating AMM but disregarding the spotCost
    (, uint totalCost, , OptionMarketPricer.TradeResult[] memory tradeResults) = _doTrade(
      strike,
      board,
      trade,
      1,
      position.amount
    );

    OptionToken.LiquidationFees memory liquidationFees = optionToken.liquidate(positionId, trade, totalCost);

    if (liquidationFees.insolventAmount > 0) {
      liquidityPool.updateLiquidationInsolvency(liquidationFees.insolventAmount);
    }

    shortCollateral.routeLiquidationFunds(position.owner, rewardBeneficiary, position.optionType, liquidationFees);
    liquidityPool.updateCBs();

    emit Trade(
      position.owner,
      position.strikeId,
      positionId,
      TradeEventData({
        expiry: trade.expiry,
        strikePrice: trade.strikePrice,
        optionType: position.optionType,
        tradeDirection: TradeDirection.LIQUIDATE,
        amount: position.amount,
        setCollateralTo: 0,
        isForceClose: true,
        spotPrice: trade.exchangeParams.spotPrice,
        reservedFee: 0,
        totalCost: totalCost
      }),
      tradeResults,
      LiquidationEventData({
        caller: msg.sender,
        rewardBeneficiary: rewardBeneficiary,
        returnCollateral: liquidationFees.returnCollateral,
        lpPremiums: liquidationFees.lpPremiums,
        lpFee: liquidationFees.lpFee,
        liquidatorFee: liquidationFees.liquidatorFee,
        smFee: liquidationFees.smFee,
        insolventAmount: liquidationFees.insolventAmount
      }),
      block.timestamp
    );
  }

  //////////////////
  // Fund routing //
  //////////////////

  function _routeLPFundsOnOpen(
    TradeParameters memory trade,
    uint totalCost,
    uint feePortion
  ) internal {
    if (trade.amount == 0) {
      return;
    }

    if (trade.optionType == OptionType.LONG_CALL) {
      liquidityPool.lockBase(trade.amount, trade.exchangeParams, trade.liquidity.freeLiquidity);
      _transferFromQuote(msg.sender, address(liquidityPool), totalCost - feePortion);
      _transferFromQuote(msg.sender, address(this), feePortion);
    } else if (trade.optionType == OptionType.LONG_PUT) {
      liquidityPool.lockQuote(trade.amount.multiplyDecimal(trade.strikePrice), trade.liquidity.freeLiquidity);
      _transferFromQuote(msg.sender, address(liquidityPool), totalCost - feePortion);
      _transferFromQuote(msg.sender, address(this), feePortion);
    } else if (trade.optionType == OptionType.SHORT_CALL_BASE) {
      liquidityPool.sendShortPremium(msg.sender, totalCost, trade.liquidity.freeLiquidity, feePortion);
    } else {
      // OptionType.SHORT_CALL_QUOTE || OptionType.SHORT_PUT_QUOTE
      liquidityPool.sendShortPremium(address(shortCollateral), totalCost, trade.liquidity.freeLiquidity, feePortion);
    }
  }

  function _routeLPFundsOnClose(
    TradeParameters memory trade,
    uint totalCost,
    uint reservedFee
  ) internal {
    if (trade.amount == 0) {
      return;
    }

    if (trade.optionType == OptionType.LONG_CALL) {
      liquidityPool.liquidateBaseAndSendPremium(trade.amount, msg.sender, totalCost, reservedFee);
    } else if (trade.optionType == OptionType.LONG_PUT) {
      liquidityPool.freeQuoteCollateralAndSendPremium(
        trade.amount.multiplyDecimal(trade.strikePrice),
        msg.sender,
        totalCost,
        reservedFee
      );
    } else if (trade.optionType == OptionType.SHORT_CALL_BASE) {
      _transferFromQuote(msg.sender, address(liquidityPool), totalCost - reservedFee);
      _transferFromQuote(msg.sender, address(this), reservedFee);
    } else {
      // OptionType.SHORT_CALL_QUOTE || OptionType.SHORT_PUT_QUOTE
      shortCollateral.sendQuoteCollateral(address(liquidityPool), totalCost - reservedFee);
      shortCollateral.sendQuoteCollateral(address(this), reservedFee);
    }
  }

  /// @dev cannot be called with any optionType other than a short with > 0 pendingCollateral
  function _routeUserCollateral(OptionType optionType, int pendingCollateral) internal {
    if (pendingCollateral == 0) {
      return;
    }

    if (optionType == OptionType.SHORT_CALL_BASE) {
      if (pendingCollateral > 0) {
        if (!baseAsset.transferFrom(msg.sender, address(shortCollateral), uint(pendingCollateral))) {
          revert BaseTransferFailed(address(this), msg.sender, address(shortCollateral), uint(pendingCollateral));
        }
      } else {
        shortCollateral.sendBaseCollateral(msg.sender, uint(-pendingCollateral));
      }
    } else {
      // quote collateral
      if (pendingCollateral > 0) {
        _transferFromQuote(msg.sender, address(shortCollateral), uint(pendingCollateral));
      } else {
        shortCollateral.sendQuoteCollateral(msg.sender, uint(-pendingCollateral));
      }
    }
  }

  function _updateExposure(
    uint amount,
    OptionType optionType,
    Strike storage strike,
    bool isOpen
  ) internal {
    int exposure = isOpen ? int(amount) : -int(amount);

    if (optionType == OptionType.LONG_CALL) {
      exposure += int(strike.longCall);
      strike.longCall = SafeCast.toUint256(exposure);
    } else if (optionType == OptionType.LONG_PUT) {
      exposure += int(strike.longPut);
      strike.longPut = SafeCast.toUint256(exposure);
    } else if (optionType == OptionType.SHORT_CALL_BASE) {
      exposure += int(strike.shortCallBase);
      strike.shortCallBase = SafeCast.toUint256(exposure);
    } else if (optionType == OptionType.SHORT_CALL_QUOTE) {
      exposure += int(strike.shortCallQuote);
      strike.shortCallQuote = SafeCast.toUint256(exposure);
    } else {
      // OptionType.SHORT_PUT_QUOTE
      exposure += int(strike.shortPut);
      strike.shortPut = SafeCast.toUint256(exposure);
    }
  }

  /////////////////////////////////
  // Board Expiry and settlement //
  /////////////////////////////////

  /**
   * @dev Settle a board that has passed expiry. This function will not preserve the ordering of liveBoards.
   *
   * @param boardId The id of the relevant OptionBoard.
   */
  function settleExpiredBoard(uint boardId) external nonReentrant {
    OptionBoard memory board = optionBoards[boardId];
    if (board.id != boardId) {
      revert InvalidBoardId(address(this), boardId);
    }
    if (board.expiry > block.timestamp) {
      revert BoardNotExpired(address(this), boardId);
    }
    _clearAndSettleBoard(board);
  }

  function _clearAndSettleBoard(OptionBoard memory board) internal {
    bool popped = false;
    // Find and remove the board from the list of live boards
    for (uint i = 0; i < liveBoards.length; i++) {
      if (liveBoards[i] == board.id) {
        liveBoards[i] = liveBoards[liveBoards.length - 1];
        liveBoards.pop();
        popped = true;
        break;
      }
    }
    // prevent old boards being liquidated
    if (!popped) {
      revert BoardAlreadySettled(address(this), board.id);
    }

    _settleExpiredBoard(board);
    greekCache.removeBoard(board.id);
  }

  /**
   * @dev Liquidates an expired board.
   * It will transfer all short collateral for ITM options that the market owns.
   * It will reserve collateral for users to settle their ITM long options.
   *
   * @param board The relevant OptionBoard.
   */
  function _settleExpiredBoard(OptionBoard memory board) internal {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(this));

    uint totalUserLongProfitQuote;
    uint totalBoardLongCallCollateral;
    uint totalBoardLongPutCollateral;
    uint totalAMMShortCallProfitBase;
    uint totalAMMShortCallProfitQuote;
    uint totalAMMShortPutProfitQuote;

    // Store the price now for when users come to settle their options
    boardToPriceAtExpiry[board.id] = exchangeParams.spotPrice;

    for (uint i = 0; i < board.strikeIds.length; i++) {
      Strike memory strike = strikes[board.strikeIds[i]];

      totalBoardLongCallCollateral += strike.longCall;
      totalBoardLongPutCollateral += strike.longPut.multiplyDecimal(strike.strikePrice);

      if (exchangeParams.spotPrice > strike.strikePrice) {
        // For long calls
        totalUserLongProfitQuote += strike.longCall.multiplyDecimal(exchangeParams.spotPrice - strike.strikePrice);

        // Per unit of shortCalls
        uint baseReturnedRatio = (exchangeParams.spotPrice - strike.strikePrice)
          .divideDecimal(exchangeParams.spotPrice)
          .divideDecimal(DecimalMath.UNIT - exchangeParams.baseQuoteFeeRate);

        // This is impossible unless the baseAsset price has gone up ~900%+
        baseReturnedRatio = baseReturnedRatio > DecimalMath.UNIT ? DecimalMath.UNIT : baseReturnedRatio;

        totalAMMShortCallProfitBase += baseReturnedRatio.multiplyDecimal(strike.shortCallBase);
        totalAMMShortCallProfitQuote += (exchangeParams.spotPrice - strike.strikePrice).multiplyDecimal(
          strike.shortCallQuote
        );
        strikeToBaseReturnedRatio[strike.id] = baseReturnedRatio;
      } else if (exchangeParams.spotPrice < strike.strikePrice) {
        // if amount > 0 can be skipped as it will be multiplied by 0
        totalUserLongProfitQuote += strike.longPut.multiplyDecimal(strike.strikePrice - exchangeParams.spotPrice);
        totalAMMShortPutProfitQuote += (strike.strikePrice - exchangeParams.spotPrice).multiplyDecimal(strike.shortPut);
      }
    }

    (uint lpBaseInsolvency, uint lpQuoteInsolvency) = shortCollateral.boardSettlement(
      totalAMMShortCallProfitBase,
      totalAMMShortPutProfitQuote + totalAMMShortCallProfitQuote
    );

    // This will batch all base we want to convert to quote and sell it in one transaction
    liquidityPool.boardSettlement(
      lpQuoteInsolvency + lpBaseInsolvency.multiplyDecimal(exchangeParams.spotPrice),
      totalBoardLongPutCollateral,
      totalUserLongProfitQuote,
      totalBoardLongCallCollateral
    );

    emit BoardSettled(
      board.id,
      exchangeParams.spotPrice,
      totalUserLongProfitQuote,
      totalBoardLongCallCollateral,
      totalBoardLongPutCollateral,
      totalAMMShortCallProfitBase,
      totalAMMShortCallProfitQuote,
      totalAMMShortPutProfitQuote
    );
  }

  function getSettlementParameters(uint strikeId)
    external
    view
    returns (
      uint strikePrice,
      uint priceAtExpiry,
      uint strikeToBaseReturned
    )
  {
    return (
      strikes[strikeId].strikePrice,
      boardToPriceAtExpiry[strikes[strikeId].boardId],
      strikeToBaseReturnedRatio[strikeId]
    );
  }

  //////////
  // Misc //
  //////////

  function _transferFromQuote(
    address from,
    address to,
    uint amount
  ) internal {
    if (!quoteAsset.transferFrom(from, to, amount)) {
      revert QuoteTransferFailed(address(this), from, to, amount);
    }
  }

  ////////////
  // Events //
  ////////////

  /**
   * @dev Emitted when a Board is created.
   */
  event BoardCreated(uint indexed boardId, uint expiry, uint baseIv, bool frozen);

  /**
   * @dev Emitted when a Board frozen is updated.
   */
  event BoardFrozen(uint indexed boardId, bool frozen);

  /**
   * @dev Emitted when a Board new baseIv is set.
   */
  event BoardBaseIvSet(uint indexed boardId, uint baseIv);

  /**
   * @dev Emitted when a Strike new skew is set.
   */
  event StrikeSkewSet(uint indexed strikeId, uint skew);

  /**
   * @dev Emitted when a Strike is added to a board
   */
  event StrikeAdded(uint indexed boardId, uint indexed strikeId, uint strikePrice, uint skew);

  /**
   * @dev Emitted when parameters for the option market are adjusted
   */
  event OptionMarketParamsSet(OptionMarketParameters optionMarketParams);

  /**
   * @dev Emitted whenever the security module claims their portion of fees
   */
  event SMClaimed(address securityModule, uint quoteAmount, uint baseAmount);

  /**
   * @dev Emitted when a Position is opened, closed or liquidated.
   */
  event Trade(
    address indexed trader,
    uint indexed strikeId,
    uint indexed positionId,
    TradeEventData trade,
    OptionMarketPricer.TradeResult[] tradeResults,
    LiquidationEventData liquidation,
    uint timestamp
  );

  /**
   * @dev Emitted when a Board is liquidated.
   */
  event BoardSettled(
    uint indexed boardId,
    uint spotPriceAtExpiry,
    uint totalUserLongProfitQuote,
    uint totalBoardLongCallCollateral,
    uint totalBoardLongPutCollateral,
    uint totalAMMShortCallProfitBase,
    uint totalAMMShortCallProfitQuote,
    uint totalAMMShortPutProfitQuote
  );

  ////////////
  // Errors //
  ////////////
  // General purpose
  error ExpectedNonZeroValue(address thrower, NonZeroValues valueType);

  // Admin
  error InvalidOptionMarketParams(address thrower, OptionMarketParameters optionMarketParams);

  // Board related
  error InvalidBoardId(address thrower, uint boardId);
  error InvalidExpiryTimestamp(address thrower, uint currentTime, uint expiry, uint maxBoardExpiry);
  error BoardNotFrozen(address thrower, uint boardId);
  error BoardAlreadySettled(address thrower, uint boardId);
  error BoardNotExpired(address thrower, uint boardId);

  // Strike related
  error InvalidStrikeId(address thrower, uint strikeId);
  error StrikeSkewLengthMismatch(address thrower, uint strikesLength, uint skewsLength);

  // Trade
  error TotalCostOutsideOfSpecifiedBounds(address thrower, uint totalCost, uint minCost, uint maxCost);
  error BoardIsFrozen(address thrower, uint boardId);
  error BoardExpired(address thrower, uint boardId, uint boardExpiry, uint currentTime);

  // Access
  error OnlySecurityModule(address thrower, address caller, address securityModule);

  // Token transfers
  error BaseTransferFailed(address thrower, address from, address to, uint amount);
  error QuoteTransferFailed(address thrower, address from, address to, uint amount);
}
