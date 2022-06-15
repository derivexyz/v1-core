# `OptionToken`

Provides a tokenized representation of each trade position including amount of options and collateral.

## Modifiers:

- `onlyOptionMarket()`

- `onlyShortCollateral()`

- `notGlobalPaused()`

## Functions:

- `constructor(string name_, string symbol_) (public)`

- `init(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, address _shortCollateral, contract SynthetixAdapter _synthetixAdapter) (external)`

- `setPartialCollateralParams(struct OptionToken.PartialCollateralParameters _partialCollatParams) (external)`

- `setURI(string newURI) (external)`

- `_baseURI() (internal)`

- `adjustPosition(struct OptionMarket.TradeParameters trade, uint256 strikeId, address trader, uint256 positionId, uint256 optionCost, uint256 setCollateralTo, bool isOpen) (external)`

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

- `getOwnerPositions(address target) (external)`

- `_getPositionWithOwner(uint256 positionId) (internal)`

- `getPartialCollatParams() (external)`

- `_requireStrikeNotExpired(uint256 strikeId) (internal)`

- `_beforeTokenTransfer(address from, address to, uint256 tokenId) (internal)`

## Events:

- `URISet(string URI)`

- `PartialCollateralParamsSet(struct OptionToken.PartialCollateralParameters partialCollateralParams)`

- `PositionUpdated(uint256 positionId, address owner, enum OptionToken.PositionUpdatedType updatedType, struct OptionToken.OptionPosition position, uint256 timestamp)`

### Modifier `onlyOptionMarket()`

### Modifier `onlyShortCollateral()`

### Modifier `notGlobalPaused()`

### Function `constructor(string name_, string symbol_) public`

### Function `init(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, address _shortCollateral, contract SynthetixAdapter _synthetixAdapter) external`

Initialise the contract.

#### Parameters:

- `_optionMarket`: The OptionMarket contract address.

### Function `setPartialCollateralParams(struct OptionToken.PartialCollateralParameters _partialCollatParams) external`

set PartialCollateralParameters

### Function `setURI(string newURI) external`

#### Parameters:

- `newURI`: The new uri definition for the contract.

### Function `_baseURI() → string internal`

### Function `adjustPosition(struct OptionMarket.TradeParameters trade, uint256 strikeId, address trader, uint256 positionId, uint256 optionCost, uint256 setCollateralTo, bool isOpen) → uint256, int256 pendingCollateral external`

Adjusts position amount and collateral when position is:

- opened

- closed

- forceClosed

- liquidated

#### Parameters:

- `trade`: TradeParameters as defined in OptionMarket.

- `strikeId`: id of strike for adjusted position.

- `trader`: owner of position.

- `positionId`: id of position.

- `optionCost`: totalCost of closing or opening position.

- `setCollateralTo`: final collateral to leave in position.

- `isOpen`: whether order is to increase or decrease position.amount.

#### Return Values:

- uint positionId of position being adjusted (relevant for new positions)

- pendingCollateral amount of additional quote to receive from msg.sender

### Function `addCollateral(uint256 positionId, uint256 amountCollateral) → enum OptionMarket.OptionType optionType external`

Only allows increase to position.collateral

#### Parameters:

- `positionId`: id of position.

- `amountCollateral`: amount of collateral to add to position.

#### Return Values:

- optionType OptionType of adjusted position

### Function `settlePositions(uint256[] positionIds) external`

burns and updates position.state when board is settled

invalid positions get caught when trying to query owner for event (or in burn)

#### Parameters:

- `positionIds`: array of position ids to settle

### Function `liquidate(uint256 positionId, struct OptionMarket.TradeParameters trade, uint256 totalCost) → struct OptionToken.LiquidationFees liquidationFees external`

checks of liquidation is valid, burns liquidation position and determines fee distribution

called when 'OptionMarket.liquidatePosition()' is called

#### Parameters:

- `positionId`: position id to liquidate

- `trade`: TradeParameters as defined in OptionMarket

- `totalCost`: totalCost paid to LiquidityPool from position.collateral (excludes liquidation fees)

