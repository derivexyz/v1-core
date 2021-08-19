//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/ICollateralShort.sol";
import "../interfaces/ITestERC20.sol";
import "../interfaces/IExchangeRates.sol";
import "../synthetix/SafeDecimalMath.sol";
import "../LyraGlobals.sol";

contract TestCollateralShort is ICollateralShort, Ownable {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  uint public override minCratio = (12 * 1e18) / 10;
  uint public override minCollateral = 1000 * 1e18;
  uint public override issueFeeRate = (5 * 1e18) / 1000; // 0.5%

  LyraGlobals internal globals;
  ITestERC20 internal quoteAsset;

  mapping(bytes32 => ITestERC20) baseAssets;
  mapping(bytes32 => address) markets;

  uint internal nextLoanId = 1;
  mapping(uint => Loan) public override loans;

  bool initialized = false;

  constructor() Ownable() {}

  function init(LyraGlobals _globals, ITestERC20 _quoteAsset) external {
    require(!initialized, "contract already initialized");
    globals = _globals;
    quoteAsset = _quoteAsset;
    initialized = true;
  }

  function addBaseAsset(
    bytes32 ticker,
    ITestERC20 baseAsset,
    address market
  ) external onlyOwner {
    require(market != address(0), "market cannot be 0");
    require(baseAsset != ITestERC20(0), "baseAsset cannot be 0");
    baseAssets[ticker] = baseAsset;
    markets[ticker] = market;
  }

  function open(
    uint collateral,
    uint amount,
    bytes32 currency
  ) external override returns (uint id) {
    Loan memory loan =
      Loan({
        id: nextLoanId++,
        account: msg.sender,
        collateral: collateral,
        currency: currency,
        amount: amount,
        short: true,
        accruedInterest: 0,
        interestIndex: 1,
        lastInteraction: block.timestamp
      });
    uint price = globals.getSpotPriceForMarket(markets[currency]);

    require(collateral >= minCollateral, "must provide more than minCollateral");
    require(price.multiplyDecimal(loan.amount) < loan.collateral.multiplyDecimal(minCratio), "not enough collateral");

    quoteAsset.mint(msg.sender, price.multiplyDecimal(loan.amount).multiplyDecimalRound(1e18 - issueFeeRate));
    quoteAsset.burn(msg.sender, collateral);

    loans[loan.id] = loan;

    return loan.id;
  }

  function draw(uint id, uint amount) external override returns (uint, uint) {
    Loan storage loan = loans[id];
    require(loan.account == msg.sender, "draw: loan.account mismatch");
    uint price = globals.getSpotPriceForMarket(markets[loan.currency]);

    loan.amount += amount;
    quoteAsset.mint(msg.sender, price.multiplyDecimal(amount).multiplyDecimalRound(1e18 - issueFeeRate));
    require(price.multiplyDecimal(loan.amount) < loan.collateral.multiplyDecimal(minCratio), "not enough collateral");

    return (loan.amount, loan.collateral);
  }

  function repay(
    address account,
    uint id,
    uint amount
  ) external override returns (uint, uint) {
    Loan storage loan = loans[id];
    uint price = globals.getSpotPriceForMarket(markets[loan.currency]);
    ITestERC20 baseAsset = baseAssets[loan.currency];

    // Burning user's baseAsset
    baseAsset.burn(msg.sender, amount);
    loan.amount = loan.amount.sub(amount);

    require(price.multiplyDecimal(loan.amount) < loan.collateral.multiplyDecimal(minCratio), "not enough collateral");

    return (loan.amount, loan.collateral);
  }

  function repayWithCollateral(uint id, uint amount) external override returns (uint, uint) {
    Loan storage loan = loans[id];
    require(loan.account == msg.sender, "only loan account");
    uint price = globals.getSpotPriceForMarket(markets[loan.currency]);

    // Converting and burning user's collateral

    // Not perfect, but represents a larger loss than just the simple conversion
    loan.collateral = loan.collateral.sub(price.multiplyDecimal(amount).divideDecimalRound(1e18 - issueFeeRate));
    loan.amount = loan.amount.sub(amount);

    require(price.multiplyDecimal(loan.amount) <= loan.collateral.multiplyDecimal(minCratio), "not enough collateral");

    return (loan.amount, loan.collateral);
  }

  function deposit(
    address borrower,
    uint id,
    uint amount
  ) external override returns (uint, uint) {
    quoteAsset.burn(msg.sender, amount);
    Loan storage loan = loans[id];
    loan.collateral += amount;

    return (loan.amount, loan.collateral);
  }

  function withdraw(uint id, uint amount) external override returns (uint, uint) {
    Loan storage loan = loans[id];
    require(loan.account == msg.sender, "withdraw: loan.account mismatch");

    loan.collateral = loan.collateral.sub(amount);
    quoteAsset.mint(msg.sender, amount);

    uint price = globals.getSpotPriceForMarket(markets[loan.currency]);
    require(
      price.multiplyDecimal(loan.amount) <= loan.collateral.multiplyDecimal(minCratio),
      "withdrawing drops ratio too much"
    );

    return (loan.amount, loan.collateral);
  }

  function getShortAndCollateral(address account, uint id) external view override returns (uint, uint) {
    Loan memory loan = loans[id];
    return (loan.amount, loan.collateral);
  }

  // Methods for testing

  function createTestEmptyLoanForAccount(address account) external onlyOwner {
    Loan memory loan =
      Loan({
        id: nextLoanId++,
        account: account,
        collateral: 0,
        currency: "",
        amount: 0,
        short: true,
        accruedInterest: 0,
        interestIndex: 1,
        lastInteraction: block.timestamp
      });

    loans[loan.id] = loan;
  }

  function testForceClose(uint id) external onlyOwner {
    loans[id].interestIndex = 0;
  }
}
