//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";

// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LyraGlobals.sol";
import "./LiquidityPool.sol";
import "./OptionToken.sol";
import "./OptionGreekCache.sol";
import "./LyraGlobals.sol";
import "./ShortCollateral.sol";
import "./interfaces/IOptionToken.sol";

/**
 * @title OptionMarket
 * @author Lyra
 * @dev An AMM which allows users to trade options. Supports both buying and selling options, which determine the value
 * for the listing's IV. Also allows for auto cash settling options as at expiry.
 */
contract OptionMarket is IOptionMarket {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  ILyraGlobals internal globals;
  ILiquidityPool internal liquidityPool;
  IOptionMarketPricer internal optionPricer;
  IOptionGreekCache internal greekCache;
  IShortCollateral internal shortCollateral;
  IOptionToken internal optionToken;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;

  mapping(uint => string) internal errorMessages;
  address internal owner;
  bool internal initialized = false;
  uint internal nextListingId = 1;
  uint internal nextBoardId = 1;
  uint[] internal liveBoards;

  uint public override maxExpiryTimestamp;
  mapping(uint => OptionBoard) public override optionBoards;
  mapping(uint => OptionListing) public override optionListings;
  mapping(uint => uint) public override boardToPriceAtExpiry;
  mapping(uint => uint) public override listingToBaseReturnedRatio;

  constructor() {
    owner = msg.sender;
  }

  /**
   * @dev Initialize the contract.
   *
   * @param _globals LyraGlobals address
   * @param _liquidityPool LiquidityPool address
   * @param _optionPricer OptionMarketPricer address
   * @param _greekCache OptionGreekCache address
   * @param _quoteAsset Quote asset address
   * @param _baseAsset Base asset address
   */
  function init(
    ILyraGlobals _globals,
    ILiquidityPool _liquidityPool,
    IOptionMarketPricer _optionPricer,
    IOptionGreekCache _greekCache,
    IShortCollateral _shortCollateral,
    IOptionToken _optionToken,
    IERC20 _quoteAsset,
    IERC20 _baseAsset,
    string[] memory _errorMessages
  ) external {
    require(!initialized, "already initialized");
    globals = _globals;
    liquidityPool = _liquidityPool;
    optionPricer = _optionPricer;
    greekCache = _greekCache;
    shortCollateral = _shortCollateral;
    optionToken = _optionToken;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;
    require(_errorMessages.length == uint(Error.Last), "error msg count");
    for (uint i = 0; i < _errorMessages.length; i++) {
      errorMessages[i] = _errorMessages[i];
    }
    initialized = true;
  }

  /////////////////////
  // Admin functions //
  /////////////////////

  /**
   * @dev Transfer this contract ownership to `newOwner`.
   * @param newOwner The address of the new contract owner.
   */
  function transferOwnership(address newOwner) external override onlyOwner {
    _require(newOwner != address(0), Error.TransferOwnerToZero);
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  /**
   * @dev Sets the frozen state of an OptionBoard.
   * @param boardId The id of the OptionBoard.
   * @param frozen Whether the board will be frozen or not.
   */
  function setBoardFrozen(uint boardId, bool frozen) external override onlyOwner {
    OptionBoard storage board = optionBoards[boardId];
    _require(board.id == boardId, Error.InvalidBoardId);
    optionBoards[boardId].frozen = frozen;
    emit BoardFrozen(boardId, frozen);
  }

  /**
   * @dev Sets the baseIv of a frozen OptionBoard.
   * @param boardId The id of the OptionBoard.
   * @param baseIv The new baseIv value.
   */
  function setBoardBaseIv(uint boardId, uint baseIv) external override onlyOwner {
    OptionBoard storage board = optionBoards[boardId];
    _require(board.id == boardId && board.frozen, Error.InvalidBoardIdOrNotFrozen);
    board.iv = baseIv;
    greekCache.setBoardIv(boardId, baseIv);
    emit BoardBaseIvSet(boardId, baseIv);
  }

  /**
   * @dev Sets the skew of an OptionListing of a frozen OptionBoard.
   * @param listingId The id of the listing being modified.
   * @param skew The new skew value.
   */
  function setListingSkew(uint listingId, uint skew) external override onlyOwner {
    OptionListing storage listing = optionListings[listingId];
    OptionBoard memory board = optionBoards[listing.boardId];
    _require(listing.id == listingId && board.frozen, Error.InvalidListingIdOrNotFrozen);
    listing.skew = skew;
    greekCache.setListingSkew(listingId, skew);
    emit ListingSkewSet(listingId, skew);
  }

  /**
   * @dev Creates a new OptionBoard which contains OptionListings.
   * This only allows a new maxExpiryTimestamp to be added if the previous one has been passed. This is done to create a
   * system of "rounds" where PnL for LPs can be computed easily across all boards.
   *
   * @param expiry The timestamp when the board expires.
   * @param baseIV The initial value for implied volatility.
   * @param strikes The array of strikes offered for this expiry.
   * @param skews The array of skews for each strike.
   */
  function createOptionBoard(
    uint expiry,
    uint baseIV,
    uint[] memory strikes,
    uint[] memory skews
  ) external override onlyOwner returns (uint) {
    // strike and skew length must match and must have at least 1
    _require(strikes.length == skews.length && strikes.length > 0, Error.StrikeSkewLengthMismatch);
    // We do not support expiry more than 10 weeks out, as it locks collateral for the entire duration
    _require(expiry.sub(block.timestamp) < 10 weeks, Error.BoardMaxExpiryReached);

    if (expiry > maxExpiryTimestamp) {
      _require(liveBoards.length == 0, Error.CannotStartNewRoundWhenBoardsExist);
      liquidityPool.startRound(maxExpiryTimestamp, expiry);
      maxExpiryTimestamp = expiry;
    }

    uint boardId = nextBoardId++;
    optionBoards[boardId].id = boardId;
    optionBoards[boardId].expiry = expiry;
    optionBoards[boardId].iv = baseIV;

    liveBoards.push(boardId);

    emit BoardCreated(boardId, expiry, baseIV);

    for (uint i = 0; i < strikes.length; i++) {
      _addListingToBoard(boardId, strikes[i], skews[i]);
    }

    greekCache.addBoard(boardId);

    return boardId;
  }

  /**
   * @dev Add a listing to an existing board in the OptionMarket.
   *
   * @param boardId The id of the board which the listing will be added
   * @param strike Strike of the Listing
   * @param skew Skew of the Listing
   */
  function addListingToBoard(
    uint boardId,
    uint strike,
    uint skew
  ) external override onlyOwner {
    OptionBoard storage board = optionBoards[boardId];
    _require(board.id == boardId, Error.InvalidBoardId);

    uint listingId = _addListingToBoard(boardId, strike, skew);
    greekCache.addListingToBoard(boardId, listingId);
  }

  /**
   * @dev Add a listing to an existing board.
   */
  function _addListingToBoard(
    uint boardId,
    uint strike,
    uint skew
  ) internal returns (uint listingId) {
    uint listingId = nextListingId;
    nextListingId += 4;
    optionListings[listingId] = OptionListing(listingId, strike, skew, 0, 0, 0, 0, boardId);
    optionBoards[boardId].listingIds.push(listingId);
    emit ListingAdded(boardId, listingId, strike, skew);
    return listingId;
  }

  ///////////
  // Views //
  ///////////

  /**
   * @dev Returns the list of live board ids.
   */
  function getLiveBoards() external view override returns (uint[] memory _liveBoards) {
    _liveBoards = new uint[](liveBoards.length);
    for (uint i = 0; i < liveBoards.length; i++) {
      _liveBoards[i] = liveBoards[i];
    }
  }

  /**
   * @dev Returns the listing ids for a given `boardId`.
   *
   * @param boardId The id of the relevant OptionBoard.
   */
  function getBoardListings(uint boardId) external view override returns (uint[] memory) {
    uint[] memory listingIds = new uint[](optionBoards[boardId].listingIds.length);
    for (uint i = 0; i < optionBoards[boardId].listingIds.length; i++) {
      listingIds[i] = optionBoards[boardId].listingIds[i];
    }
    return listingIds;
  }

  ////////////////////
  // User functions //
  ////////////////////

  /**
   * @dev Opens a position, which may be long call, long put, short call or short put.
   *
   * @param _listingId The id of the relevant OptionListing.
   * @param tradeType Is the trade long or short?
   * @param amount The amount the user has requested to trade.
   */
  function openPosition(
    uint _listingId,
    TradeType tradeType,
    uint amount
  ) external override returns (uint totalCost) {
    _require(int(amount) > 0 && uint(TradeType.SHORT_PUT) >= uint(tradeType), Error.ZeroAmountOrInvalidTradeType);

    bool isLong = tradeType == TradeType.LONG_CALL || tradeType == TradeType.LONG_PUT;

    OptionListing storage listing = optionListings[_listingId];
    OptionBoard storage board = optionBoards[listing.boardId];

    (
      LyraGlobals.PricingGlobals memory pricingGlobals,
      LyraGlobals.ExchangeGlobals memory exchangeGlobals,
      uint tradingCutoff
    ) = globals.getGlobalsForOptionTrade(address(this), isLong);

    // Note: call will fail here if it is an invalid boardId (expiry will be 0)
    _require(!board.frozen && block.timestamp + tradingCutoff < board.expiry, Error.BoardFrozenOrTradingCutoffReached);

    Trade memory trade =
      Trade({
        isBuy: isLong,
        amount: amount,
        vol: board.iv.multiplyDecimalRound(listing.skew),
        expiry: board.expiry,
        liquidity: liquidityPool.getLiquidity(exchangeGlobals.spotPrice, exchangeGlobals.short)
      });

    optionToken.mint(msg.sender, _listingId + uint(tradeType), amount);

    if (tradeType == TradeType.LONG_CALL) {
      listing.longCall = listing.longCall.add(amount);
    } else if (tradeType == TradeType.SHORT_CALL) {
      listing.shortCall = listing.shortCall.add(amount);
    } else if (tradeType == TradeType.LONG_PUT) {
      listing.longPut = listing.longPut.add(amount);
    } else {
      listing.shortPut = listing.shortPut.add(amount);
    }

    totalCost = _doTrade(listing, board, trade, pricingGlobals);

    if (tradeType == TradeType.LONG_CALL) {
      liquidityPool.lockBase(amount, exchangeGlobals, trade.liquidity);
      _require(quoteAsset.transferFrom(msg.sender, address(liquidityPool), totalCost), Error.QuoteTransferFailed);
    } else if (tradeType == TradeType.LONG_PUT) {
      liquidityPool.lockQuote(amount.multiplyDecimal(listing.strike), trade.liquidity.freeCollatLiquidity);
      _require(quoteAsset.transferFrom(msg.sender, address(liquidityPool), totalCost), Error.QuoteTransferFailed);
    } else if (tradeType == TradeType.SHORT_CALL) {
      _require(baseAsset.transferFrom(msg.sender, address(shortCollateral), amount), Error.BaseTransferFailed);
      liquidityPool.sendPremium(msg.sender, totalCost, trade.liquidity.freeCollatLiquidity);
    } else {
      _require(
        quoteAsset.transferFrom(msg.sender, address(shortCollateral), amount.multiplyDecimal(listing.strike)),
        Error.QuoteTransferFailed
      );
      liquidityPool.sendPremium(msg.sender, totalCost, trade.liquidity.freeCollatLiquidity);
    }

    emit PositionOpened(msg.sender, _listingId, tradeType, amount, totalCost);
  }

  /**
   * @dev Closes some amount of an open position. The user does not have to close the whole position.
   *
   * @param _listingId The id of the relevant OptionListing.
   * @param tradeType Is the trade long or short?
   * @param amount The amount the user has requested to trade.
   */
  function closePosition(
    uint _listingId,
    TradeType tradeType,
    uint amount
  ) external override returns (uint totalCost) {
    _require(int(amount) > 0 && uint(TradeType.SHORT_PUT) >= uint(tradeType), Error.ZeroAmountOrInvalidTradeType);

    bool isLong = tradeType == TradeType.LONG_CALL || tradeType == TradeType.LONG_PUT;

    OptionListing storage listing = optionListings[_listingId];
    OptionBoard storage board = optionBoards[listing.boardId];

    (
      LyraGlobals.PricingGlobals memory pricingGlobals,
      LyraGlobals.ExchangeGlobals memory exchangeGlobals,
      uint tradingCutoff
    ) = globals.getGlobalsForOptionTrade(address(this), !isLong);

    _require(!board.frozen && block.timestamp + tradingCutoff < board.expiry, Error.BoardFrozenOrTradingCutoffReached);

    Trade memory trade =
      Trade({
        isBuy: !isLong,
        amount: amount,
        vol: board.iv.multiplyDecimalRound(listing.skew),
        expiry: board.expiry,
        liquidity: liquidityPool.getLiquidity(exchangeGlobals.spotPrice, exchangeGlobals.short)
      });

    optionToken.burn(msg.sender, _listingId + uint(tradeType), amount);

    if (tradeType == TradeType.LONG_CALL) {
      listing.longCall = listing.longCall.sub(amount);
    } else if (tradeType == TradeType.SHORT_CALL) {
      listing.shortCall = listing.shortCall.sub(amount);
    } else if (tradeType == TradeType.LONG_PUT) {
      listing.longPut = listing.longPut.sub(amount);
    } else {
      listing.shortPut = listing.shortPut.sub(amount);
    }
    totalCost = _doTrade(listing, board, trade, pricingGlobals);

    if (tradeType == TradeType.LONG_CALL) {
      liquidityPool.freeBase(amount);
      liquidityPool.sendPremium(msg.sender, totalCost, trade.liquidity.freeCollatLiquidity);
    } else if (tradeType == TradeType.LONG_PUT) {
      liquidityPool.freeQuoteCollateral(amount.multiplyDecimal(listing.strike));
      liquidityPool.sendPremium(msg.sender, totalCost, trade.liquidity.freeCollatLiquidity);
    } else if (tradeType == TradeType.SHORT_CALL) {
      shortCollateral.sendBaseCollateral(msg.sender, amount);
      _require(quoteAsset.transferFrom(msg.sender, address(liquidityPool), totalCost), Error.QuoteTransferFailed);
    } else {
      shortCollateral.sendQuoteCollateral(msg.sender, amount.multiplyDecimal(listing.strike).sub(totalCost));
      shortCollateral.sendQuoteCollateral(address(liquidityPool), totalCost);
    }

    emit PositionClosed(msg.sender, _listingId, tradeType, amount, totalCost);
  }

  /**
   * @dev Determine the cost of the trade and update the system's iv/skew parameters.
   *
   * @param listing The relevant OptionListing.
   * @param board The relevant OptionBoard.
   * @param trade The trade parameters.
   * @param pricingGlobals The pricing globals.
   */
  function _doTrade(
    OptionListing storage listing,
    OptionBoard storage board,
    Trade memory trade,
    LyraGlobals.PricingGlobals memory pricingGlobals
  ) internal returns (uint) {
    (uint totalCost, uint newIv, uint newSkew) =
      optionPricer.updateCacheAndGetTotalCost(listing, trade, pricingGlobals, board.iv);
    listing.skew = newSkew;
    board.iv = newIv;

    emit BoardBaseIvSet(board.id, newIv);
    emit ListingSkewSet(listing.id, newSkew);
    return totalCost;
  }

  /**
   * @dev Liquidates a board that has passed expiry. This function will not preserve the ordering of liveBoards.
   *
   * @param boardId The id of the relevant OptionBoard.
   */
  function liquidateExpiredBoard(uint boardId) external override {
    OptionBoard memory board = optionBoards[boardId];
    _require(board.expiry <= block.timestamp, Error.BoardNotExpired);
    bool popped = false;
    // Find and remove the board from the list of live boards
    for (uint i = 0; i < liveBoards.length; i++) {
      if (liveBoards[i] == boardId) {
        liveBoards[i] = liveBoards[liveBoards.length - 1];
        liveBoards.pop();
        popped = true;
        break;
      }
    }
    // prevent old boards being liquidated
    _require(popped, Error.BoardAlreadyLiquidated);

    _liquidateExpiredBoard(board);
    greekCache.removeBoard(boardId);
  }

  /**
   * @dev Liquidates an expired board.
   * It will transfer all short collateral for ITM options that the market owns.
   * It will reserve collateral for users to settle their ITM long options.
   *
   * @param board The relevant OptionBoard.
   */
  function _liquidateExpiredBoard(OptionBoard memory board) internal {
    LyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(this), ILyraGlobals.ExchangeType.ALL);

    uint totalUserLongProfitQuote;
    uint totalBoardLongCallCollateral;
    uint totalBoardLongPutCollateral;
    uint totalAMMShortCallProfitBase;
    uint totalAMMShortPutProfitQuote;

    // Store the price now for when users come to settle their options
    boardToPriceAtExpiry[board.id] = exchangeGlobals.spotPrice;

    for (uint i = 0; i < board.listingIds.length; i++) {
      OptionListing memory listing = optionListings[board.listingIds[i]];

      totalBoardLongCallCollateral = totalBoardLongCallCollateral.add(listing.longCall);
      totalBoardLongPutCollateral = totalBoardLongPutCollateral.add(listing.longPut.multiplyDecimal(listing.strike));

      if (exchangeGlobals.spotPrice > listing.strike) {
        // For long calls
        totalUserLongProfitQuote = totalUserLongProfitQuote.add(
          listing.longCall.multiplyDecimal(exchangeGlobals.spotPrice - listing.strike)
        );

        // Per unit of shortCalls
        uint amountReservedBase =
          (exchangeGlobals.spotPrice - listing.strike)
            .divideDecimal(SafeDecimalMath.UNIT.sub(exchangeGlobals.baseQuoteFeeRate))
            .divideDecimal(exchangeGlobals.spotPrice);
        // This is impossible unless the baseAsset price has gone up ~900%+
        if (amountReservedBase > SafeDecimalMath.UNIT) {
          amountReservedBase = SafeDecimalMath.UNIT;
        }

        totalAMMShortCallProfitBase = totalAMMShortCallProfitBase.add(
          amountReservedBase.multiplyDecimal(listing.shortCall)
        );
        listingToBaseReturnedRatio[listing.id] = SafeDecimalMath.UNIT.sub(amountReservedBase);
      } else {
        listingToBaseReturnedRatio[listing.id] = SafeDecimalMath.UNIT;
      }

      if (exchangeGlobals.spotPrice < listing.strike) {
        // if amount > 0 can be skipped as it will be multiplied by 0
        totalUserLongProfitQuote = totalUserLongProfitQuote.add(
          listing.longPut.multiplyDecimal(listing.strike - exchangeGlobals.spotPrice)
        );
        totalAMMShortPutProfitQuote = totalAMMShortPutProfitQuote.add(
          (listing.strike - exchangeGlobals.spotPrice).multiplyDecimal(listing.shortPut)
        );
      }
    }

    shortCollateral.sendToLP(totalAMMShortCallProfitBase, totalAMMShortPutProfitQuote);

    // This will batch all base we want to convert to quote and sell it in one transaction
    liquidityPool.boardLiquidation(totalBoardLongPutCollateral, totalUserLongProfitQuote, totalBoardLongCallCollateral);

    emit BoardLiquidated(
      board.id,
      totalUserLongProfitQuote,
      totalBoardLongCallCollateral,
      totalBoardLongPutCollateral,
      totalAMMShortCallProfitBase,
      totalAMMShortPutProfitQuote
    );
  }

  /**
   * @dev Settles options for expired and liquidated listings. Also functions as the way to reclaim capital for options
   * sold to the market.
   *
   * @param listingId The id of the relevant OptionListing.
   */
  function settleOptions(uint listingId, TradeType tradeType) external override {
    uint amount = optionToken.balanceOf(msg.sender, listingId + uint(tradeType));

    shortCollateral.processSettle(
      listingId,
      msg.sender,
      tradeType,
      amount,
      optionListings[listingId].strike,
      boardToPriceAtExpiry[optionListings[listingId].boardId],
      listingToBaseReturnedRatio[listingId]
    );

    optionToken.burn(msg.sender, listingId + uint(tradeType), amount);
  }

  ////
  // Misc
  ////

  function _require(bool pass, Error error) internal view {
    require(pass, errorMessages[uint(error)]);
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner virtual {
    _require(owner == msg.sender, Error.OnlyOwner);
    _;
  }

  // Events
  /**
   * @dev Emitted when a Board is created.
   */
  event BoardCreated(uint indexed boardId, uint expiry, uint baseIv);

  /**
   * @dev Emitted when a Board frozen is updated.
   */
  event BoardFrozen(uint indexed boardId, bool frozen);

  /**
   * @dev Emitted when a Board new baseIv is set.
   */
  event BoardBaseIvSet(uint indexed boardId, uint baseIv);

  /**
   * @dev Emitted when a Listing new skew is set.
   */
  event ListingSkewSet(uint indexed listingId, uint skew);

  /**
   * @dev Emitted when a Listing is added to a board
   */
  event ListingAdded(uint indexed boardId, uint indexed listingId, uint strike, uint skew);

  /**
   * @dev Emitted when a Position is opened.
   */
  event PositionOpened(
    address indexed trader,
    uint indexed listingId,
    TradeType indexed tradeType,
    uint amount,
    uint totalCost
  );

  /**
   * @dev Emitted when a Position is closed.
   */
  event PositionClosed(
    address indexed trader,
    uint indexed listingId,
    TradeType indexed tradeType,
    uint amount,
    uint totalCost
  );

  /**
   * @dev Emitted when a Board is liquidated.
   */
  event BoardLiquidated(
    uint indexed boardId,
    uint totalUserLongProfitQuote,
    uint totalBoardLongCallCollateral,
    uint totalBoardLongPutCollateral,
    uint totalAMMShortCallProfitBase,
    uint totalAMMShortPutProfitQuote
  );

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}
