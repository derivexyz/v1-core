//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "../OptionMarket.sol";
import "../lib/BlackScholes.sol";
import "../synthetix/DecimalMath.sol";
import "../OptionToken.sol";
import "../LiquidityPool.sol";
import "../OptionGreekCache.sol";
import "../OptionMarketPricer.sol";
import "../SynthetixAdapter.sol";

// Inherited
import "../synthetix/Owned.sol";

/**
 * @title OptionMarketViewer
 * @author Lyra
 * @dev Provides helpful functions to allow the dapp to operate more smoothly; logic in getPremiumForTrade is vital to
 * ensuring accurate prices are provided to the user.
 */
contract OptionMarketViewer is Owned {
  struct MarketsView {
    IAddressResolver addressResolver;
    bool isPaused;
    MarketView[] markets;
  }

  struct MarketView {
    bool isPaused;
    uint totalQueuedDeposits;
    uint totalQueuedWithdrawals;
    uint tokenPrice;
    OptionMarketAddresses marketAddresses;
    MarketParameters marketParameters;
    LiquidityPool.Liquidity liquidity;
    OptionGreekCache.NetGreeks globalNetGreeks;
    SynthetixAdapter.ExchangeParams exchangeParams;
  }

  struct MarketViewWithBoards {
    bool isPaused;
    uint totalQueuedDeposits;
    uint totalQueuedWithdrawals;
    uint tokenPrice;
    OptionMarketAddresses marketAddresses;
    MarketParameters marketParameters;
    LiquidityPool.Liquidity liquidity;
    OptionGreekCache.NetGreeks globalNetGreeks;
    BoardView[] liveBoards;
    SynthetixAdapter.ExchangeParams exchangeParams;
  }

  struct MarketParameters {
    LiquidityPool.LiquidityPoolParameters lpParams;
    OptionGreekCache.GreekCacheParameters greekCacheParams;
    OptionGreekCache.ForceCloseParameters forceCloseParams;
    OptionGreekCache.MinCollateralParameters minCollatParams;
    OptionMarketPricer.PricingParameters pricingParams;
    OptionMarketPricer.TradeLimitParameters tradeLimitParams;
    OptionMarketPricer.VarianceFeeParameters varianceFeeParams;
    OptionToken.PartialCollateralParameters partialCollatParams;
    PoolHedger.PoolHedgerParameters poolHedgerParams;
  }

  struct StrikeView {
    uint strikeId;
    uint boardId;
    uint strikePrice;
    uint skew;
    uint forceCloseSkew;
    OptionGreekCache.StrikeGreeks cachedGreeks;
    uint baseReturnedRatio;
    uint longCallOpenInterest;
    uint longPutOpenInterest;
    uint shortCallBaseOpenInterest;
    uint shortCallQuoteOpenInterest;
    uint shortPutOpenInterest;
  }

  struct BoardView {
    address market;
    uint boardId;
    uint expiry;
    uint baseIv;
    uint priceAtExpiry;
    bool isPaused;
    uint forceCloseGwavIV;
    OptionGreekCache.NetGreeks netGreeks;
    StrikeView[] strikes;
  }

  struct MarketOptionPositions {
    address market;
    OptionToken.OptionPosition[] positions;
  }

  struct OptionMarketAddresses {
    LiquidityPool liquidityPool;
    LiquidityTokens liquidityTokens;
    OptionGreekCache greekCache;
    OptionMarket optionMarket;
    OptionMarketPricer optionMarketPricer;
    OptionToken optionToken;
    ShortCollateral shortCollateral;
    PoolHedger poolHedger;
    IERC20 quoteAsset;
    IERC20 baseAsset;
  }

  struct LiquidityBalanceAndAllowance {
    address token;
    uint balance;
    uint allowance;
  }

  SynthetixAdapter public synthetixAdapter;
  bool public initialized = false;
  OptionMarket[] public optionMarkets;
  mapping(OptionMarket => OptionMarketAddresses) public marketAddresses;

  constructor() Owned() {}

  /**
   * @dev Initializes the contract
   * @param _synthetixAdapter SynthetixAdapter contract address
   */
  function init(SynthetixAdapter _synthetixAdapter) external {
    require(!initialized, "already initialized");
    synthetixAdapter = _synthetixAdapter;
    initialized = true;
  }

  function addMarket(OptionMarketAddresses memory newMarketAddresses) external onlyOwner {
    optionMarkets.push(newMarketAddresses.optionMarket);
    marketAddresses[newMarketAddresses.optionMarket] = newMarketAddresses;
    emit MarketAdded(newMarketAddresses);
  }

  function removeMarket(OptionMarket market) external onlyOwner {
    // do something with marketAddresses ?
    uint index = 0;
    for (uint i = 0; i < optionMarkets.length; i++) {
      if (optionMarkets[i] == market) index = i;
    }
    optionMarkets[index] = optionMarkets[optionMarkets.length - 1];
    optionMarkets.pop();

    emit MarketRemoved(market);
    delete marketAddresses[market];
  }

  function getMarketAddresses() external view returns (OptionMarketAddresses[] memory) {
    uint marketsLen = optionMarkets.length;
    OptionMarketAddresses[] memory res = new OptionMarketAddresses[](marketsLen);
    for (uint i = 0; i < marketsLen; i++) {
      res[i] = marketAddresses[optionMarkets[i]];
    }
    return res;
  }

  function getMarkets(OptionMarket[] memory markets) external view returns (MarketsView memory) {
    MarketView[] memory marketViews = new MarketView[](markets.length);
    bool isGlobalPaused = synthetixAdapter.isGlobalPaused();
    for (uint i = 0; i < markets.length; i++) {
      OptionMarketAddresses memory marketC = marketAddresses[markets[i]];
      marketViews[i] = _getMarket(marketC, isGlobalPaused);
    }
    return
      MarketsView({
        addressResolver: synthetixAdapter.addressResolver(),
        isPaused: isGlobalPaused,
        markets: marketViews
      });
  }

  function getMarketForBaseKey(bytes32 baseKey) public view returns (MarketViewWithBoards memory market) {
    for (uint i = 0; i < optionMarkets.length; i++) {
      OptionMarketAddresses memory marketC = marketAddresses[optionMarkets[i]];
      bytes32 marketBaseKey = synthetixAdapter.baseKey(address(marketC.optionMarket));
      if (marketBaseKey == baseKey) {
        market = getMarket(marketC.optionMarket);
        break;
      }
    }
    require(address(market.marketAddresses.optionMarket) != address(0), "No market for base key");
  }

  function getMarket(OptionMarket market) public view returns (MarketViewWithBoards memory) {
    OptionMarketAddresses memory marketC = marketAddresses[market];
    MarketView memory marketView = _getMarket(marketC, synthetixAdapter.isGlobalPaused());
    return
      MarketViewWithBoards({
        marketAddresses: marketView.marketAddresses,
        isPaused: marketView.isPaused,
        liveBoards: getLiveBoards(marketC.optionMarket),
        marketParameters: marketView.marketParameters,
        totalQueuedDeposits: marketView.totalQueuedDeposits,
        totalQueuedWithdrawals: marketView.totalQueuedWithdrawals,
        tokenPrice: marketView.tokenPrice,
        liquidity: marketView.liquidity,
        globalNetGreeks: marketView.globalNetGreeks,
        exchangeParams: marketView.exchangeParams
      });
  }

  function _getMarket(OptionMarketAddresses memory marketC, bool isGlobalPaused)
    internal
    view
    returns (MarketView memory)
  {
    OptionGreekCache.GlobalCache memory globalCache = marketC.greekCache.getGlobalCache();
    MarketParameters memory marketParameters = _getMarketParams(marketC);
    bool isMarketPaused = synthetixAdapter.isMarketPaused(address(marketC.optionMarket));
    if (!isMarketPaused && !isGlobalPaused) {
      SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(
        address(marketC.optionMarket)
      );
      return
        MarketView({
          marketAddresses: marketC,
          isPaused: isMarketPaused,
          marketParameters: marketParameters,
          totalQueuedDeposits: marketC.liquidityPool.totalQueuedDeposits(),
          totalQueuedWithdrawals: marketC.liquidityPool.totalQueuedWithdrawals(),
          tokenPrice: marketC.liquidityPool.getTokenPrice(),
          liquidity: marketC.liquidityPool.getLiquidity(exchangeParams.spotPrice, exchangeParams.short),
          globalNetGreeks: globalCache.netGreeks,
          exchangeParams: exchangeParams
        });
    } else {
      return
        MarketView({
          marketAddresses: marketC,
          isPaused: isMarketPaused,
          marketParameters: marketParameters,
          totalQueuedDeposits: 0,
          totalQueuedWithdrawals: 0,
          tokenPrice: 0,
          liquidity: LiquidityPool.Liquidity({
            freeLiquidity: 0,
            burnableLiquidity: 0,
            usedCollatLiquidity: 0,
            pendingDeltaLiquidity: 0,
            usedDeltaLiquidity: 0,
            NAV: 0
          }),
          globalNetGreeks: globalCache.netGreeks,
          exchangeParams: SynthetixAdapter.ExchangeParams({
            spotPrice: 0,
            quoteKey: synthetixAdapter.quoteKey(address(marketC.optionMarket)),
            baseKey: synthetixAdapter.baseKey(address(marketC.optionMarket)),
            short: synthetixAdapter.collateralShort(),
            quoteBaseFeeRate: 0,
            baseQuoteFeeRate: 0
          })
        });
    }
  }

  function _getMarketParams(OptionMarketAddresses memory marketC)
    internal
    view
    returns (MarketParameters memory params)
  {
    return
      MarketParameters({
        lpParams: marketC.liquidityPool.getLpParams(),
        greekCacheParams: marketC.greekCache.getGreekCacheParams(),
        forceCloseParams: marketC.greekCache.getForceCloseParams(),
        minCollatParams: marketC.greekCache.getMinCollatParams(),
        pricingParams: marketC.optionMarketPricer.getPricingParams(),
        tradeLimitParams: marketC.optionMarketPricer.getTradeLimitParams(),
        varianceFeeParams: marketC.optionMarketPricer.getVarianceFeeParams(),
        partialCollatParams: marketC.optionToken.getPartialCollatParams(),
        poolHedgerParams: marketC.poolHedger.getPoolHedgerParams()
      });
  }

  function getOwnerPositions(address owner) external view returns (MarketOptionPositions[] memory) {
    MarketOptionPositions[] memory positions = new MarketOptionPositions[](optionMarkets.length);
    for (uint i = 0; i < optionMarkets.length; i++) {
      OptionMarketAddresses memory marketC = marketAddresses[optionMarkets[i]];
      positions[i].market = address(marketC.optionMarket);
      positions[i].positions = marketC.optionToken.getOwnerPositions(owner);
    }
    return positions;
  }

  function getOwnerPositionsInRange(
    OptionMarket market,
    address owner,
    uint start,
    uint limit
  ) external view returns (OptionToken.OptionPosition[] memory) {
    OptionMarketAddresses memory marketC = marketAddresses[market];
    uint balance = marketC.optionToken.balanceOf(owner);
    uint n = limit > balance - start ? balance - start : limit;
    OptionToken.OptionPosition[] memory result = new OptionToken.OptionPosition[](n);
    for (uint i = 0; i < n; i++) {
      result[i] = marketC.optionToken.getOptionPosition(marketC.optionToken.tokenOfOwnerByIndex(owner, start + i));
    }
    return result;
  }

  // Get live boards for the chosen market
  function getLiveBoards(OptionMarket market) public view returns (BoardView[] memory marketBoards) {
    OptionMarketAddresses memory marketC = marketAddresses[market];
    uint[] memory liveBoards = marketC.optionMarket.getLiveBoards();
    marketBoards = new BoardView[](liveBoards.length);
    for (uint i = 0; i < liveBoards.length; i++) {
      marketBoards[i] = _getBoard(marketC, liveBoards[i]);
    }
  }

  // Get single board for market based on boardId
  function getBoard(OptionMarket market, uint boardId) external view returns (BoardView memory) {
    OptionMarketAddresses memory marketC = marketAddresses[market];
    return _getBoard(marketC, boardId);
  }

  function getBoardForBaseKey(bytes32 baseKey, uint boardId) external view returns (BoardView memory) {
    MarketViewWithBoards memory marketView = getMarketForBaseKey(baseKey);
    return _getBoard(marketView.marketAddresses, boardId);
  }

  function getBoardForStrikeId(OptionMarket market, uint strikeId) external view returns (BoardView memory) {
    OptionMarketAddresses memory marketC = marketAddresses[market];
    OptionMarket.Strike memory strike = marketC.optionMarket.getStrike(strikeId);
    return _getBoard(marketC, strike.boardId);
  }

  function _getBoard(OptionMarketAddresses memory marketC, uint boardId) internal view returns (BoardView memory) {
    (
      OptionMarket.OptionBoard memory board,
      OptionMarket.Strike[] memory strikes,
      uint[] memory strikeToBaseReturnedRatios,
      uint priceAtExpiry
    ) = marketC.optionMarket.getBoardAndStrikeDetails(boardId);
    OptionGreekCache.BoardGreeksView memory boardGreeksView;
    if (priceAtExpiry == 0) {
      boardGreeksView = marketC.greekCache.getBoardGreeksView(boardId);
    }
    return
      BoardView({
        boardId: board.id,
        market: address(marketC.optionMarket),
        expiry: board.expiry,
        baseIv: board.iv,
        priceAtExpiry: priceAtExpiry,
        isPaused: board.frozen,
        forceCloseGwavIV: boardGreeksView.ivGWAV,
        strikes: _getStrikeViews(strikes, boardGreeksView, strikeToBaseReturnedRatios, priceAtExpiry),
        netGreeks: boardGreeksView.boardGreeks
      });
  }

  function _getStrikeViews(
    OptionMarket.Strike[] memory strikes,
    OptionGreekCache.BoardGreeksView memory boardGreeksView,
    uint[] memory strikeToBaseReturnedRatios,
    uint priceAtExpiry
  ) internal pure returns (StrikeView[] memory strikeViews) {
    strikeViews = new StrikeView[](strikes.length);

    for (uint i = 0; i < strikes.length; i++) {
      strikeViews[i] = StrikeView({
        strikePrice: strikes[i].strikePrice,
        skew: strikes[i].skew,
        forceCloseSkew: priceAtExpiry == 0 ? boardGreeksView.skewGWAVs[i] : 0,
        cachedGreeks: priceAtExpiry == 0
          ? boardGreeksView.strikeGreeks[i]
          : OptionGreekCache.StrikeGreeks(0, 0, 0, 0, 0),
        strikeId: strikes[i].id,
        boardId: strikes[i].boardId,
        longCallOpenInterest: strikes[i].longCall,
        longPutOpenInterest: strikes[i].longPut,
        shortCallBaseOpenInterest: strikes[i].shortCallBase,
        shortCallQuoteOpenInterest: strikes[i].shortCallQuote,
        shortPutOpenInterest: strikes[i].shortPut,
        baseReturnedRatio: strikeToBaseReturnedRatios[i]
      });
    }
  }

  function getLiquidityBalancesAndAllowances(OptionMarket[] memory markets, address owner)
    external
    view
    returns (LiquidityBalanceAndAllowance[] memory)
  {
    LiquidityBalanceAndAllowance[] memory balances = new LiquidityBalanceAndAllowance[](markets.length);
    for (uint i = 0; i < markets.length; i++) {
      OptionMarketAddresses memory marketC = marketAddresses[markets[i]];
      IERC20 liquidityToken = IERC20(marketC.liquidityTokens);
      balances[i].balance = liquidityToken.balanceOf(owner);
      balances[i].allowance = liquidityToken.allowance(owner, address(marketC.liquidityPool));
      balances[i].token = address(marketC.liquidityPool);
    }
    return balances;
  }

  /**
   * @dev Emitted when an optionMarket is added
   */
  event MarketAdded(OptionMarketAddresses market);

  /**
   * @dev Emitted when an optionMarket is removed
   */
  event MarketRemoved(OptionMarket market);
}
