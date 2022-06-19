# `TestLyraAdapter`

## Functions:

- `setLyraAddressesExt(address _lyraRegistry, address _optionMarket, address _curveSwap, address _feeCounter) (external)`

- `openPositionExt(struct LyraAdapter.TradeInputParameters params) (external)`

- `closePositionExt(struct LyraAdapter.TradeInputParameters params) (external)`

- `forceClosePositionExt(struct LyraAdapter.TradeInputParameters params) (external)`

- `splitPositionExt(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) (external)`

- `mergePositionsExt(uint256[] positionIds) (external)`

- `exchangeFromExactQuoteExt(uint256 amountQuote, uint256 minBaseReceived) (external)`

- `exchangeToExactQuoteExt(uint256 amountQuote, uint256 maxBaseUsed) (external)`

- `exchangeFromExactBaseExt(uint256 amountBase, uint256 minQuoteReceived) (external)`

- `exchangeToExactBaseExt(uint256 amountBase, uint256 maxQuoteUsed) (external)`

- `swapStablesExt(address from, address to, uint256 amount, uint256 expected, address receiver) (external)`

- `getBoardExt(uint256 boardId) (external)`

- `getStrikesExt(uint256[] strikeIds) (external)`

- `getVolsExt(uint256[] strikeIds) (external)`

- `getDeltasExt(uint256[] strikeIds) (external)`

- `getVegasExt(uint256[] strikeIds) (external)`

- `getPurePremiumExt(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) (external)`

- `getPurePremiumForStrikeExt(uint256 strikeId) (external)`

- `getLiquidityExt() (external)`

- `getFreeLiquidityExt() (external)`

- `getMarketParamsExt() (external)`

- `getExchangeParamsExt() (external)`

- `getMinCollateralExt(enum LyraAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) (external)`

- `getMinCollateralForPositionExt(uint256 positionId) (external)`

- `getMinCollateralForStrikeExt(enum LyraAdapter.OptionType optionType, uint256 strikeId, uint256 amount) (external)`

- `getPositionsExt(uint256[] positionIds) (external)`

- `getLiveBoardsExt() (external)`

### Function `setLyraAddressesExt(address _lyraRegistry, address _optionMarket, address _curveSwap, address _feeCounter) external`

### Function `openPositionExt(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult result external`

### Function `closePositionExt(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult result external`

### Function `forceClosePositionExt(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult result external`

### Function `splitPositionExt(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) → uint256 newPositionId external`

### Function `mergePositionsExt(uint256[] positionIds) external`

### Function `exchangeFromExactQuoteExt(uint256 amountQuote, uint256 minBaseReceived) → uint256 baseReceived external`

### Function `exchangeToExactQuoteExt(uint256 amountQuote, uint256 maxBaseUsed) → uint256 quoteReceived external`

### Function `exchangeFromExactBaseExt(uint256 amountBase, uint256 minQuoteReceived) → uint256 quoteReceived external`

### Function `exchangeToExactBaseExt(uint256 amountBase, uint256 maxQuoteUsed) → uint256 baseReceived external`

### Function `swapStablesExt(address from, address to, uint256 amount, uint256 expected, address receiver) → uint256 amountOut external`

### Function `getBoardExt(uint256 boardId) → struct LyraAdapter.Board board external`

### Function `getStrikesExt(uint256[] strikeIds) → struct LyraAdapter.Strike[] allStrikes external`

### Function `getVolsExt(uint256[] strikeIds) → uint256[] vols external`

### Function `getDeltasExt(uint256[] strikeIds) → int256[] callDeltas external`

### Function `getVegasExt(uint256[] strikeIds) → uint256[] vegas external`

### Function `getPurePremiumExt(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) → uint256 call, uint256 put external`

### Function `getPurePremiumForStrikeExt(uint256 strikeId) → uint256 call, uint256 put external`

### Function `getLiquidityExt() → struct LyraAdapter.Liquidity liquidity external`

### Function `getFreeLiquidityExt() → uint256 freeLiquidity external`

### Function `getMarketParamsExt() → struct LyraAdapter.MarketParams params external`

### Function `getExchangeParamsExt() → struct LyraAdapter.ExchangeRateParams params external`

### Function `getMinCollateralExt(enum LyraAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) → uint256 minCollateral external`

### Function `getMinCollateralForPositionExt(uint256 positionId) → uint256 minCollateral external`

### Function `getMinCollateralForStrikeExt(enum LyraAdapter.OptionType optionType, uint256 strikeId, uint256 amount) → uint256 minCollateral external`

### Function `getPositionsExt(uint256[] positionIds) → struct LyraAdapter.OptionPosition[] allPositions external`

### Function `getLiveBoardsExt() → uint256[] liveBoards external`
