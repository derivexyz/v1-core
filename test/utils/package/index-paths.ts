export const lyraContractPaths = [
  // library
  '@lyrafinance/protocol/contracts/lib/BlackScholes.sol',
  '@lyrafinance/protocol/contracts/lib/FixedPointMathLib.sol',
  '@lyrafinance/protocol/contracts/lib/GWAV.sol',
  '@lyrafinance/protocol/contracts/lib/SimpleInitializeable.sol',

  // core
  '@lyrafinance/protocol/contracts/LiquidityPool.sol',
  '@lyrafinance/protocol/contracts/LiquidityTokens.sol',
  '@lyrafinance/protocol/contracts/OptionGreekCache.sol',
  '@lyrafinance/protocol/contracts/OptionMarket.sol',
  '@lyrafinance/protocol/contracts/OptionToken.sol',
  '@lyrafinance/protocol/contracts/PoolHedger.sol',
  '@lyrafinance/protocol/contracts/ShortCollateral.sol',
  '@lyrafinance/protocol/contracts/SynthetixAdapter.sol',

  // periphery
  '@lyrafinance/protocol/contracts/periphery/VaultAdapter.sol',
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
  '@lyrafinance/protocol/contracts/test-helpers/TestAddressResolver.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestCollateralShort.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestCurve.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestDelegateApprovals.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestDelegateApprovals.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestERC20.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestERC20Fail.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestERC20SetDecimals.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestExchanger.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestExchangeRates.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestFaucet.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestSwapRouter.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestSynthetix.sol',
  '@lyrafinance/protocol/contracts/test-helpers/TestSynthetixReturnZero.sol',

  // @openzeppelin
  '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol',
  '@openzeppelin/contracts/token/ERC20/ERC20.sol',
  '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol',
  '@openzeppelin/contracts/access/Ownable.sol'
]