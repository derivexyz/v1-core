//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "../synthetix/SafeDecimalMath.sol";

// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOptionMarket.sol";
import "../interfaces/IOptionToken.sol";

/**
 * @title OptionMarketSafeSlippage
 * @author Lyra
 * @dev Allows users to set the min/max price they want to purchase options for, to help prevent frontrunning or
 * sandwich attacks.
 */
contract OptionMarketSafeSlippage {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  // the OptionMarket contract
  IOptionMarket internal optionMarket;
  IOptionToken internal optionToken;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;

  bool internal initialized = false;
  uint internal constant UINT_MAX = ~uint(0);

  constructor() {}

  /**
   * @dev Initialises the contract
   *
   * @param _optionMarket The optionMarket contract address
   * @param _optionToken The optionToken contract address
   * @param _quoteAsset The quoteAsset contract address
   * @param _baseAsset The baseAsset contract address
   */
  function init(
    IOptionMarket _optionMarket,
    IOptionToken _optionToken,
    IERC20 _quoteAsset,
    IERC20 _baseAsset
  ) external {
    require(!initialized, "already initialized");
    optionMarket = _optionMarket;
    optionToken = _optionToken;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;

    require(baseAsset.approve(address(optionMarket), UINT_MAX), "Base approval failed");
    require(quoteAsset.approve(address(optionMarket), UINT_MAX), "Quote approval failed");
    initialized = true;
  }

  /**
   * @dev Attempts to open positions within bounds, reverts if the returned amount is outside of the accepted bounds.
   *
   * @param _listingId The id of the relevant OptionListing
   * @param tradeType Is the trade a long/short & call/put?
   * @param amount The amount the user has requested to trade
   * @param maxCost Max cost user is willing to pay
   * @param minCost Min cost user is willing to pay
   */
  function openPosition(
    uint _listingId,
    IOptionMarket.TradeType tradeType,
    uint amount,
    uint minCost,
    uint maxCost
  ) external {
    if (tradeType == IOptionMarket.TradeType.LONG_CALL || tradeType == IOptionMarket.TradeType.LONG_PUT) {
      require(quoteAsset.transferFrom(msg.sender, address(this), maxCost), "quote transferFrom failed");
    } else if (tradeType == IOptionMarket.TradeType.SHORT_CALL) {
      require(baseAsset.transferFrom(msg.sender, address(this), amount), "base transferFrom failed");
    } else {
      (, uint strike, , , , , , ) = optionMarket.optionListings(_listingId);
      require(
        quoteAsset.transferFrom(msg.sender, address(this), amount.multiplyDecimal(strike)),
        "quote transferFrom failed"
      );
    }

    uint totalCost = optionMarket.openPosition(_listingId, tradeType, amount);
    require(minCost <= totalCost && totalCost <= maxCost, "Total cost outside specified bounds");

    uint quoteBalance = quoteAsset.balanceOf(address(this));
    if (quoteBalance > 0) {
      require(quoteAsset.transfer(msg.sender, quoteBalance), "quote transfer failed");
    }

    optionToken.safeTransferFrom(
      address(this),
      msg.sender,
      _listingId + uint(tradeType),
      amount,
      "OptionMarketSafeSlippage: Open"
    );

    emit PositionOpenedWithSlippageControls(msg.sender, _listingId, tradeType, amount, minCost, maxCost, totalCost);
  }

  /**
   * @dev Attempts to close some amount of an open position within bounds, reverts if the returned amount is outside of
   * the accepted bounds.
   *
   * @param _listingId The id of the relevant OptionListing
   * @param tradeType Is the trade a long/short & call/put?
   * @param amount The amount the user has requested to close
   * @param maxCost Max amount for the cost of the trade
   * @param minCost Min amount for the cost of the trade
   */
  function closePosition(
    uint _listingId,
    IOptionMarket.TradeType tradeType,
    uint amount,
    uint minCost,
    uint maxCost
  ) external {
    optionToken.safeTransferFrom(
      msg.sender,
      address(this),
      _listingId + uint(tradeType),
      amount,
      "OptionMarketSafeSlippage: Close"
    );

    if (tradeType == IOptionMarket.TradeType.SHORT_CALL) {
      require(quoteAsset.transferFrom(msg.sender, address(this), maxCost), "Failed to transferFrom quote");
    }

    uint totalCost = optionMarket.closePosition(_listingId, tradeType, amount);

    require(minCost <= totalCost && totalCost <= maxCost, "Total cost outside specified bounds");

    uint quoteBalance = quoteAsset.balanceOf(address(this));
    if (quoteBalance > 0) {
      require(quoteAsset.transfer(msg.sender, quoteBalance), "Failed to transfer quote");
    }

    uint baseBalance = baseAsset.balanceOf(address(this));
    if (baseBalance > 0) {
      require(baseAsset.transfer(msg.sender, baseBalance), "Failed to transfer base");
    }

    emit PositionClosedWithSlippageControls(msg.sender, _listingId, tradeType, amount, minCost, maxCost, totalCost);
  }

  /**
   * @dev Emitted when a Position is opened.
   */
  event PositionOpenedWithSlippageControls(
    address indexed trader,
    uint indexed listingId,
    IOptionMarket.TradeType indexed tradeType,
    uint amount,
    uint minCost,
    uint maxCost,
    uint totalCost
  );

  /**
   * @dev Emitted when a Position is closed.
   */
  event PositionClosedWithSlippageControls(
    address indexed trader,
    uint indexed listingId,
    IOptionMarket.TradeType indexed tradeType,
    uint amount,
    uint minCost,
    uint maxCost,
    uint totalCost
  );
}
