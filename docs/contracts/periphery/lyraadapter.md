# `LyraAdapter`

Provides helpful functions for any Lyra trading/market data/vault related actions in one contract

     To earn trading rewards, integrators must request to be whitelisted by Lyra

## Functions:

- `setLyraAddresses(address _lyraRegistry, address _optionMarket, address _curveSwap, address _feeCounter) (public)`

- `updateDelegateApproval() (external)`

- `_openPosition(struct LyraAdapter.TradeInputParameters params) (internal)`

- `_closeOrForceClosePosition(struct LyraAdapter.TradeInputParameters params) (internal)`

- `_closePosition(struct LyraAdapter.TradeInputParameters params) (internal)`

- `_forceClosePosition(struct LyraAdapter.TradeInputParameters params) (internal)`

- `_exchangeFromExactQuote(uint256 amountQuote, uint256 minBaseReceived) (internal)`

- `_exchangeToExactQuote(uint256 amountQuote, uint256 maxBaseUsed) (internal)`

- `_exchangeFromExactBase(uint256 amountBase, uint256 minQuoteReceived) (internal)`

- `_exchangeToExactBase(uint256 amountBase, uint256 maxQuoteUsed) (internal)`

- `_getExchangeParams() (internal)`

- `_swapStables(address from, address to, uint256 amount, uint256 expected, address receiver) (internal)`

- `_getPositions(uint256[] positionIds) (internal)`

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

- `_getLiquidity() (internal)`

- `_getFreeLiquidity() (internal)`

- `_getMarketParams() (internal)`

- `_isOutsideDeltaCutoff(uint256 strikeId) (internal)`

- `_isWithinTradingCutoff(uint256 strikeId) (internal)`

- `_getMinCollateral(enum LyraAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) (internal)`

- `_getMinCollateralForPosition(uint256 positionId) (internal)`

- `_getMinCollateralForStrike(enum LyraAdapter.OptionType optionType, uint256 strikeId, uint256 amount) (internal)`

- `_ivGWAV(uint256 boardId, uint256 secondsAgo) (internal)`

- `_skewGWAV(uint256 strikeId, uint256 secondsAgo) (internal)`

- `_volGWAV(uint256 strikeId, uint256 secondsAgo) (internal)`

- `_deltaGWAV(uint256 strikeId, uint256 secondsAgo) (internal)`

- `_vegaGWAV(uint256 strikeId, uint256 secondsAgo) (internal)`

- `_optionPriceGWAV(uint256 strikeId, uint256 secondsAgo) (external)`

- `_getBsInput(uint256 strikeId) (internal)`

- `_isLong(enum LyraAdapter.OptionType optionType) (internal)`

- `_convertParams(struct LyraAdapter.TradeInputParameters _params) (internal)`

- `_assignLyraRegistryMarketAddresses() (internal)`

### Function `setLyraAddresses(address _lyraRegistry, address _optionMarket, address _curveSwap, address _feeCounter) public`

Assigns all lyra contracts

#### Parameters:

- `_lyraRegistry`: LyraRegistry address which holds latest market and global addressess

- `_optionMarket`: OptionMarket address

- `_curveSwap`: Curve pool address for swapping sUSD and other stables via `exchange_with_best_rate`

- `_feeCounter`: Fee counter addressu used to determine Lyra trading rewards

### Function `updateDelegateApproval() external`

In case of an update to the synthetix contract that revokes the approval

### Function `_openPosition(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult tradeResult internal`

Attempts to open positions within cost bounds.

If a positionId is specified params.amount will be added to the position

params.amount can be zero when adjusting an existing position

#### Parameters:

- `params`: The parameters for the requested trade

### Function `_closeOrForceClosePosition(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult tradeResult internal`

Attempt close under normal condition or forceClose

         if position is outside of delta or too close to expiry.

#### Parameters:

- `params`: The parameters for the requested trade

### Function `_closePosition(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult tradeResult internal`

Attempts to close an existing position within cost bounds.

If a positionId is specified params.amount will be subtracted from the position

params.amount can be zero when adjusting an existing position

#### Parameters:

- `params`: The parameters for the requested trade

### Function `_forceClosePosition(struct LyraAdapter.TradeInputParameters params) → struct LyraAdapter.TradeResult tradeResult internal`

Attempts to close an existing position outside of the delta or trading cutoffs (as specified in MarketParams).

This market action will charge higher fees than the standard `closePosition()`

#### Parameters:

- `params`: The parameters for the requested trade

### Function `_exchangeFromExactQuote(uint256 amountQuote, uint256 minBaseReceived) → uint256 baseReceived internal`

Exchange an exact amount of quote for a minimum amount of base (revert otherwise)

### Function `_exchangeToExactQuote(uint256 amountQuote, uint256 maxBaseUsed) → uint256 quoteReceived internal`

Exchange to an exact amount of quote for a maximum amount of base (revert otherwise)

### Function `_exchangeFromExactBase(uint256 amountBase, uint256 minQuoteReceived) → uint256 quoteReceived internal`

Exchange an exact amount of base for a minimum amount of quote (revert otherwise)

### Function `_exchangeToExactBase(uint256 amountBase, uint256 maxQuoteUsed) → uint256 baseReceived internal`

Exchange to an exact amount of base for a maximum amount of quote (revert otherwise)

### Function `_getExchangeParams() → struct LyraAdapter.ExchangeRateParams internal`

Returns the ExchangeParams for current market.

### Function `_swapStables(address from, address to, uint256 amount, uint256 expected, address receiver) → uint256 amountOut internal`

