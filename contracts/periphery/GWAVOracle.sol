//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

// Libraries
import "../lib/GWAV.sol";
import "../lib/BlackScholes.sol";
import "../synthetix/DecimalMath.sol";

// Inherited
import "../synthetix/Owned.sol";

// Interfaces
import "../OptionMarket.sol";
import "../OptionGreekCache.sol";
import "../SynthetixAdapter.sol";

contract GWAVOracle is Owned {
  using DecimalMath for uint;

  ///////////////
  // Variables //
  ///////////////

  OptionMarket internal optionMarket;
  OptionGreekCache internal greekCache;
  SynthetixAdapter internal synthetixAdapter;

  constructor() Owned() {}

  //////////
  // init //
  //////////

  /**
   * @dev Initializes the contract
   * @param _optionMarket OptionMarket Address
   * @param _greekCache greekCache address
   * @param _synthetixAdapter synthetixAdapter address
   */

  function init(
    OptionMarket _optionMarket,
    OptionGreekCache _greekCache,
    SynthetixAdapter _synthetixAdapter
  ) external onlyOwner {
    optionMarket = _optionMarket;
    greekCache = _greekCache;
    synthetixAdapter = _synthetixAdapter;
  }

  function ivGWAV(uint boardId, uint secondsAgo) public view returns (uint) {
    return greekCache.getIvGWAV(boardId, secondsAgo);
  }

  function skewGWAV(uint strikeId, uint secondsAgo) public view returns (uint) {
    return greekCache.getSkewGWAV(strikeId, secondsAgo);
  }

  function volGWAV(uint strikeId, uint secondsAgo) public view returns (uint) {
    OptionMarket.Strike memory strike = optionMarket.getStrike(strikeId);

    return ivGWAV(strike.boardId, secondsAgo).multiplyDecimal(skewGWAV(strikeId, secondsAgo));
  }

  function deltaGWAV(uint strikeId, uint secondsAgo) external view returns (int callDelta) {
    BlackScholes.BlackScholesInputs memory bsInput = _getBsInput(strikeId);

    bsInput.volatilityDecimal = volGWAV(strikeId, secondsAgo);
    (callDelta, ) = BlackScholes.delta(bsInput);
  }

  // pure vega (not normalized for expiry)
  function vegaGWAV(uint strikeId, uint secondsAgo) external view returns (uint vega) {
    BlackScholes.BlackScholesInputs memory bsInput = _getBsInput(strikeId);

    bsInput.volatilityDecimal = volGWAV(strikeId, secondsAgo);
    vega = BlackScholes.vega(bsInput);
  }

  function pricesGWAV(uint strikeId, uint secondsAgo) external view returns (uint callPrice, uint putPrice) {
    BlackScholes.BlackScholesInputs memory bsInput = _getBsInput(strikeId);

    bsInput.volatilityDecimal = volGWAV(strikeId, secondsAgo);
    (callPrice, putPrice) = BlackScholes.optionPrices(bsInput);
  }

  //////////
  // Misc //
  //////////

  function _getBsInput(uint strikeId) internal view returns (BlackScholes.BlackScholesInputs memory bsInput) {
    (OptionMarket.Strike memory strike, OptionMarket.OptionBoard memory board) = optionMarket.getStrikeAndBoard(
      strikeId
    );

    bsInput = BlackScholes.BlackScholesInputs({
      timeToExpirySec: board.expiry - block.timestamp,
      volatilityDecimal: board.iv.multiplyDecimal(strike.skew),
      spotDecimal: synthetixAdapter.getSpotPriceForMarket(address(optionMarket)),
      strikePriceDecimal: strike.strikePrice,
      rateDecimal: greekCache.getGreekCacheParams().rateAndCarry
    });
  }
}
