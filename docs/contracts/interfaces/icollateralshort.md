# `ICollateralShort`

## Functions:

- `loans(uint256 id) (external)`

- `minCratio() (external)`

- `minCollateral() (external)`

- `issueFeeRate() (external)`

- `open(uint256 collateral, uint256 amount, bytes32 currency) (external)`

- `repay(address borrower, uint256 id, uint256 amount) (external)`

- `repayWithCollateral(uint256 id, uint256 repayAmount) (external)`

- `draw(uint256 id, uint256 amount) (external)`

- `deposit(address borrower, uint256 id, uint256 amount) (external)`

- `withdraw(uint256 id, uint256 amount) (external)`

- `getShortAndCollateral(address account, uint256 id) (external)`

### Function `loans(uint256 id) → uint256, address, uint256, bytes32, uint256, bool, uint256, uint256, uint256 external`

### Function `minCratio() → uint256 external`

### Function `minCollateral() → uint256 external`

### Function `issueFeeRate() → uint256 external`

### Function `open(uint256 collateral, uint256 amount, bytes32 currency) → uint256 id external`

### Function `repay(address borrower, uint256 id, uint256 amount) → uint256 short, uint256 collateral external`

### Function `repayWithCollateral(uint256 id, uint256 repayAmount) → uint256 short, uint256 collateral external`

### Function `draw(uint256 id, uint256 amount) → uint256 short, uint256 collateral external`

### Function `deposit(address borrower, uint256 id, uint256 amount) → uint256 short, uint256 collateral external`

### Function `withdraw(uint256 id, uint256 amount) → uint256 short, uint256 collateral external`

### Function `getShortAndCollateral(address account, uint256 id) → uint256 short, uint256 collateral external`