WARNING: ENSURE CURVE HAS SUFFICIENT sUSD LIQUIDITY

        Exchange between stables within the curveSwap sUSD pool.

#### Parameters:

- `from`: start ERC20

- `to`: destination ERC20

- `amount`: amount of "from" currency to exchange

- `expected`: minimum expected amount of "to" currency

- `receiver`: address of recipient of "to" currency

#### Return Values:

- amountOut received amount

### Function `_getPositions(uint256[] positionIds) → struct LyraAdapter.OptionPosition[] internal`

Get position info for given positionIds

### Function `_splitPosition(uint256 positionId, uint256 newAmount, uint256 newCollateral, address recipient) → uint256 newPositionId internal`

Allows a user to split a curent position into two. The amount of the original position will

        be subtracted from and a new position will be minted with the desired amount and collateral.

Only ACTIVE positions can be owned by users, so status does not need to be checked

Both resulting positions must not be liquidatable

#### Parameters:

- `positionId`: the positionId of the original position to be split

- `newAmount`: the amount in the new position

- `newCollateral`: the amount of collateral for the new position

- `recipient`: recipient of new position

### Function `_mergePositions(uint256[] positionIds) internal`

User can merge many positions with matching strike and optionType into a single position

Only ACTIVE positions can be owned by users, so status does not need to be checked.

Merged position must not be liquidatable.

#### Parameters:

- `positionIds`: the positionIds to be merged together

### Function `_getLiveBoards() → uint256[] liveBoards internal`

Returns the list of live board ids.

### Function `_getBoard(uint256 boardId) → struct LyraAdapter.Board internal`

Returns Board struct for a given boardId

### Function `_getStrikes(uint256[] strikeIds) → struct LyraAdapter.Strike[] allStrikes internal`

Returns all Strike structs for a list of strikeIds

### Function `_getVols(uint256[] strikeIds) → uint256[] vols internal`

Returns current spot volatilities for given strikeIds (boardIv * skew)

### Function `_getDeltas(uint256[] strikeIds) → int256[] callDeltas internal`

Returns current spot deltas for given strikeIds (using BlackScholes and spot volatilities)

### Function `_getVegas(uint256[] strikeIds) → uint256[] vegas internal`

Returns current spot vegas for given strikeIds (using BlackScholes and spot volatilities)

### Function `_getPurePremium(uint256 secondsToExpiry, uint256 vol, uint256 spotPrice, uint256 strikePrice) → uint256 call, uint256 put internal`

Calculate the pure black-scholes premium for given params

### Function `_getPurePremiumForStrike(uint256 strikeId) → uint256 call, uint256 put internal`

Calculate the spot black-scholes premium for a given strike

Does not include slippage or trading fees

### Function `_getLiquidity() → struct LyraAdapter.Liquidity internal`

Returns the breakdown of current liquidity usage (see Liquidity struct)

### Function `_getFreeLiquidity() → uint256 freeLiquidity internal`

Returns the amount of liquidity available for trading

### Function `_getMarketParams() → struct LyraAdapter.MarketParams internal`

Returns the most critical Lyra market trading parameters that determine pricing/slippage/trading restrictions

### Function `_isOutsideDeltaCutoff(uint256 strikeId) → bool internal`

use latest optionMarket delta cutoff to determine whether trade delta is out of bounds

### Function `_isWithinTradingCutoff(uint256 strikeId) → bool internal`

use latest optionMarket trading cutoff to determine whether trade is too close to expiry

### Function `_getMinCollateral(enum LyraAdapter.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) → uint256 internal`

Estimate minimum collateral required for given parameters

Position is liquidatable when position.collateral < minCollateral

### Function `_getMinCollateralForPosition(uint256 positionId) → uint256 internal`

Estimate minimum collateral required for an existing position

### Function `_getMinCollateralForStrike(enum LyraAdapter.OptionType optionType, uint256 strikeId, uint256 amount) → uint256 internal`

Estimate minimum collateral required for a given strike with manual amount

### Function `_ivGWAV(uint256 boardId, uint256 secondsAgo) → uint256 internal`

the `baseIv` GWAV for a given `boardId` with GWAV interval `secondsAgo`

### Function `_skewGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 internal`

the volatility `skew` GWAV for a given `strikeId` with GWAV interval `secondsAgo`

### Function `_volGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 internal`

the resultant volatility =`skew` * 'baseIv'

        for a given `strikeId` with GWAV interval `secondsAgo`

### Function `_deltaGWAV(uint256 strikeId, uint256 secondsAgo) → int256 callDelta internal`

the delta GWAV for a given `strikeId` with GWAV interval `secondsAgo`

### Function `_vegaGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 internal`

the non-normalized vega GWAV for a given `strikeId` with GWAV interval `secondsAgo`

### Function `_optionPriceGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 callPrice, uint256 putPrice external`

the option price GWAV for a given `strikeId` with GWAV interval `secondsAgo`

### Function `_getBsInput(uint256 strikeId) → struct BlackScholes.BlackScholesInputs bsInput internal`

format all strike related params before input into BlackScholes

### Function `_isLong(enum LyraAdapter.OptionType optionType) → bool internal`

Check if position is long

### Function `_convertParams(struct LyraAdapter.TradeInputParameters _params) → struct OptionMarket.TradeInputParameters internal`

Convert LyraAdapter.TradeInputParameters into OptionMarket.TradeInputParameters

### Function `_assignLyraRegistryMarketAddresses() internal`

get lyra market addresses from LyraRegistry
