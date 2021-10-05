//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";
import "./synthetix/SignedSafeDecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBlackScholes.sol";
import "./interfaces/ILyraGlobals.sol";
import "./interfaces/IOptionMarket.sol";
import "./interfaces/IOptionMarketPricer.sol";
import "./interfaces/IOptionGreekCache.sol";

/**
 * @title OptionGreekCache
 * @author Lyra
 * @dev Aggregates the netDelta and netStdVega of the OptionMarket by iterating over current listings.
 * Needs to be called by an external override actor as it's not feasible to do all the computation during the trade flow and
 * because delta/vega change over time and with movements in asset price and volatility.
 */
contract OptionGreekCache is IOptionGreekCache, Ownable {
  using SafeMath for uint;
  using SafeDecimalMath for uint;
  using SignedSafeMath for int;
  using SignedSafeDecimalMath for int;

  ILyraGlobals internal globals;
  IOptionMarket internal optionMarket;
  IOptionMarketPricer internal optionPricer;
  IBlackScholes internal blackScholes;

  // Limit due to gas constraints when updating
  uint public constant override MAX_LISTINGS_PER_BOARD = 10;

  // For calculating if the cache is stale based on spot price
  // These values can be quite wide as per listing updates occur whenever a trade does.
  uint public override staleUpdateDuration = 2 days;
  uint public override priceScalingPeriod = 7 days;
  uint public override maxAcceptablePercent = (1e18 / 100) * 20; // 20%
  uint public override minAcceptablePercent = (1e18 / 100) * 10; // 10%

  bool internal initialized;

  uint[] public override liveBoards; // Should be a clone of OptionMarket.liveBoards
  mapping(uint => OptionListingCache) public override listingCaches;
  mapping(uint => OptionBoardCache) public override boardCaches;
  GlobalCache public override globalCache;

  constructor() Ownable() {}

  /**
   * @dev Initialize the contract.
   *
   * @param _globals LyraGlobals address
   * @param _optionMarket OptionMarket address
   * @param _optionPricer OptionMarketPricer address
   */
  function init(
    ILyraGlobals _globals,
    IOptionMarket _optionMarket,
    IOptionMarketPricer _optionPricer,
    IBlackScholes _blackScholes
  ) external {
    require(!initialized, "Contract already initialized");
    globals = _globals;
    optionMarket = _optionMarket;
    optionPricer = _optionPricer;
    blackScholes = _blackScholes;
    initialized = true;
  }

  function setStaleCacheParameters(
    uint _staleUpdateDuration,
    uint _priceScalingPeriod,
    uint _maxAcceptablePercent,
    uint _minAcceptablePercent
  ) external override onlyOwner {
    require(_staleUpdateDuration >= 2 hours, "staleUpdateDuration too low");
    require(_maxAcceptablePercent >= _minAcceptablePercent, "maxAcceptablePercent must be >= min");
    require(_minAcceptablePercent >= (1e18 / 100) * 1, "minAcceptablePercent too low");
    // Note: this value can be zero even though it is in the divisor as timeToExpiry must be < priceScalingPeriod for it
    // to be used.
    priceScalingPeriod = _priceScalingPeriod;
    minAcceptablePercent = _minAcceptablePercent;
    maxAcceptablePercent = _maxAcceptablePercent;
    staleUpdateDuration = _staleUpdateDuration;

    emit StaleCacheParametersUpdated(
      priceScalingPeriod,
      minAcceptablePercent,
      maxAcceptablePercent,
      staleUpdateDuration
    );
  }

  ////
  // Add/Remove boards
  ////

  /**
   * @notice Adds a new OptionBoardCache.
   * @dev Called by the OptionMarket when an OptionBoard is added.
   *
   * @param boardId The id of the OptionBoard.
   */
  function addBoard(uint boardId) external override onlyOptionMarket {
    // Load in board from OptionMarket, adding net positions to global count
    (, uint expiry, uint iv, ) = optionMarket.optionBoards(boardId);
    uint[] memory listings = optionMarket.getBoardListings(boardId);

    require(listings.length <= MAX_LISTINGS_PER_BOARD, "too many listings for board");

    OptionBoardCache storage boardCache = boardCaches[boardId];
    boardCache.id = boardId;
    boardCache.expiry = expiry;
    boardCache.iv = iv;
    liveBoards.push(boardId);

    for (uint i = 0; i < listings.length; i++) {
      _addNewListingToListingCache(boardCache, listings[i]);
    }

    _updateBoardLastUpdatedAt(boardCache);
  }

  /**
   * @notice Removes an OptionBoardCache.
   * @dev Called by the OptionMarket when an OptionBoard is liquidated.
   *
   * @param boardId The id of the OptionBoard.
   */
  function removeBoard(uint boardId) external override onlyOptionMarket {
    // Remove board from cache, removing net positions from global count
    OptionBoardCache memory boardCache = boardCaches[boardId];
    globalCache.netDelta = globalCache.netDelta.sub(boardCache.netDelta);
    globalCache.netStdVega = globalCache.netStdVega.sub(boardCache.netStdVega);
    // Clean up, cache isn't necessary for settle logic
    for (uint i = 0; i < boardCache.listings.length; i++) {
      delete listingCaches[boardCache.listings[i]];
    }
    for (uint i = 0; i < liveBoards.length; i++) {
      if (liveBoards[i] == boardId) {
        liveBoards[i] = liveBoards[liveBoards.length - 1];
        liveBoards.pop();
        break;
      }
    }
    delete boardCaches[boardId];
    emit GlobalCacheUpdated(globalCache.netDelta, globalCache.netStdVega);
  }

  /**
   * @dev modifies an OptionBoard's baseIv
   *
   * @param boardId The id of the OptionBoard.
   * @param newIv The baseIv of the OptionBoard.
   */
  function setBoardIv(uint boardId, uint newIv) external override onlyOptionMarket {
    // Remove board from cache, removing net positions from global count
    OptionBoardCache storage boardCache = boardCaches[boardId];
    boardCache.iv = newIv;
  }

  /**
   * @dev modifies an OptionListing's skew
   *
   * @param listingId The id of the OptionListing.
   * @param newSkew The skew of the OptionListing.
   */
  function setListingSkew(uint listingId, uint newSkew) external override onlyOptionMarket {
    // Remove board from cache, removing net positions from global count
    OptionListingCache storage listingCache = listingCaches[listingId];
    listingCache.skew = newSkew;
  }

  /**
   * @notice Add a new listing to the listingCaches and the listingId to the boardCache
   *
   * @param boardId The id of the Board
   * @param listingId The id of the OptionListing.
   */
  function addListingToBoard(uint boardId, uint listingId) external override onlyOptionMarket {
    OptionBoardCache storage boardCache = boardCaches[boardId];
    require(boardCache.listings.length + 1 <= MAX_LISTINGS_PER_BOARD, "too many listings for board");
    _addNewListingToListingCache(boardCache, listingId);
  }

  /**
   * @notice Add a new listing to the listingCaches
   *
   * @param boardCache The OptionBoardCache object the listing is being added to
   * @param listingId The id of the OptionListing.
   */
  function _addNewListingToListingCache(OptionBoardCache storage boardCache, uint listingId) internal {
    IOptionMarket.OptionListing memory listing = getOptionMarketListing(listingId);

    // This is only called when a new board or a new listing is added, so exposure values will be 0
    OptionListingCache storage listingCache = listingCaches[listing.id];
    listingCache.id = listing.id;
    listingCache.strike = listing.strike;
    listingCache.boardId = listing.boardId;
    listingCache.skew = listing.skew;

    boardCache.listings.push(listingId);
  }

  /**
   * @notice Retrieves an OptionListing from the OptionMarket.
   *
   * @param listingId The id of the OptionListing.
   */
  function getOptionMarketListing(uint listingId) internal view returns (IOptionMarket.OptionListing memory) {
    (uint id, uint strike, uint skew, uint longCall, uint shortCall, uint longPut, uint shortPut, uint boardId) =
      optionMarket.optionListings(listingId);
    return IOptionMarket.OptionListing(id, strike, skew, longCall, shortCall, longPut, shortPut, boardId);
  }

  ////
  // Updating greeks/caches
  ////

  /**
   * @notice Updates all stale boards.
   */
  function updateAllStaleBoards() external override returns (int) {
    // Check all boards to see if they are stale
    ILyraGlobals.GreekCacheGlobals memory greekCacheGlobals = globals.getGreekCacheGlobals(address(optionMarket));
    _updateAllStaleBoards(greekCacheGlobals);
    return globalCache.netDelta;
  }

  /**
   * @dev Updates all stale boards.
   *
   * @param greekCacheGlobals The GreekCacheGlobals.
   */
  function _updateAllStaleBoards(ILyraGlobals.GreekCacheGlobals memory greekCacheGlobals) internal {
    for (uint i = 0; i < liveBoards.length; i++) {
      uint boardId = liveBoards[i];
      if (_isBoardCacheStale(boardId, greekCacheGlobals.spotPrice)) {
        // This updates all listings in the board, even though it is not strictly necessary
        _updateBoardCachedGreeks(greekCacheGlobals, boardId);
      }
    }
  }

  /**
   * @notice Updates the cached greeks for an OptionBoardCache.
   *
   * @param boardCacheId The id of the OptionBoardCache.
   */
  function updateBoardCachedGreeks(uint boardCacheId) external override {
    _updateBoardCachedGreeks(globals.getGreekCacheGlobals(address(optionMarket)), boardCacheId);
  }

  /**
   * @dev Updates the cached greeks for an OptionBoardCache.
   *
   * @param greekCacheGlobals The GreekCacheGlobals.
   * @param boardCacheId The id of the OptionBoardCache.
   */
  function _updateBoardCachedGreeks(ILyraGlobals.GreekCacheGlobals memory greekCacheGlobals, uint boardCacheId)
    internal
  {
    OptionBoardCache storage boardCache = boardCaches[boardCacheId];
    // In the case the board doesnt exist, listings.length is 0, so nothing happens
    for (uint i = 0; i < boardCache.listings.length; i++) {
      OptionListingCache storage listingCache = listingCaches[boardCache.listings[i]];
      _updateListingCachedGreeks(
        greekCacheGlobals,
        listingCache,
        boardCache,
        true,
        listingCache.callExposure,
        listingCache.putExposure
      );
    }

    boardCache.minUpdatedAt = block.timestamp;
    boardCache.minUpdatedAtPrice = greekCacheGlobals.spotPrice;
    boardCache.maxUpdatedAtPrice = greekCacheGlobals.spotPrice;
    _updateGlobalLastUpdatedAt();
  }

  /**
   * @notice Updates the OptionListingCache to reflect the new exposure.
   *
   * @param greekCacheGlobals The GreekCacheGlobals.
   * @param listingCacheId The id of the OptionListingCache.
   * @param newCallExposure The new call exposure of the OptionListing.
   * @param newPutExposure The new put exposure of the OptionListing.
   * @param iv The new iv of the OptionBoardCache.
   * @param skew The new skew of the OptionListingCache.
   */
  function updateListingCacheAndGetPrice(
    ILyraGlobals.GreekCacheGlobals memory greekCacheGlobals,
    uint listingCacheId,
    int newCallExposure,
    int newPutExposure,
    uint iv,
    uint skew
  ) external override onlyOptionMarketPricer returns (IOptionMarketPricer.Pricing memory) {
    require(!_isGlobalCacheStale(greekCacheGlobals.spotPrice), "Global cache is stale");
    OptionListingCache storage listingCache = listingCaches[listingCacheId];
    OptionBoardCache storage boardCache = boardCaches[listingCache.boardId];

    int callExposureDiff = newCallExposure.sub(listingCache.callExposure);
    int putExposureDiff = newPutExposure.sub(listingCache.putExposure);

    require(callExposureDiff == 0 || putExposureDiff == 0, "both call and put exposure updated");

    boardCache.iv = iv;
    listingCache.skew = skew;

    // The AMM's net std vega is opposite to the global sum of user's std vega
    int preTradeAmmNetStdVega = -globalCache.netStdVega;

    IOptionMarketPricer.Pricing memory pricing =
      _updateListingCachedGreeks(
        greekCacheGlobals,
        listingCache,
        boardCache,
        callExposureDiff != 0,
        newCallExposure,
        newPutExposure
      );
    pricing.preTradeAmmNetStdVega = preTradeAmmNetStdVega;

    _updateBoardLastUpdatedAt(boardCache);

    return pricing;
  }

  /**
   * @dev Updates an OptionListingCache.
   *
   * @param greekCacheGlobals The GreekCacheGlobals.
   * @param listingCache The OptionListingCache.
   * @param boardCache The OptionBoardCache.
   * @param returnCallPrice If true, return the call price, otherwise return the put price.
   */
  function _updateListingCachedGreeks(
    ILyraGlobals.GreekCacheGlobals memory greekCacheGlobals,
    OptionListingCache storage listingCache,
    OptionBoardCache storage boardCache,
    bool returnCallPrice,
    int newCallExposure,
    int newPutExposure
  ) internal returns (IOptionMarketPricer.Pricing memory pricing) {
    IBlackScholes.PricesDeltaStdVega memory pricesDeltaStdVega =
      blackScholes.pricesDeltaStdVega(
        timeToMaturitySeconds(boardCache.expiry),
        boardCache.iv.multiplyDecimal(listingCache.skew),
        greekCacheGlobals.spotPrice,
        listingCache.strike,
        greekCacheGlobals.rateAndCarry
      );

    // (newCallExposure * newCallDelta - oldCallExposure * oldCallDelta)
    // + (newPutExposure * newPutDelta - oldPutExposure * oldPutDelta)
    int netDeltaDiff =
      (
        (newCallExposure.multiplyDecimal(pricesDeltaStdVega.callDelta)) // newCall
          .sub(listingCache.callExposure.multiplyDecimal(listingCache.callDelta))
          .add(
          (newPutExposure.multiplyDecimal(pricesDeltaStdVega.putDelta)).sub(
            listingCache.putExposure.multiplyDecimal(listingCache.putDelta)
          )
        )
      );

    int netStdVegaDiff =
      newCallExposure.add(newPutExposure).multiplyDecimal(int(pricesDeltaStdVega.stdVega)).sub(
        listingCache.callExposure.add(listingCache.putExposure).multiplyDecimal(int(listingCache.stdVega))
      );

    if (listingCache.callExposure != newCallExposure || listingCache.putExposure != newPutExposure) {
      emit ListingExposureUpdated(listingCache.id, newCallExposure, newPutExposure);
    }

    listingCache.callExposure = newCallExposure;
    listingCache.putExposure = newPutExposure;
    listingCache.callDelta = pricesDeltaStdVega.callDelta;
    listingCache.putDelta = pricesDeltaStdVega.putDelta;
    listingCache.stdVega = pricesDeltaStdVega.stdVega;

    listingCache.updatedAt = block.timestamp;
    listingCache.updatedAtPrice = greekCacheGlobals.spotPrice;

    boardCache.netDelta = boardCache.netDelta.add(netDeltaDiff);
    boardCache.netStdVega = boardCache.netStdVega.add(netStdVegaDiff);

    globalCache.netDelta = globalCache.netDelta.add(netDeltaDiff);
    globalCache.netStdVega = globalCache.netStdVega.add(netStdVegaDiff);

    pricing.optionPrice = returnCallPrice ? pricesDeltaStdVega.callPrice : pricesDeltaStdVega.putPrice;
    // AMM's net positions are the inverse of the user's net position
    pricing.postTradeAmmNetStdVega = -globalCache.netStdVega;
    pricing.callDelta = pricesDeltaStdVega.callDelta;

    emit ListingGreeksUpdated(
      listingCache.id,
      pricesDeltaStdVega.callDelta,
      pricesDeltaStdVega.putDelta,
      pricesDeltaStdVega.stdVega,
      greekCacheGlobals.spotPrice,
      boardCache.iv,
      listingCache.skew
    );
    emit GlobalCacheUpdated(globalCache.netDelta, globalCache.netStdVega);

    return pricing;
  }

  /**
   * @notice Checks if the GlobalCache is stale.
   */
  function isGlobalCacheStale() external view override returns (bool) {
    // Check all boards to see if they are stale
    uint currentPrice = getCurrentPrice();
    return _isGlobalCacheStale(currentPrice);
  }

  /**
   * @dev Checks if the GlobalCache is stale.
   *
   * @param spotPrice The price of the baseAsset.
   */
  function _isGlobalCacheStale(uint spotPrice) internal view returns (bool) {
    // Check all boards to see if they are stale
    return (isUpdatedAtTimeStale(globalCache.minUpdatedAt) ||
      !isPriceMoveAcceptable(
        globalCache.minUpdatedAtPrice,
        spotPrice,
        timeToMaturitySeconds(globalCache.minExpiryTimestamp)
      ) ||
      !isPriceMoveAcceptable(
        globalCache.maxUpdatedAtPrice,
        spotPrice,
        timeToMaturitySeconds(globalCache.minExpiryTimestamp)
      ));
  }

  /**
   * @notice Checks if the OptionBoardCache is stale.
   *
   * @param boardCacheId The OptionBoardCache id.
   */
  function isBoardCacheStale(uint boardCacheId) external view override returns (bool) {
    uint spotPrice = getCurrentPrice();
    return _isBoardCacheStale(boardCacheId, spotPrice);
  }

  /**
   * @dev Checks if the OptionBoardCache is stale.
   *
   * @param boardCacheId The OptionBoardCache id.
   * @param spotPrice The price of the baseAsset.
   */
  function _isBoardCacheStale(uint boardCacheId, uint spotPrice) internal view returns (bool) {
    // We do not have to check every individual listing, as the OptionBoardCache
    // should always keep the minimum values.
    OptionBoardCache memory boardCache = boardCaches[boardCacheId];
    require(boardCache.id != 0, "Board does not exist");

    return
      isUpdatedAtTimeStale(boardCache.minUpdatedAt) ||
      !isPriceMoveAcceptable(boardCache.minUpdatedAtPrice, spotPrice, timeToMaturitySeconds(boardCache.expiry)) ||
      !isPriceMoveAcceptable(boardCache.maxUpdatedAtPrice, spotPrice, timeToMaturitySeconds(boardCache.expiry));
  }

  /**
   * @dev Checks if `updatedAt` is stale.
   *
   * @param updatedAt The time of the last update.
   */
  function isUpdatedAtTimeStale(uint updatedAt) internal view returns (bool) {
    // This can be more complex than just checking the item wasn't updated in the last two hours
    return getSecondsTo(updatedAt, block.timestamp) > staleUpdateDuration;
  }

  /**
   * @dev Check if the price move of an asset is acceptable given the time to expiry.
   *
   * @param pastPrice The previous price.
   * @param currentPrice The current price.
   * @param timeToExpirySec The time to expiry in seconds.
   */
  function isPriceMoveAcceptable(
    uint pastPrice,
    uint currentPrice,
    uint timeToExpirySec
  ) internal view returns (bool) {
    uint acceptablePriceMovementPercent = maxAcceptablePercent;

    if (timeToExpirySec < priceScalingPeriod) {
      acceptablePriceMovementPercent = ((maxAcceptablePercent.sub(minAcceptablePercent)).mul(timeToExpirySec))
        .div(priceScalingPeriod)
        .add(minAcceptablePercent);
    }

    uint acceptablePriceMovement = pastPrice.multiplyDecimal(acceptablePriceMovementPercent);

    if (currentPrice > pastPrice) {
      return currentPrice.sub(pastPrice) < acceptablePriceMovement;
    } else {
      return pastPrice.sub(currentPrice) < acceptablePriceMovement;
    }
  }

  /**
   * @dev Updates `lastUpdatedAt` for an OptionBoardCache.
   *
   * @param boardCache The OptionBoardCache.
   */
  function _updateBoardLastUpdatedAt(OptionBoardCache storage boardCache) internal {
    OptionListingCache memory listingCache = listingCaches[boardCache.listings[0]];
    uint minUpdate = listingCache.updatedAt;
    uint minPrice = listingCache.updatedAtPrice;
    uint maxPrice = listingCache.updatedAtPrice;

    for (uint i = 1; i < boardCache.listings.length; i++) {
      listingCache = listingCaches[boardCache.listings[i]];
      if (listingCache.updatedAt < minUpdate) {
        minUpdate = listingCache.updatedAt;
      }
      if (listingCache.updatedAtPrice < minPrice) {
        minPrice = listingCache.updatedAtPrice;
      } else if (listingCache.updatedAtPrice > maxPrice) {
        maxPrice = listingCache.updatedAtPrice;
      }
    }
    boardCache.minUpdatedAt = minUpdate;
    boardCache.minUpdatedAtPrice = minPrice;
    boardCache.maxUpdatedAtPrice = maxPrice;

    _updateGlobalLastUpdatedAt();
  }

  /**
   * @dev Updates global `lastUpdatedAt`.
   */
  function _updateGlobalLastUpdatedAt() internal {
    OptionBoardCache memory boardCache = boardCaches[liveBoards[0]];
    uint minUpdate = boardCache.minUpdatedAt;
    uint minPrice = boardCache.minUpdatedAtPrice;
    uint minExpiry = boardCache.expiry;
    uint maxPrice = boardCache.maxUpdatedAtPrice;

    for (uint i = 1; i < liveBoards.length; i++) {
      boardCache = boardCaches[liveBoards[i]];
      if (boardCache.minUpdatedAt < minUpdate) {
        minUpdate = boardCache.minUpdatedAt;
      }
      if (boardCache.minUpdatedAtPrice < minPrice) {
        minPrice = boardCache.minUpdatedAtPrice;
      }
      if (boardCache.maxUpdatedAtPrice > maxPrice) {
        maxPrice = boardCache.maxUpdatedAtPrice;
      }
      if (boardCache.expiry < minExpiry) {
        minExpiry = boardCache.expiry;
      }
    }

    globalCache.minUpdatedAt = minUpdate;
    globalCache.minUpdatedAtPrice = minPrice;
    globalCache.maxUpdatedAtPrice = maxPrice;
    globalCache.minExpiryTimestamp = minExpiry;
  }

  /**
   * @dev Returns time to maturity for a given expiry.
   */
  function timeToMaturitySeconds(uint expiry) internal view returns (uint) {
    return getSecondsTo(block.timestamp, expiry);
  }

  /**
   * @dev Returns the difference in seconds between two dates.
   */
  function getSecondsTo(uint fromTime, uint toTime) internal pure returns (uint) {
    if (toTime > fromTime) {
      return toTime - fromTime;
    }
    return 0;
  }

  /**
   * @dev Get the price of the baseAsset for the OptionMarket.
   */
  function getCurrentPrice() internal view returns (uint) {
    return globals.getSpotPriceForMarket(address(optionMarket));
  }

  /**
   * @dev Get the current cached global netDelta value.
   */
  function getGlobalNetDelta() external view override returns (int) {
    return globalCache.netDelta;
  }

  modifier onlyOptionMarket virtual {
    require(msg.sender == address(optionMarket), "Only optionMarket permitted");
    _;
  }

  modifier onlyOptionMarketPricer virtual {
    require(msg.sender == address(optionPricer), "Only optionPricer permitted");
    _;
  }

  /**
   * @dev Emitted when stale cache parameters are updated.
   */
  event StaleCacheParametersUpdated(
    uint priceScalingPeriod,
    uint minAcceptablePercent,
    uint maxAcceptablePercent,
    uint staleUpdateDuration
  );

  /**
   * @dev Emitted when the cache of an OptionListing is updated.
   */
  event ListingGreeksUpdated(
    uint indexed listingId,
    int callDelta,
    int putDelta,
    uint vega,
    uint price,
    uint baseIv,
    uint skew
  );

  /**
   * @dev Emitted when the exposure of an OptionListing is updated.
   */
  event ListingExposureUpdated(uint indexed listingId, int newCallExposure, int newPutExposure);

  /**
   * @dev Emitted when the GlobalCache is updated.
   */
  event GlobalCacheUpdated(int netDelta, int netStdVega);
}
