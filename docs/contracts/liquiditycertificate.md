# `LiquidityCertificate`

An ERC721 token which represents a share of the LiquidityPool.

It is minted when users deposit, and burned when users withdraw.

## Modifiers:

- `onlyLiquidityPool()`

## Functions:

- `constructor(string _name, string _symbol) (public)`

- `init(address _liquidityPool) (external)`

- `certificates(address owner) (external)`

- `liquidity(uint256 certificateId) (external)`

- `enteredAt(uint256 certificateId) (external)`

- `burnableAt(uint256 certificateId) (external)`

- `certificateData(uint256 certificateId) (external)`

- `mint(address owner, uint256 liquidityAmount, uint256 expiryAtCreation) (external)`

- `setBurnableAt(address spender, uint256 certificateId, uint256 timestamp) (external)`

- `burn(address spender, uint256 certificateId) (external)`

- `split(uint256 certificateId, uint256 percentageSplit) (external)`

- `_beforeTokenTransfer(address, address, uint256 tokenId) (internal)`

## Events:

- `CertificateDataModified(uint256 certificateId, uint256 liquidity, uint256 enteredAt, uint256 burnableAt)`

- `CertificateSplit(uint256 certificateId, uint256 newCertificateId)`

### Modifier `onlyLiquidityPool()`

### Function `constructor(string _name, string _symbol) public`

#### Parameters:

- `_name`: Token collection name

- `_symbol`: Token collection symbol

### Function `init(address _liquidityPool) external`

Initialize the contract.

#### Parameters:

- `_liquidityPool`: LiquidityPool address

### Function `certificates(address owner) → uint256[] external`

Returns all the certificates own by a given address.

#### Parameters:

- `owner`: The owner of the certificates

### Function `liquidity(uint256 certificateId) → uint256 external`

Returns certificate's `liquidity`.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `enteredAt(uint256 certificateId) → uint256 external`

Returns certificate's `enteredAt`.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `burnableAt(uint256 certificateId) → uint256 external`

Returns certificate's `burnableAt`.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `certificateData(uint256 certificateId) → struct LiquidityCertificate.CertificateData external`

Returns a certificate's data.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `mint(address owner, uint256 liquidityAmount, uint256 expiryAtCreation) → uint256 external`

Mints a new certificate and transfers it to `owner`.

#### Parameters:

- `owner`: The account that will own the LiquidityCertificate.

- `liquidityAmount`: The amount of liquidity that has been deposited.

- `expiryAtCreation`: The time when the liquidity will become active.

### Function `setBurnableAt(address spender, uint256 certificateId, uint256 timestamp) external`

Sets `burnableAt` of a given certificate.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

- `timestamp`: The time it will become burnable.

### Function `burn(address spender, uint256 certificateId) external`

Burns the LiquidityCertificate.

#### Parameters:

- `spender`: The account which is performing the burn.

- `certificateId`: The id of the LiquidityCertificate.

### Function `split(uint256 certificateId, uint256 percentageSplit) → uint256 external`

Splits a LiquidityCertificate into two. Assigns `percentageSplit` of the original

liquidity to the new certificate.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

- `percentageSplit`: The percentage of liquidity assigned to the new certificate.

### Function `_beforeTokenTransfer(address, address, uint256 tokenId) internal`

Hook that is called before any token transfer. This includes minting and burning.

### Event `CertificateDataModified(uint256 certificateId, uint256 liquidity, uint256 enteredAt, uint256 burnableAt)`

Emitted when a Certificate is minted, burnableAt is updated or it is split.

### Event `CertificateSplit(uint256 certificateId, uint256 newCertificateId)`

Emitted when a Certificate is split.
