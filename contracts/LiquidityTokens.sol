//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Libraries
import "./synthetix/DecimalMath.sol";
// Inherited
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./synthetix/Owned.sol";
import "./lib/SimpleInitializeable.sol";

// Interfaces
import "./interfaces/ILiquidityTracker.sol";

/**
 * @title LiquidityTokens
 * @author Lyra
 * @dev An ERC20 token which represents a share of the LiquidityPool.
 * It is minted when users deposit, and burned when users withdraw.
 */
contract LiquidityTokens is ERC20, Owned, SimpleInitializeable {
  using DecimalMath for uint;

  /// @dev The liquidityPool for which these tokens represent a share of
  address public liquidityPool;
  /// @dev Contract to call when liquidity gets updated. Basically a hook for future contracts to use.
  ILiquidityTracker public liquidityTracker;

  ///////////
  // Setup //
  ///////////

  /**
   * @param _name Token collection name
   * @param _symbol Token collection symbol
   */
  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) Owned() {}

  /**
   * @dev Initialize the contract.
   * @param _liquidityPool LiquidityPool address
   */
  function init(address _liquidityPool) external onlyOwner initializer {
    liquidityPool = _liquidityPool;
  }

  ///////////
  // Admin //
  ///////////

  function setLiquidityTracker(ILiquidityTracker _liquidityTracker) external onlyOwner {
    liquidityTracker = _liquidityTracker;
  }

  ////////////////////////
  // Only LiquidityPool //
  ////////////////////////

  /**
   * @dev Mints new tokens and transfers them to `owner`.
   */
  function mint(address owner, uint tokenAmount) external onlyLiquidityPool {
    _mint(owner, tokenAmount);
  }

  /**
   * @dev Burn new tokens and transfers them to `owner`.
   */
  function burn(address owner, uint tokenAmount) external onlyLiquidityPool {
    _burn(owner, tokenAmount);
  }

  //////////
  // Misc //
  //////////
  /**
   * @dev Override to track the liquidty of the token. Mint, address(0), burn - to, address(0)
   */
  function _afterTokenTransfer(
    address from,
    address to,
    uint amount
  ) internal override {
    if (address(liquidityTracker) != address(0)) {
      if (from != address(0)) {
        liquidityTracker.removeTokens(from, amount);
      }
      if (to != address(0)) {
        liquidityTracker.addTokens(to, amount);
      }
    }
  }

  ///////////////
  // Modifiers //
  ///////////////

  modifier onlyLiquidityPool() {
    if (msg.sender != liquidityPool) {
      revert OnlyLiquidityPool(address(this), msg.sender, liquidityPool);
    }
    _;
  }

  ////////////
  // Errors //
  ////////////
  // Access
  error OnlyLiquidityPool(address thrower, address caller, address liquidityPool);
}
