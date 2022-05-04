# `OptionToken`

Provides a tokenized representation of each trade position including amount of options and collateral.

## Modifiers:

- `onlyOptionMarket()`

- `onlyShortCollateral()`

## Functions:

- `constructor(string name, string symbol) (public)`

- `init(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, address _shortCollateral, contract SynthetixAdapter _synthetixAdapter) (external)`

- `setPartialCollateralParams(struct OptionToken.PartialCollateralParameters _partialCollatParams) (external)`

- `setURI(string newURI) (external)`

- `_baseURI() (internal)`

- `adjustPosition(struct OptionMarket.TradeParameters trade, uint256 strikeId, address trader, uint256 _positionId, uint256 optionCost, uint256 setCollateralTo, bool isOpen) (external)`

- `addCollateral(uint256 positionId, uint256 amountCollateral) (external)`

- `settlePositions(uint256[] positionIds) (external)`

- `liquidate(uint256 positionId, struct OptionMarket.TradeParameters trade, uint256 totalCost) (external)`

- `canLiquidate(struct OptionToken.OptionPosition position, uint256 expiry, uint256 strikePrice, uint256 spotPrice) (public)`

- `getLiquidationFees(uint256 gwavPremium, uint256 userPositionCollateral, uint256 convertedMinLiquidationFee, uint256 insolvencyMultiplier) (public)`

- `split(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) (external)`

- `merge(uint256[] positionIds) (external)`

- `_isShort(enum OptionMarket.OptionType optionType) (internal)`

- `getPositionState(uint256 positionId) (external)`

- `getOptionPosition(uint256 positionId) (external)`

- `getOptionPositions(uint256[] positionIds) (external)`

- `getPositionWithOwner(uint256 positionId) (external)`

- `getPositionsWithOwner(uint256[] positionIds) (external)`

- `getOwnerPositions(address owner) (external)`

- `_getPositionWithOwner(uint256 positionId) (internal)`

- `getPartialCollatParams() (external)`

- `_beforeTokenTransfer(address from, address to, uint256 tokenId) (internal)`

## Events:

- `PositionUpdated(uint256 positionId, address owner, enum OptionToken.PositionUpdatedType updatedType, struct OptionToken.OptionPosition position, uint256 timestamp)`

### Modifier `onlyOptionMarket()`

### Modifier `onlyShortCollateral()`

### Function `constructor(string name, string symbol) public`

### Function `init(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, address _shortCollateral, contract SynthetixAdapter _synthetixAdapter) external`

Initialise the contract.

#### Parameters:

- `_optionMarket`: The OptionMarket contract address.

### Function `setPartialCollateralParams(struct OptionToken.PartialCollateralParameters _partialCollatParams) external`

### Function `setURI(string newURI) external`

#### Parameters:

- `newURI`: The new uri definition for the contract.

### Function `_baseURI() → string internal`

### Function `adjustPosition(struct OptionMarket.TradeParameters trade, uint256 strikeId, address trader, uint256 _positionId, uint256 optionCost, uint256 setCollateralTo, bool isOpen) → uint256, int256 pendingCollateral external`

### Function `addCollateral(uint256 positionId, uint256 amountCollateral) → enum OptionMarket.OptionType optionType external`

### Function `settlePositions(uint256[] positionIds) external`

### Function `liquidate(uint256 positionId, struct OptionMarket.TradeParameters trade, uint256 totalCost) → struct OptionToken.LiquidationFees liquidationFees external`

### Function `canLiquidate(struct OptionToken.OptionPosition position, uint256 expiry, uint256 strikePrice, uint256 spotPrice) → bool public`

### Function `getLiquidationFees(uint256 gwavPremium, uint256 userPositionCollateral, uint256 convertedMinLiquidationFee, uint256 insolvencyMultiplier) → struct OptionToken.LiquidationFees liquidationFees public`

### Function `split(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) → uint256 newPositionId external`

User can split position into desired amount and collateral

Only ACTIVE positions can be owned by users, so status does not need to be checked

### Function `merge(uint256[] positionIds) external`

User can merge many positions with matching strike and optionType into a single position

Only ACTIVE positions can be owned by users, so status does not need to be checked

### Function `_isShort(enum OptionMarket.OptionType optionType) → bool shortPosition internal`

### Function `getPositionState(uint256 positionId) → enum OptionToken.PositionState external`

### Function `getOptionPosition(uint256 positionId) → struct OptionToken.OptionPosition external`

### Function `getOptionPositions(uint256[] positionIds) → struct OptionToken.OptionPosition[] external`

### Function `getPositionWithOwner(uint256 positionId) → struct OptionToken.PositionWithOwner external`

### Function `getPositionsWithOwner(uint256[] positionIds) → struct OptionToken.PositionWithOwner[] external`

### Function `getOwnerPositions(address owner) → struct OptionToken.OptionPosition[] external`

### Function `_getPositionWithOwner(uint256 positionId) → struct OptionToken.PositionWithOwner internal`

### Function `getPartialCollatParams() → struct OptionToken.PartialCollateralParameters external`

### Function `_beforeTokenTransfer(address from, address to, uint256 tokenId) internal`

### Event `PositionUpdated(uint256 positionId, address owner, enum OptionToken.PositionUpdatedType updatedType, struct OptionToken.OptionPosition position, uint256 timestamp)`

Emitted when a position is minted, adjusted, burned, merged or split.
