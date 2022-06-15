# `SynthetixAdapter`

Manages access to exchange functions on Synthetix.

The OptionMarket contract address is used as the key to access the relevant exchange parameters for the market.

## Modifiers:

- `notPaused(address _contractAddress)`

## Functions:

- `initialize() (external)`

- `setAddressResolver(contract IAddressResolver _addressResolver) (external)`

- `setGlobalsForContract(address _contractAddress, bytes32 _quoteKey, bytes32 _baseKey, address _rewardAddress, bytes32 _trackingCode) (external)`

- `setMarketPaused(address _contractAddress, bool _isPaused) (external)`

- `setGlobalPaused(bool _isPaused) (external)`

- `updateSynthetixAddresses() (public)`

- `getSpotPriceForMarket(address _contractAddress) (public)`

- `getSpotPrice(bytes32 to) (public)`

- `getExchangeParams(address optionMarket) (public)`

- `requireNotGlobalPaused(address optionMarket) (external)`

- `exchangeFromExactQuote(address optionMarket, uint256 amountQuote) (external)`

- `exchangeToExactBase(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountBase) (external)`

- `exchangeToExactBaseWithLimit(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountBase, uint256 quoteLimit) (public)`

- `_exchangeQuoteForBase(address optionMarket, uint256 amountQuote) (internal)`

- `estimateExchangeToExactBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountBase) (public)`

- `exchangeFromExactBase(address optionMarket, uint256 amountBase) (external)`

- `exchangeToExactQuote(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountQuote) (external)`

- `exchangeToExactQuoteWithLimit(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountQuote, uint256 baseLimit) (public)`

- `_exchangeBaseForQuote(address optionMarket, uint256 amountBase) (internal)`

- `estimateExchangeToExactQuote(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountQuote) (public)`

## Events:

- `AddressResolverSet(contract IAddressResolver addressResolver)`

- `SynthetixAddressesUpdated(contract ISynthetix synthetix, contract IExchanger exchanger, contract IExchangeRates exchangeRates, contract IDelegateApprovals delegateApprovals)`

- `GlobalsSetForContract(address market, bytes32 quoteKey, bytes32 baseKey, address rewardAddress, bytes32 trackingCode)`

- `GlobalPausedSet(bool isPaused)`

- `MarketPausedSet(address contractAddress, bool isPaused)`

- `BaseSwappedForQuote(address marketAddress, address exchanger, uint256 baseSwapped, uint256 quoteReceived)`

- `QuoteSwappedForBase(address marketAddress, address exchanger, uint256 quoteSwapped, uint256 baseReceived)`

### Modifier `notPaused(address _contractAddress)`

### Function `initialize() external`

### Function `setAddressResolver(contract IAddressResolver _addressResolver) external`

Set the address of the Synthetix address resolver.

#### Parameters:

- `_addressResolver`: The address of Synthetix's AddressResolver.

### Function `setGlobalsForContract(address _contractAddress, bytes32 _quoteKey, bytes32 _baseKey, address _rewardAddress, bytes32 _trackingCode) external`

