# `ILiquidityCertificate`

## Functions:

- `MIN_LIQUIDITY() (external)`

- `liquidityPool() (external)`

- `certificates(address owner) (external)`

- `liquidity(uint256 certificateId) (external)`

- `enteredAt(uint256 certificateId) (external)`

- `burnableAt(uint256 certificateId) (external)`

- `certificateData(uint256 certificateId) (external)`

- `mint(address owner, uint256 liquidityAmount, uint256 expiryAtCreation) (external)`

- `setBurnableAt(address spender, uint256 certificateId, uint256 timestamp) (external)`

- `burn(address spender, uint256 certificateId) (external)`

- `split(uint256 certificateId, uint256 percentageSplit) (external)`

### Function `MIN_LIQUIDITY() → uint256 external`

### Function `liquidityPool() → address external`

### Function `certificates(address owner) → uint256[] external`

### Function `liquidity(uint256 certificateId) → uint256 external`

### Function `enteredAt(uint256 certificateId) → uint256 external`

### Function `burnableAt(uint256 certificateId) → uint256 external`

### Function `certificateData(uint256 certificateId) → struct ILiquidityCertificate.CertificateData external`

### Function `mint(address owner, uint256 liquidityAmount, uint256 expiryAtCreation) → uint256 external`

### Function `setBurnableAt(address spender, uint256 certificateId, uint256 timestamp) external`

### Function `burn(address spender, uint256 certificateId) external`

### Function `split(uint256 certificateId, uint256 percentageSplit) → uint256 external`
