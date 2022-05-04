# `LiquidityTokens`

An ERC20 token which represents a share of the LiquidityPool.

It is minted when users deposit, and burned when users withdraw.

## Modifiers:

- `onlyLiquidityPool()`

## Functions:

- `constructor(string _name, string _symbol) (public)`

- `init(address _liquidityPool) (external)`

- `setLiquidityTracker(contract ILiquidityTracker _liquidityTracker) (external)`

- `mint(address owner, uint256 tokenAmount) (external)`

- `burn(address owner, uint256 tokenAmount) (external)`

- `_afterTokenTransfer(address from, address to, uint256 amount) (internal)`

### Modifier `onlyLiquidityPool()`

### Function `constructor(string _name, string _symbol) public`

#### Parameters:

- `_name`: Token collection name

- `_symbol`: Token collection symbol

### Function `init(address _liquidityPool) external`

Initialize the contract.

#### Parameters:

- `_liquidityPool`: LiquidityPool address

### Function `setLiquidityTracker(contract ILiquidityTracker _liquidityTracker) external`

### Function `mint(address owner, uint256 tokenAmount) external`

Mints new tokens and transfers them to `owner`.

### Function `burn(address owner, uint256 tokenAmount) external`

Mints new tokens and transfers them to `owner`.

### Function `_afterTokenTransfer(address from, address to, uint256 amount) internal`

Override to track the liquidty of the token. Mint, address(0), burn - to, address(0)
