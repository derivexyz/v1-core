# `VaultAdapter`

Provides helpful functions for the vault adapter

## Functions:

- `setLyraAddresses(address _curveSwap, address _optionToken, address _optionMarket, address _liquidityPool, address _shortCollateral, address _synthetixAdapter, address _optionPricer, address _greekCache, address _quoteAsset, address _baseAsset, address _feeCounter) (internal)`

- `_openPosition(struct VaultAdapter.TradeInputParameters params) (internal)`

- `_closePosition(struct VaultAdapter.TradeInputParameters params) (internal)`

- `_forceClosePosition(struct VaultAdapter.TradeInputParameters params) (internal)`

- `_exchangeFromExactQuote(uint256 amountQuote, uint256 minBaseReceived) (internal)`

- `_exchangeToExactQuote(uint256 amountQuote, uint256 maxBaseUsed) (internal)`

- `_exchangeFromExactBase(uint256 amountBase, uint256 minQuoteReceived) (internal)`

- `_exchangeToExactBase(uint256 amountBase, uint256 maxQuoteUsed) (internal)`

- `_swapStables(address from, address to, uint256 amount, uint256 expected, address receiver) (internal)`

- `_splitPosition(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) (internal)`

- `_mergePositions(uint256[] positionIds) (internal)`

- `_getLiveBoards() (internal)`

- `_getBoard(uint256 boardId) (internal)`

- `_getStrikes(uint256[] strikeIds) (internal)`

- `_getVols(uint256[] strikeIds) (internal)`

- `_getDeltas(uint256[] strikeIds) (internal)`

- `_getVegas(uint256[] strikeIds) (internal)`

- `_getPurePremium(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) (internal)`

- `_getPurePremiumForStrike(uint256 strikeId) (internal)`

- `_getFreeLiquidity() (internal)`

- `_getMarketParams() (internal)`

- `_getExchangeParams() (internal)`

- `_getPositions(uint256[] positionIds) (internal)`

- `_getMinCollateral(enum VaultAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) (internal)`

- `_getMinCollateralForPosition(uint256 positionId) (internal)`

- `_getMinCollateralForStrike(enum VaultAdapter.OptionType optionType, uint256 strikeId, uint256 amount) (internal)`

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

### Function `_openPosition(struct VaultAdapter.TradeInputParameters params) → struct VaultAdapter.TradeResult internal`

### Function `_closePosition(struct VaultAdapter.TradeInputParameters params) → struct VaultAdapter.TradeResult internal`

### Function `_forceClosePosition(struct VaultAdapter.TradeInputParameters params) → struct VaultAdapter.TradeResult internal`

### Function `_exchangeFromExactQuote(uint256 amountQuote, uint256 minBaseReceived) → uint256 baseReceived internal`

### Function `_exchangeToExactQuote(uint256 amountQuote, uint256 maxBaseUsed) → uint256 quoteReceived internal`

### Function `_exchangeFromExactBase(uint256 amountBase, uint256 minQuoteReceived) → uint256 quoteReceived internal`

### Function `_exchangeToExactBase(uint256 amountBase, uint256 maxQuoteUsed) → uint256 baseReceived internal`

### Function `_swapStables(address from, address to, uint256 amount, uint256 expected, address receiver) → uint256 amountOut, int256 swapFee internal`

### Function `_splitPosition(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) → uint256 newPositionId internal`

### Function `_mergePositions(uint256[] positionIds) internal`

### Function `_getLiveBoards() → uint256[] liveBoards internal`

### Function `_getBoard(uint256 boardId) → struct VaultAdapter.Board internal`

### Function `_getStrikes(uint256[] strikeIds) → struct VaultAdapter.Strike[] allStrikes internal`

### Function `_getVols(uint256[] strikeIds) → uint256[] vols internal`

### Function `_getDeltas(uint256[] strikeIds) → int256[] callDeltas internal`

### Function `_getVegas(uint256[] strikeIds) → uint256[] vegas internal`

### Function `_getPurePremium(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) → uint256 call, uint256 put internal`

### Function `_getPurePremiumForStrike(uint256 strikeId) → uint256 call, uint256 put internal`

### Function `_getFreeLiquidity() → uint256 freeLiquidity internal`

### Function `_getMarketParams() → struct VaultAdapter.MarketParams internal`

### Function `_getExchangeParams() → struct VaultAdapter.ExchangeRateParams internal`

### Function `_getPositions(uint256[] positionIds) → struct VaultAdapter.OptionPosition[] internal`

### Function `_getMinCollateral(enum VaultAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) → uint256 internal`

### Function `_getMinCollateralForPosition(uint256 positionId) → uint256 internal`

### Function `_getMinCollateralForStrike(enum VaultAdapter.OptionType optionType, uint256 strikeId, uint256 amount) → uint256 internal`

### Function `_getBsInput(uint256 strikeId) → struct BlackScholes.BlackScholesInputs bsInput internal`

### Function `_isLong(enum VaultAdapter.OptionType optionType) → bool internal`

### Function `_convertParams(struct VaultAdapter.TradeInputParameters _params) → struct OptionMarket.TradeInputParameters internal`
