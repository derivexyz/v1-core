# `VaultAdapter`

Provides helpful functions for the vault adapter

## Functions:

- `setLyraAddresses(address _curveSwap, address _optionToken, address _optionMarket, address _liquidityPool, address _shortCollateral, address _synthetixAdapter, address _optionPricer, address _greekCache, address _quoteAsset, address _baseAsset, address _feeCounter) (internal)`

- `openPosition(struct VaultAdapter.TradeInputParameters params) (internal)`

- `closePosition(struct VaultAdapter.TradeInputParameters params) (internal)`

- `forceClosePosition(struct VaultAdapter.TradeInputParameters params) (internal)`

- `exchangeFromExactQuote(uint256 amountQuote, uint256 minBaseReceived) (internal)`

- `exchangeToExactQuote(uint256 amountQuote, uint256 maxBaseUsed) (internal)`

- `exchangeFromExactBase(uint256 amountBase, uint256 minQuoteReceived) (internal)`

- `exchangeToExactBase(uint256 amountBase, uint256 maxQuoteUsed) (internal)`

- `swapStables(address from, address to, uint256 amount, uint256 expected, address receiver) (internal)`

- `splitPosition(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) (internal)`

- `mergePositions(uint256[] positionIds) (internal)`

- `getLiveBoards() (internal)`

- `getBoard(uint256 boardId) (internal)`

- `getStrikes(uint256[] strikeIds) (internal)`

- `getVols(uint256[] strikeIds) (internal)`

- `getDeltas(uint256[] strikeIds) (internal)`

- `getVegas(uint256[] strikeIds) (internal)`

- `getPurePremium(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) (internal)`

- `getPurePremiumForStrike(uint256 strikeId) (internal)`

- `getFreeLiquidity() (internal)`

- `getMarketParams() (internal)`

- `getExchangeParams() (internal)`

- `getPositions(uint256[] positionIds) (internal)`

- `getMinCollateral(enum VaultAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) (internal)`

- `getMinCollateralForPosition(uint256 positionId) (internal)`

- `getMinCollateralForStrike(enum VaultAdapter.OptionType optionType, uint256 strikeId, uint256 amount) (internal)`

- `_getBsInput(uint256 strikeId) (internal)`

- `_isLong(enum VaultAdapter.OptionType optionType) (internal)`

- `_convertParams(struct VaultAdapter.TradeInputParameters _params) (internal)`

### Function `setLyraAddresses(address _curveSwap, address _optionToken, address _optionMarket, address _liquidityPool, address _shortCollateral, address _synthetixAdapter, address _optionPricer, address _greekCache, address _quoteAsset, address _baseAsset, address _feeCounter) internal`

Assigns all lyra contracts

#### Parameters:

- `_curveSwap`: Curve pool address

- `_optionToken`: OptionToken Address

- `_optionMarket`: OptionMarket Address

- `_liquidityPool`: LiquidityPool address

- `_shortCollateral`: ShortCollateral address

- `_synthetixAdapter`: SynthetixAdapter address

- `_optionPricer`: OptionMarketPricer address

- `_greekCache`: greekCache address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

- `_feeCounter`: Fee counter address

### Function `openPosition(struct VaultAdapter.TradeInputParameters params) → struct VaultAdapter.TradeResult internal`

### Function `closePosition(struct VaultAdapter.TradeInputParameters params) → struct VaultAdapter.TradeResult internal`

### Function `forceClosePosition(struct VaultAdapter.TradeInputParameters params) → struct VaultAdapter.TradeResult internal`

### Function `exchangeFromExactQuote(uint256 amountQuote, uint256 minBaseReceived) → uint256 baseReceived internal`

### Function `exchangeToExactQuote(uint256 amountQuote, uint256 maxBaseUsed) → uint256 quoteReceived internal`

### Function `exchangeFromExactBase(uint256 amountBase, uint256 minQuoteReceived) → uint256 quoteReceived internal`

### Function `exchangeToExactBase(uint256 amountBase, uint256 maxQuoteUsed) → uint256 baseReceived internal`

### Function `swapStables(address from, address to, uint256 amount, uint256 expected, address receiver) → uint256 amountOut, int256 swapFee internal`

### Function `splitPosition(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) → uint256 newPositionId internal`

### Function `mergePositions(uint256[] positionIds) internal`

### Function `getLiveBoards() → uint256[] liveBoards internal`

### Function `getBoard(uint256 boardId) → struct VaultAdapter.Board internal`

### Function `getStrikes(uint256[] strikeIds) → struct VaultAdapter.Strike[] allStrikes internal`

### Function `getVols(uint256[] strikeIds) → uint256[] vols internal`

### Function `getDeltas(uint256[] strikeIds) → int256[] callDeltas internal`

### Function `getVegas(uint256[] strikeIds) → uint256[] vegas internal`

### Function `getPurePremium(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) → uint256 call, uint256 put internal`

### Function `getPurePremiumForStrike(uint256 strikeId) → uint256 call, uint256 put internal`

### Function `getFreeLiquidity() → uint256 freeLiquidity internal`

### Function `getMarketParams() → struct VaultAdapter.MarketParams internal`

### Function `getExchangeParams() → struct VaultAdapter.ExchangeRateParams internal`

### Function `getPositions(uint256[] positionIds) → struct VaultAdapter.OptionPosition[] internal`

### Function `getMinCollateral(enum VaultAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) → uint256 internal`

### Function `getMinCollateralForPosition(uint256 positionId) → uint256 internal`

### Function `getMinCollateralForStrike(enum VaultAdapter.OptionType optionType, uint256 strikeId, uint256 amount) → uint256 internal`

### Function `_getBsInput(uint256 strikeId) → struct BlackScholes.BlackScholesInputs bsInput internal`

### Function `_isLong(enum VaultAdapter.OptionType optionType) → bool internal`

### Function `_convertParams(struct VaultAdapter.TradeInputParameters _params) → struct OptionMarket.TradeInputParameters internal`
