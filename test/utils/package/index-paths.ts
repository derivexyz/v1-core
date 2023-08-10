export const lyraContractPaths = [
  // library
  '@lyrafinance/protocol/contracts/libraries/BlackScholes.sol',
  '@lyrafinance/protocol/contracts/libraries/FixedPointMathLib.sol',
  '@lyrafinance/protocol/contracts/libraries/GWAV.sol',
  '@lyrafinance/protocol/contracts/libraries/SimpleInitializable.sol',
  '@lyrafinance/protocol/contracts/libraries/PoolHedger.sol',

  // core
  '@lyrafinance/protocol/contracts/LiquidityPool.sol',
  '@lyrafinance/protocol/contracts/LiquidityToken.sol',
  '@lyrafinance/protocol/contracts/OptionGreekCache.sol',
  '@lyrafinance/protocol/contracts/OptionMarket.sol',
  '@lyrafinance/protocol/contracts/OptionToken.sol',
  '@lyrafinance/protocol/contracts/ShortCollateral.sol',

  // interfaces
  '@lyrafinance/protocol/contracts/interfaces/ILiquidityPool.sol',
  '@lyrafinance/protocol/contracts/interfaces/IOptionGreekCache.sol',
  '@lyrafinance/protocol/contracts/interfaces/IOptionMarket.sol',
  '@lyrafinance/protocol/contracts/interfaces/IOptionMarketPricer.sol',
  '@lyrafinance/protocol/contracts/interfaces/IOptionToken.sol',
  '@lyrafinance/protocol/contracts/interfaces/IGWAVOracle.sol',
  '@lyrafinance/protocol/contracts/interfaces/ICurve.sol',
  '@lyrafinance/protocol/contracts/interfaces/ILyraRegistry.sol',
  '@lyrafinance/protocol/contracts/interfaces/IShortCollateral.sol',
  '@lyrafinance/protocol/contracts/interfaces/ISynthetixAdapter.sol',

  // periphery
  '@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol',
  '@lyrafinance/protocol/contracts/periphery/BasicFeeCounter.sol',
  '@lyrafinance/protocol/contracts/periphery/BasicLiquidityCounter.sol',
  '@lyrafinance/protocol/contracts/periphery/GWAVOracle.sol',
  '@lyrafinance/protocol/contracts/periphery/KeeperHelper.sol',
  '@lyrafinance/protocol/contracts/periphery/LyraRegistry.sol',
  '@lyrafinance/protocol/contracts/periphery/MultistepSwapper.sol',
  '@lyrafinance/protocol/contracts/periphery/OptionMarketViewer.sol',
  '@lyrafinance/protocol/contracts/periphery/Wrapper/BasicOptionMarketWrapper.sol',
  '@lyrafinance/protocol/contracts/periphery/Wrapper/OptionMarketWrapper.sol',
  '@lyrafinance/protocol/contracts/periphery/Wrapper/OptionMarketWrapperWithSwaps.sol',

  // snx
  '@lyrafinance/protocol/contracts/synthetix/AbstractOwned.sol',
  '@lyrafinance/protocol/contracts/synthetix/DecimalMath.sol',
  '@lyrafinance/protocol/contracts/synthetix/Owned.sol',
  '@lyrafinance/protocol/contracts/synthetix/OwnedUpgradeable.sol',
  '@lyrafinance/protocol/contracts/synthetix/SignedDecimalMath.sol',

  // mocks
  '@lyrafinance/protocol/contracts/test-helpers/BytesLib.sol',
  '@lyrafinance/protocol/contracts/test-helpers/MathTest.sol',
  '@lyrafinance/protocol/contracts/test-helpers/MockAggregatorV2V3.sol',
  '@lyrafinance/protocol/contracts/test-helpers/Path.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestCurve.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestERC20.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestERC20Fail.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestERC20SetDecimals.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestFaucet.sol',

  // @openzeppelin
  'openzeppelin-contracts-upgradeable-4.5.1/access/OwnableUpgradeable.sol',
  'openzeppelin-contracts-4.4.1/token/ERC20/ERC20.sol',
  'openzeppelin-contracts-4.4.1/token/ERC721/extensions/ERC721Enumerable.sol',
  'openzeppelin-contracts-4.4.1/access/Ownable.sol',
  'openzeppelin-contracts-4.4.1/security/ReentrancyGuard.sol',
];
