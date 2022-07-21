# `LiquidityToken`

An ERC20 token which represents a share of the LiquidityPool.

It is minted when users deposit, and burned when users withdraw.

## Modifiers:

- `onlyLiquidityPool()`

## Functions:

- `constructor(string name_, string symbol_) (public)`

- `init(address _liquidityPool) (external)`

- `setLiquidityTracker(contract ILiquidityTracker _liquidityTracker) (external)`

- `mint(address account, uint256 tokenAmount) (external)`

- `burn(address account, uint256 tokenAmount) (external)`

- `_afterTokenTransfer(address from, address to, uint256 amount) (internal)`

## Events:

- `LiquidityTrackerSet(contract ILiquidityTracker liquidityTracker)`

### Modifier `onlyLiquidityPool()`

### Function `constructor(string name_, string symbol_) public`

#### Parameters:

- `name_`: Token collection name

- `symbol_`: Token collection symbol

### Function `init(address _liquidityPool) external`

Initialize the contract.

#### Parameters:

- `_liquidityPool`: LiquidityPool address

### Function `setLiquidityTracker(contract ILiquidityTracker _liquidityTracker) external`

### Function `mint(address account, uint256 tokenAmount) external`

Mints new tokens and transfers them to `owner`.

### Function `burn(address account, uint256 tokenAmount) external`

Burn new tokens and transfers them to `owner`.

### Function `_afterTokenTransfer(address from, address to, uint256 amount) internal`

Override to track the liquidty of the token. Mint, address(0), burn - to, address(0)

### Event `LiquidityTrackerSet(contract ILiquidityTracker liquidityTracker)`