### Function `canLiquidate(struct OptionToken.OptionPosition position, uint256 expiry, uint256 strikePrice, uint256 spotPrice) → bool public`

checks whether position is valid and position.collateral < minimum required collateral

useful for estimating liquidatability in different spot/strike/expiry scenarios

#### Parameters:

- `position`: any OptionPosition struct (does not need to be an existing position)

- `expiry`: expiry of option (does not need to match position.strikeId expiry)

- `strikePrice`: strike price of position

- `spotPrice`: spot price of base

### Function `getLiquidationFees(uint256 gwavPremium, uint256 userPositionCollateral, uint256 convertedMinLiquidationFee, uint256 insolvencyMultiplier) → struct OptionToken.LiquidationFees liquidationFees public`

gets breakdown of fee distribution during liquidation event

useful for estimating fees earned by all parties during liquidation

#### Parameters:

- `gwavPremium`: totalCost paid to LiquidityPool from position.collateral to close position

- `userPositionCollateral`: total collateral in position

- `convertedMinLiquidationFee`: minimum static liquidation fee (defined in partialCollatParams.minLiquidationFee)

- `insolvencyMultiplier`: used to denominate insolveny in quote in case of base collateral insolvencies

### Function `split(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) → uint256 newPositionId external`

Allows a user to split a curent position into two. The amount of the original position will

        be subtracted from and a new position will be minted with the desired amount and collateral.

Only ACTIVE positions can be owned by users, so status does not need to be checked

Both resulting positions must not be liquidatable

#### Parameters:

- `positionId`: the positionId of the original position to be split

- `newAmount`: the amount in the new position

- `newCollateral`: the amount of collateral for the new position

- `recipient`: recipient of new position

### Function `merge(uint256[] positionIds) external`

User can merge many positions with matching strike and optionType into a single position

Only ACTIVE positions can be owned by users, so status does not need to be checked.

Merged position must not be liquidatable.

#### Parameters:

- `positionIds`: the positionIds to be merged together

### Function `_isShort(enum OptionMarket.OptionType optionType) → bool shortPosition internal`

Returns bool on whether the optionType is SHORT_CALL_BASE, SHORT_CALL_QUOTE or SHORT_PUT_QUOTE

### Function `getPositionState(uint256 positionId) → enum OptionToken.PositionState external`

Returns the PositionState of a given positionId

### Function `getOptionPosition(uint256 positionId) → struct OptionToken.OptionPosition external`

Returns an OptionPosition struct of a given positionId

### Function `getOptionPositions(uint256[] positionIds) → struct OptionToken.OptionPosition[] external`

Returns an array of OptionPosition structs given an array of positionIds

### Function `getPositionWithOwner(uint256 positionId) → struct OptionToken.PositionWithOwner external`

Returns a PositionWithOwner struct of a given positionId (same as OptionPosition but with owner)

### Function `getPositionsWithOwner(uint256[] positionIds) → struct OptionToken.PositionWithOwner[] external`

Returns an array of PositionWithOwner structs given an array of positionIds

### Function `getOwnerPositions(address target) → struct OptionToken.OptionPosition[] external`

Returns an array of OptionPosition structs owned by a given address

Meant to be used offchain as it can run out of gas

### Function `_getPositionWithOwner(uint256 positionId) → struct OptionToken.PositionWithOwner internal`

### Function `getPartialCollatParams() → struct OptionToken.PartialCollateralParameters external`

returns PartialCollateralParameters struct

### Function `_requireStrikeNotExpired(uint256 strikeId) internal`

### Function `_beforeTokenTransfer(address from, address to, uint256 tokenId) internal`

### Event `URISet(string URI)`

Emitted when the URI is modified

### Event `PartialCollateralParamsSet(struct OptionToken.PartialCollateralParameters partialCollateralParams)`

Emitted when partial collateral parameters are modified

### Event `PositionUpdated(uint256 positionId, address owner, enum OptionToken.PositionUpdatedType updatedType, struct OptionToken.OptionPosition position, uint256 timestamp)`

Emitted when a position is minted, adjusted, burned, merged or split.
