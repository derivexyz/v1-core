# `OptionMarketViewer`

Provides helpful functions to allow the dapp to operate more smoothly; logic in getPremiumForTrade is vital to

ensuring accurate prices are provided to the user.

## Functions:

- `init(contract SynthetixAdapter _synthetixAdapter) (external)`

- `addMarket(struct OptionMarketViewer.OptionMarketAddresses newMarketAddresses) (external)`

- `removeMarket(contract OptionMarket market) (external)`

- `getMarketAddresses() (external)`

- `getMarkets(contract OptionMarket[] markets) (external)`

- `getMarketForBaseKey(bytes32 baseKey) (public)`

- `getMarket(contract OptionMarket market) (public)`

- `_getMarket(struct OptionMarketViewer.OptionMarketAddresses marketC, bool isGlobalPaused) (internal)`

- `_getMarketParams(struct OptionMarketViewer.OptionMarketAddresses marketC) (internal)`

- `getOwnerPositions(address account) (external)`

- `getOwnerPositionsInRange(contract OptionMarket market, address account, uint256 start, uint256 limit) (external)`

- `getLiveBoards(contract OptionMarket market) (public)`

- `getBoard(contract OptionMarket market, uint256 boardId) (external)`

- `getBoardForBaseKey(bytes32 baseKey, uint256 boardId) (external)`

- `getBoardForStrikeId(contract OptionMarket market, uint256 strikeId) (external)`

- `_getBoard(struct OptionMarketViewer.OptionMarketAddresses marketC, uint256 boardId) (internal)`

- `_getStrikeViews(struct OptionMarket.Strike[] strikes, struct OptionGreekCache.BoardGreeksView boardGreeksView, uint256[] strikeToBaseReturnedRatios, uint256 priceAtExpiry) (internal)`

- `getLiquidityBalancesAndAllowances(contract OptionMarket[] markets, address account) (external)`

## Events:

- `MarketAdded(struct OptionMarketViewer.OptionMarketAddresses market)`

- `MarketRemoved(contract OptionMarket market)`

### Function `init(contract SynthetixAdapter _synthetixAdapter) external`

Initializes the contract

#### Parameters:

- `_synthetixAdapter`: SynthetixAdapter contract address

### Function `addMarket(struct OptionMarketViewer.OptionMarketAddresses newMarketAddresses) external`

### Function `removeMarket(contract OptionMarket market) external`

### Function `getMarketAddresses() → struct OptionMarketViewer.OptionMarketAddresses[] external`

### Function `getMarkets(contract OptionMarket[] markets) → struct OptionMarketViewer.MarketsView marketsView external`

### Function `getMarketForBaseKey(bytes32 baseKey) → struct OptionMarketViewer.MarketViewWithBoards market public`

### Function `getMarket(contract OptionMarket market) → struct OptionMarketViewer.MarketViewWithBoards public`

### Function `_getMarket(struct OptionMarketViewer.OptionMarketAddresses marketC, bool isGlobalPaused) → struct OptionMarketViewer.MarketView internal`

### Function `_getMarketParams(struct OptionMarketViewer.OptionMarketAddresses marketC) → struct OptionMarketViewer.MarketParameters params internal`

### Function `getOwnerPositions(address account) → struct OptionMarketViewer.MarketOptionPositions[] external`

### Function `getOwnerPositionsInRange(contract OptionMarket market, address account, uint256 start, uint256 limit) → struct OptionToken.OptionPosition[] external`

### Function `getLiveBoards(contract OptionMarket market) → struct OptionMarketViewer.BoardView[] marketBoards public`

### Function `getBoard(contract OptionMarket market, uint256 boardId) → struct OptionMarketViewer.BoardView external`

### Function `getBoardForBaseKey(bytes32 baseKey, uint256 boardId) → struct OptionMarketViewer.BoardView external`

### Function `getBoardForStrikeId(contract OptionMarket market, uint256 strikeId) → struct OptionMarketViewer.BoardView external`

### Function `_getBoard(struct OptionMarketViewer.OptionMarketAddresses marketC, uint256 boardId) → struct OptionMarketViewer.BoardView internal`

### Function `_getStrikeViews(struct OptionMarket.Strike[] strikes, struct OptionGreekCache.BoardGreeksView boardGreeksView, uint256[] strikeToBaseReturnedRatios, uint256 priceAtExpiry) → struct OptionMarketViewer.StrikeView[] strikeViews internal`

### Function `getLiquidityBalancesAndAllowances(contract OptionMarket[] markets, address account) → struct OptionMarketViewer.LiquidityBalanceAndAllowance[] external`

### Event `MarketAdded(struct OptionMarketViewer.OptionMarketAddresses market)`

Emitted when an optionMarket is added

### Event `MarketRemoved(contract OptionMarket market)`

Emitted when an optionMarket is removed
