# `IOptionMarket`

## Functions:

- `maxExpiryTimestamp() (external)`

- `optionBoards(uint256) (external)`

- `optionListings(uint256) (external)`

- `boardToPriceAtExpiry(uint256) (external)`

- `listingToBaseReturnedRatio(uint256) (external)`

- `transferOwnership(address newOwner) (external)`

- `setBoardFrozen(uint256 boardId, bool frozen) (external)`

- `setBoardBaseIv(uint256 boardId, uint256 baseIv) (external)`

- `setListingSkew(uint256 listingId, uint256 skew) (external)`

- `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikes, uint256[] skews) (external)`

- `addListingToBoard(uint256 boardId, uint256 strike, uint256 skew) (external)`

- `getLiveBoards() (external)`

- `getBoardListings(uint256 boardId) (external)`

- `openPosition(uint256 _listingId, enum IOptionMarket.TradeType tradeType, uint256 amount) (external)`

- `closePosition(uint256 _listingId, enum IOptionMarket.TradeType tradeType, uint256 amount) (external)`

- `liquidateExpiredBoard(uint256 boardId) (external)`

- `settleOptions(uint256 listingId, enum IOptionMarket.TradeType tradeType) (external)`

### Function `maxExpiryTimestamp() → uint256 external`

### Function `optionBoards(uint256) → uint256 id, uint256 expiry, uint256 iv, bool frozen external`

### Function `optionListings(uint256) → uint256 id, uint256 strike, uint256 skew, uint256 longCall, uint256 shortCall, uint256 longPut, uint256 shortPut, uint256 boardId external`

### Function `boardToPriceAtExpiry(uint256) → uint256 external`

### Function `listingToBaseReturnedRatio(uint256) → uint256 external`

### Function `transferOwnership(address newOwner) external`

### Function `setBoardFrozen(uint256 boardId, bool frozen) external`

### Function `setBoardBaseIv(uint256 boardId, uint256 baseIv) external`

### Function `setListingSkew(uint256 listingId, uint256 skew) external`

### Function `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikes, uint256[] skews) → uint256 external`

### Function `addListingToBoard(uint256 boardId, uint256 strike, uint256 skew) external`

### Function `getLiveBoards() → uint256[] _liveBoards external`

### Function `getBoardListings(uint256 boardId) → uint256[] external`

### Function `openPosition(uint256 _listingId, enum IOptionMarket.TradeType tradeType, uint256 amount) → uint256 totalCost external`

### Function `closePosition(uint256 _listingId, enum IOptionMarket.TradeType tradeType, uint256 amount) → uint256 totalCost external`

### Function `liquidateExpiredBoard(uint256 boardId) external`

### Function `settleOptions(uint256 listingId, enum IOptionMarket.TradeType tradeType) external`
