//SPDX-License-Identifier:ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../OptionMarket.sol";
import "../BlackScholes.sol";
import "../synthetix/SafeDecimalMath.sol";

/**
 * @title OptionMarketViewer
 * @author Lyra
 * @dev Provides helpful functions to allow the dapp to operate more smoothly; logic in getPremiumForTrade is vital to
 * ensuring accurate prices are provided to the user.
 */
contract OptionMarketViewer {
  using SafeDecimalMath for uint;

  struct BoardView {
    uint boardId;
    uint expiry;
  }

  // Detailed view of an OptionListing - only for output
  struct ListingView {
    uint listingId;
    uint boardId;
    uint strike;
    uint expiry;
    uint iv;
    uint skew;
    uint callPrice;
    uint putPrice;
    int callDelta;
    int putDelta;
    uint longCall;
    uint shortCall;
    uint longPut;
    uint shortPut;
  }

  // Detailed view of a user's holdings - only for output
  struct OwnedOptionView {
    uint listingId;
    address owner;
    uint strike;
    uint expiry;
    int callAmount;
    int putAmount;
    uint callPrice;
    uint putPrice;
  }

  LyraGlobals public globals;
  OptionMarket public optionMarket;
  OptionMarketPricer public optionMarketPricer;
  OptionGreekCache public greekCache;
  OptionToken public optionToken;
  LiquidityPool public liquidityPool;
  BlackScholes public blackScholes;

  bool initialized = false;

  constructor() {}

  /**
   * @dev Initializes the contract
   * @param _globals LyraGlobals contract address
   * @param _optionMarket OptionMarket contract address
   * @param _optionMarketPricer OptionMarketPricer contract address
   * @param _greekCache OptionGreekCache contract address
   * @param _optionToken OptionToken contract address
   * @param _liquidityPool LiquidityPool contract address
   * @param _blackScholes BlackScholes contract address
   */
  function init(
    LyraGlobals _globals,
    OptionMarket _optionMarket,
    OptionMarketPricer _optionMarketPricer,
    OptionGreekCache _greekCache,
    OptionToken _optionToken,
    LiquidityPool _liquidityPool,
    BlackScholes _blackScholes
  ) external {
    require(!initialized, "Contract already initialized");

    globals = _globals;
    optionMarket = _optionMarket;
    optionMarketPricer = _optionMarketPricer;
    greekCache = _greekCache;
    optionToken = _optionToken;
    liquidityPool = _liquidityPool;
    blackScholes = _blackScholes;

    initialized = true;
  }

  /**
   * @dev Gets the OptionBoard struct from the OptionMarket
   */
  function getBoard(uint boardId) public view returns (OptionMarket.OptionBoard memory) {
    (uint id, uint expiry, uint iv, ) = optionMarket.optionBoards(boardId);
    uint[] memory listings = optionMarket.getBoardListings(boardId);
    return OptionMarket.OptionBoard(id, expiry, iv, false, listings);
  }

  /**
   * @dev Gets the OptionListing struct from the OptionMarket
   */
  function getListing(uint listingId) public view returns (OptionMarket.OptionListing memory) {
    (uint id, uint strike, uint skew, uint longCall, uint shortCall, uint longPut, uint shortPut, uint boardId) =
      optionMarket.optionListings(listingId);
    return OptionMarket.OptionListing(id, strike, skew, longCall, shortCall, longPut, shortPut, boardId);
  }

  /**
   * @dev Gets the OptionListingCache struct from the OptionGreekCache
   */
  function getListingCache(uint listingId) internal view returns (OptionGreekCache.OptionListingCache memory) {
    (
      uint id,
      uint strike,
      uint skew,
      uint boardId,
      int callDelta,
      int putDelta,
      uint vega,
      int callExposure,
      int putExposure,
      uint updatedAt,
      uint updatedAtPrice
    ) = greekCache.listingCaches(listingId);
    return
      OptionGreekCache.OptionListingCache(
        id,
        strike,
        skew,
        boardId,
        callDelta,
        putDelta,
        vega,
        callExposure,
        putExposure,
        updatedAt,
        updatedAtPrice
      );
  }

  /**
   * @dev Gets the GlobalCache struct from the OptionGreekCache
   */
  function getGlobalCache() internal view returns (OptionGreekCache.GlobalCache memory) {
    (
      int netDelta,
      int netStdVega,
      uint minUpdatedAt,
      uint minUpdatedAtPrice,
      uint maxUpdatedAtPrice,
      uint minExpiryTimestamp
    ) = greekCache.globalCache();
    return
      OptionGreekCache.GlobalCache(
        netDelta,
        netStdVega,
        minUpdatedAt,
        minUpdatedAtPrice,
        maxUpdatedAtPrice,
        minExpiryTimestamp
      );
  }

  /**
   * @dev Gets the array of liveBoards with details from the OptionMarket
   */
  function getLiveBoards() external view returns (BoardView[] memory boards) {
    uint[] memory liveBoards = optionMarket.getLiveBoards();
    boards = new BoardView[](liveBoards.length);
    for (uint i = 0; i < liveBoards.length; i++) {
      OptionMarket.OptionBoard memory board = getBoard(liveBoards[i]);
      boards[i] = BoardView(board.id, board.expiry);
    }
  }

  /**
   * @dev Gets detailed ListingViews for all listings on a board
   */
  function getListingsForBoard(uint boardId) external view returns (ListingView[] memory boardListings) {
    OptionMarket.OptionBoard memory board = getBoard(boardId);
    LyraGlobals.GreekCacheGlobals memory greekCacheGlobals = globals.getGreekCacheGlobals(address(optionMarket));

    boardListings = new ListingView[](board.listingIds.length);

    for (uint i = 0; i < board.listingIds.length; i++) {
      OptionMarket.OptionListing memory listing = getListing(board.listingIds[i]);

      uint vol = board.iv.multiplyDecimal(listing.skew);

      BlackScholes.PricesDeltaStdVega memory pricesDeltaStdVega =
        blackScholes.pricesDeltaStdVega(
          timeToMaturitySeconds(board.expiry),
          vol,
          greekCacheGlobals.spotPrice,
          listing.strike,
          greekCacheGlobals.rateAndCarry
        );

      boardListings[i] = ListingView(
        listing.id,
        boardId,
        listing.strike,
        board.expiry,
        board.iv,
        listing.skew,
        pricesDeltaStdVega.callPrice,
        pricesDeltaStdVega.putPrice,
        pricesDeltaStdVega.callDelta,
        pricesDeltaStdVega.putDelta,
        listing.longCall,
        listing.shortCall,
        listing.longPut,
        listing.shortPut
      );
    }
  }

  /**
   * @dev Gets detailed ListingView along with all of a user's balances for a given listing
   */
  function getListingViewAndBalance(uint listingId, address user)
    external
    view
    returns (
      ListingView memory listingView,
      uint longCallAmt,
      uint longPutAmt,
      uint shortCallAmt,
      uint shortPutAmt
    )
  {
    listingView = getListingView(listingId);
    longCallAmt = optionToken.balanceOf(user, listingId + uint(OptionMarket.TradeType.LONG_CALL));
    longPutAmt = optionToken.balanceOf(user, listingId + uint(OptionMarket.TradeType.LONG_PUT));
    shortCallAmt = optionToken.balanceOf(user, listingId + uint(OptionMarket.TradeType.SHORT_CALL));
    shortPutAmt = optionToken.balanceOf(user, listingId + uint(OptionMarket.TradeType.SHORT_PUT));
  }

  /**
   * @dev Gets a detailed ListingView for a given listing
   */
  function getListingView(uint listingId) public view returns (ListingView memory listingView) {
    OptionMarket.OptionListing memory listing = getListing(listingId);
    OptionMarket.OptionBoard memory board = getBoard(listing.boardId);
    LyraGlobals.GreekCacheGlobals memory greekCacheGlobals = globals.getGreekCacheGlobals(address(optionMarket));

    uint vol = board.iv.multiplyDecimal(listing.skew);

    BlackScholes.PricesDeltaStdVega memory pricesDeltaStdVega =
      blackScholes.pricesDeltaStdVega(
        timeToMaturitySeconds(board.expiry),
        vol,
        greekCacheGlobals.spotPrice,
        listing.strike,
        greekCacheGlobals.rateAndCarry
      );

    return
      ListingView(
        listing.id,
        listing.boardId,
        listing.strike,
        board.expiry,
        board.iv,
        listing.skew,
        pricesDeltaStdVega.callPrice,
        pricesDeltaStdVega.putPrice,
        pricesDeltaStdVega.callDelta,
        pricesDeltaStdVega.putDelta,
        listing.longCall,
        listing.shortCall,
        listing.longPut,
        listing.shortPut
      );
  }

  /**
   * @dev Gets the premium and new iv value after opening
   */
  function getPremiumForOpen(
    uint _listingId,
    OptionMarket.TradeType tradeType,
    uint amount
  ) external view returns (uint premium, uint newIv) {
    bool isBuy = tradeType == OptionMarket.TradeType.LONG_CALL || tradeType == OptionMarket.TradeType.LONG_PUT;
    return getPremiumForTrade(_listingId, tradeType, isBuy, amount);
  }

  /**
   * @dev Gets the premium and new iv value after closing
   */
  function getPremiumForClose(
    uint _listingId,
    OptionMarket.TradeType tradeType,
    uint amount
  ) external view returns (uint premium, uint newIv) {
    bool isBuy = !(tradeType == OptionMarket.TradeType.LONG_CALL || tradeType == OptionMarket.TradeType.LONG_PUT);
    return getPremiumForTrade(_listingId, tradeType, isBuy, amount);
  }

  /**
   * @dev Gets the premium and new iv value for a given trade
   */
  function getPremiumForTrade(
    uint _listingId,
    OptionMarket.TradeType tradeType,
    bool isBuy,
    uint amount
  ) public view returns (uint premium, uint newIv) {
    LyraGlobals.PricingGlobals memory pricingGlobals = globals.getPricingGlobals(address(optionMarket));
    LyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(optionMarket), LyraGlobals.ExchangeType.ALL);

    OptionMarket.OptionListing memory listing = getListing(_listingId);
    OptionMarket.OptionBoard memory board = getBoard(listing.boardId);
    OptionMarket.Trade memory trade =
      OptionMarket.Trade({
        isBuy: isBuy,
        amount: amount,
        vol: board.iv.multiplyDecimal(listing.skew),
        expiry: board.expiry,
        liquidity: liquidityPool.getLiquidity(pricingGlobals.spotPrice, exchangeGlobals.short)
      });
    bool isCall = tradeType == OptionMarket.TradeType.LONG_CALL || tradeType == OptionMarket.TradeType.SHORT_CALL;
    return _getPremiumForTrade(listing, board, trade, pricingGlobals, isCall);
  }

  /**
   * @dev Gets the premium and new iv value for a given trade
   */
  function _getPremiumForTrade(
    OptionMarket.OptionListing memory listing,
    OptionMarket.OptionBoard memory board,
    OptionMarket.Trade memory trade,
    LyraGlobals.PricingGlobals memory pricingGlobals,
    bool isCall
  ) public view returns (uint, uint) {
    // Apply the skew as implemented in OptionMarket

    (uint newIv, uint newSkew) = optionMarketPricer.ivImpactForTrade(listing, trade, pricingGlobals, board.iv);
    trade.vol = newIv.multiplyDecimal(newSkew);

    int newCallExposure =
      int(listing.longCall) -
        int(listing.shortCall) +
        (isCall ? (trade.isBuy ? int(trade.amount) : -int(trade.amount)) : 0);
    int newPutExposure =
      int(listing.longPut) -
        int(listing.shortPut) +
        (isCall ? 0 : (trade.isBuy ? int(trade.amount) : -int(trade.amount)));

    OptionMarketPricer.Pricing memory pricing =
      _getPricingForTrade(pricingGlobals, trade, listing.id, newCallExposure, newPutExposure, isCall);

    return (optionMarketPricer.getPremium(trade, pricing, pricingGlobals), trade.vol);
  }

  function _getPricingForTrade(
    LyraGlobals.PricingGlobals memory pricingGlobals,
    OptionMarket.Trade memory trade,
    uint _listingId,
    int newCallExposure,
    int newPutExposure,
    bool isCall
  ) internal view returns (OptionMarketPricer.Pricing memory pricing) {
    OptionGreekCache.OptionListingCache memory listingCache = getListingCache(_listingId);
    OptionGreekCache.GlobalCache memory globalCache = getGlobalCache();

    BlackScholes.PricesDeltaStdVega memory pricesDeltaStdVega =
      blackScholes.pricesDeltaStdVega(
        timeToMaturitySeconds(trade.expiry),
        trade.vol,
        pricingGlobals.spotPrice,
        listingCache.strike,
        pricingGlobals.rateAndCarry
      );

    int preTradeAmmNetStdVega = -globalCache.netStdVega;

    globalCache.netStdVega +=
      (int(listingCache.stdVega) *
        ((newCallExposure - listingCache.callExposure) + (newPutExposure - listingCache.putExposure))) /
      1e18;

    listingCache.callExposure = newCallExposure;
    listingCache.putExposure = newPutExposure;

    int netStdVegaDiff =
      (((listingCache.callExposure + listingCache.putExposure) *
        (int(pricesDeltaStdVega.stdVega) - int(listingCache.stdVega))) / 1e18);

    pricing.optionPrice = isCall ? pricesDeltaStdVega.callPrice : pricesDeltaStdVega.putPrice;
    pricing.postTradeAmmNetStdVega = -(globalCache.netStdVega + netStdVegaDiff);
    pricing.preTradeAmmNetStdVega = preTradeAmmNetStdVega;
    return pricing;
  }

  /**
   * @dev Gets seconds to expiry.
   */
  function timeToMaturitySeconds(uint expiry) internal view returns (uint timeToMaturity) {
    if (expiry > block.timestamp) {
      timeToMaturity = expiry - block.timestamp;
    } else {
      timeToMaturity = 0;
    }
  }
}