Set the synthetixAdapter for a specific OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_quoteKey`: The key of the quoteAsset.

- `_baseKey`: The key of the baseAsset.

### Function `setMarketPaused(address _contractAddress, bool _isPaused) external`

Pauses all market actions for a given market.

#### Parameters:

- `_isPaused`: Whether getting synthetixAdapter will revert or not.

### Function `setGlobalPaused(bool _isPaused) external`

Pauses all market actions for all markets.

#### Parameters:

- `_isPaused`: Whether getting synthetixAdapter will revert or not.

### Function `updateSynthetixAddresses() public`

Public function to update synthetix addresses Lyra uses. The addresses are cached this way for gas efficiency.

### Function `getSpotPriceForMarket(address _contractAddress) → uint256 spotPrice public`

Returns the price of the baseAsset.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

### Function `getSpotPrice(bytes32 to) → uint256 public`

Gets spot price of an asset.

All rates are denominated in terms of sUSD,

so the price of sUSD is always $1.00, and is never stale.

#### Parameters:

- `to`: The key of the synthetic asset.

### Function `getExchangeParams(address optionMarket) → struct SynthetixAdapter.ExchangeParams exchangeParams public`

Returns the ExchangeParams.

#### Parameters:

- `optionMarket`: The address of the OptionMarket.

### Function `requireNotGlobalPaused(address optionMarket) external`

Revert if the global state is paused

### Function `exchangeFromExactQuote(address optionMarket, uint256 amountQuote) → uint256 baseReceived external`

Swap an exact amount of quote for base.

#### Parameters:

- `optionMarket`: The base asset of this option market to receive

- `amountQuote`: The exact amount of quote to be used for the swap

#### Return Values:

- baseReceived The amount of base received from the swap

### Function `exchangeToExactBase(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountBase) → uint256 quoteSpent, uint256 baseReceived external`

Swap quote for an exact amount of base.

#### Parameters:

- `exchangeParams`: The current exchange rates for the swap

- `optionMarket`: The base asset of this option market to receive

- `amountBase`: The exact amount of base to receive from the swap

#### Return Values:

- quoteSpent The amount of quote spent on the swap

- baseReceived The amount of base received

### Function `exchangeToExactBaseWithLimit(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountBase, uint256 quoteLimit) → uint256 quoteSpent, uint256 baseReceived public`

Swap quote for base with a limit on the amount of quote to be spent.

#### Parameters:

- `exchangeParams`: The current exchange rates for the swap

- `optionMarket`: The base asset of this option market to receive

- `amountBase`: The exact amount of base to receive from the swap

- `quoteLimit`: The maximum amount of quote to spend for base

#### Return Values:

- quoteSpent The amount of quote spent on the swap

- baseReceived The amount of baes received from the swap

### Function `_exchangeQuoteForBase(address optionMarket, uint256 amountQuote) → uint256 baseReceived internal`

### Function `estimateExchangeToExactBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountBase) → uint256 quoteNeeded public`

Returns an estimated amount of quote required to swap for the specified amount of base.

#### Parameters:

- `exchangeParams`: The current exchange rates for the swap

- `amountBase`: The amount of base to receive

#### Return Values:

- quoteNeeded The amount of quote required to received the amount of base requested

### Function `exchangeFromExactBase(address optionMarket, uint256 amountBase) → uint256 quoteReceived external`

Swap an exact amount of base for quote.

#### Parameters:

- `optionMarket`: The base asset of this optionMarket to be used

- `amountBase`: The exact amount of base to be used for the swap

#### Return Values:

- quoteReceived The amount of quote received from the swap

### Function `exchangeToExactQuote(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountQuote) → uint256 baseSpent, uint256 quoteReceived external`

Swap base for an exact amount of quote

#### Parameters:

- `exchangeParams`: The current exchange rates for the swap

- `optionMarket`: The base asset of this optionMarket to be used

- `amountQuote`: The exact amount of quote to receive

#### Return Values:

- baseSpent The amount of baseSpent on the swap

- quoteReceived The amount of quote received from the swap

### Function `exchangeToExactQuoteWithLimit(struct SynthetixAdapter.ExchangeParams exchangeParams, address optionMarket, uint256 amountQuote, uint256 baseLimit) → uint256 baseSpent, uint256 quoteReceived public`

Swap base for an exact amount of quote with a limit on the amount of base to be used

#### Parameters:

- `exchangeParams`: The current exchange rates for the swap

- `optionMarket`: The base asset of this optionMarket to be used

- `amountQuote`: The exact amount of quote to receive

- `baseLimit`: The limit on the amount of base to be used

#### Return Values:

- baseSpent The amount of base spent on the swap

- quoteReceived The amount of quote received from the swap

### Function `_exchangeBaseForQuote(address optionMarket, uint256 amountBase) → uint256 quoteReceived internal`

### Function `estimateExchangeToExactQuote(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountQuote) → uint256 baseNeeded public`

Returns an estimated amount of base required to swap for the amount of quote

#### Parameters:

- `exchangeParams`: The current exchange rates for the swap

- `amountQuote`: The amount of quote to swap to

#### Return Values:

- baseNeeded The amount of base required for the swap

### Event `AddressResolverSet(contract IAddressResolver addressResolver)`

Emitted when the address resolver is set.

### Event `SynthetixAddressesUpdated(contract ISynthetix synthetix, contract IExchanger exchanger, contract IExchangeRates exchangeRates, contract IDelegateApprovals delegateApprovals)`

Emitted when synthetix contracts are updated.

### Event `GlobalsSetForContract(address market, bytes32 quoteKey, bytes32 baseKey, address rewardAddress, bytes32 trackingCode)`

Emitted when values for a given option market are set.

### Event `GlobalPausedSet(bool isPaused)`

Emitted when GlobalPause.

### Event `MarketPausedSet(address contractAddress, bool isPaused)`

Emitted when single market paused.

### Event `BaseSwappedForQuote(address marketAddress, address exchanger, uint256 baseSwapped, uint256 quoteReceived)`

Emitted when an exchange for base to quote occurs.

Which base and quote were swapped can be determined by the given marketAddress.

### Event `QuoteSwappedForBase(address marketAddress, address exchanger, uint256 quoteSwapped, uint256 baseReceived)`

Emitted when an exchange for quote to base occurs.

Which base and quote were swapped can be determined by the given marketAddress.
