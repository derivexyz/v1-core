# `GWAVOracle`

## Functions:

- `init(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, contract SynthetixAdapter _synthetixAdapter) (external)`

- `setLyraAddresses(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, contract SynthetixAdapter _synthetixAdapter) (public)`

- `ivGWAV(uint256 boardId, uint256 secondsAgo) (public)`

- `skewGWAV(uint256 strikeId, uint256 secondsAgo) (public)`

- `volGWAV(uint256 strikeId, uint256 secondsAgo) (public)`

- `deltaGWAV(uint256 strikeId, uint256 secondsAgo) (external)`

- `vegaGWAV(uint256 strikeId, uint256 secondsAgo) (external)`

- `optionPriceGWAV(uint256 strikeId, uint256 secondsAgo) (external)`

- `_getBsInput(uint256 strikeId) (internal)`

### Function `init(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, contract SynthetixAdapter _synthetixAdapter) external`

Initializes the contract

#### Parameters:

- `_optionMarket`: OptionMarket Address

- `_greekCache`: greekCache address

- `_synthetixAdapter`: synthetixAdapter address

### Function `setLyraAddresses(contract OptionMarket _optionMarket, contract OptionGreekCache _greekCache, contract SynthetixAdapter _synthetixAdapter) public`

### Function `ivGWAV(uint256 boardId, uint256 secondsAgo) → uint256 public`

### Function `skewGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 public`

### Function `volGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 public`

### Function `deltaGWAV(uint256 strikeId, uint256 secondsAgo) → int256 callDelta external`

### Function `vegaGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 vega external`

### Function `optionPriceGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 callPrice, uint256 putPrice external`

### Function `_getBsInput(uint256 strikeId) → struct BlackScholes.BlackScholesInputs bsInput internal`
