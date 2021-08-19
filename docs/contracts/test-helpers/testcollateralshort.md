# `TestCollateralShort`

## Functions:

- `init(contract LyraGlobals _globals, contract ITestERC20 _quoteAsset) (external)`

- `addBaseAsset(bytes32 ticker, contract ITestERC20 baseAsset, address market) (external)`

- `open(uint256 collateral, uint256 amount, bytes32 currency) (external)`

- `draw(uint256 id, uint256 amount) (external)`

- `repay(address account, uint256 id, uint256 amount) (external)`

- `repayWithCollateral(uint256 id, uint256 amount) (external)`

- `deposit(address borrower, uint256 id, uint256 amount) (external)`

- `withdraw(uint256 id, uint256 amount) (external)`

- `getShortAndCollateral(address account, uint256 id) (external)`

- `createTestEmptyLoanForAccount(address account) (external)`

- `testForceClose(uint256 id) (external)`

### Function `init(contract LyraGlobals _globals, contract ITestERC20 _quoteAsset) external`

### Function `addBaseAsset(bytes32 ticker, contract ITestERC20 baseAsset, address market) external`

### Function `open(uint256 collateral, uint256 amount, bytes32 currency) → uint256 id external`

### Function `draw(uint256 id, uint256 amount) → uint256, uint256 external`

### Function `repay(address account, uint256 id, uint256 amount) → uint256, uint256 external`

### Function `repayWithCollateral(uint256 id, uint256 amount) → uint256, uint256 external`

### Function `deposit(address borrower, uint256 id, uint256 amount) → uint256, uint256 external`

### Function `withdraw(uint256 id, uint256 amount) → uint256, uint256 external`

### Function `getShortAndCollateral(address account, uint256 id) → uint256, uint256 external`

### Function `createTestEmptyLoanForAccount(address account) external`

### Function `testForceClose(uint256 id) external`
