import { getContractArtifact } from '../../../scripts/util/parseFiles';

export function getArtifacts() {
  return {
    BasicLiquidityCounter: getContractArtifact('local', 'BasicLiquidityCounter', '../../artifacts/contracts/'),
    BasicFeeCounter: getContractArtifact('local', 'BasicFeeCounter', '../../artifacts/contracts'),
    BlackScholes: getContractArtifact('local', 'BlackScholes', '../../artifacts/contracts'),
    GWAV: getContractArtifact('local', 'GWAV', '../../artifacts/contracts'),
    GWAVOracle: getContractArtifact('local', 'GWAVOracle', '../../artifacts/contracts'),
    LiquidityPool: getContractArtifact('local', 'LiquidityPool', '../../artifacts/contracts'),
    LiquidityToken: getContractArtifact('local', 'LiquidityToken', '../../artifacts/contracts'),
    LyraRegistry: getContractArtifact('local', 'LyraRegistry', '../../artifacts/contracts'),
    OptionGreekCache: getContractArtifact('local', 'OptionGreekCache', '../../artifacts/contracts'),
    OptionMarket: getContractArtifact('local', 'OptionMarket', '../../artifacts/contracts'),
    OptionMarketPricer: getContractArtifact('local', 'OptionMarketPricer', '../../artifacts/contracts'),
    OptionMarketViewer: getContractArtifact('local', 'OptionMarketViewer', '../../artifacts/contracts'),
    OptionMarketWrapper: getContractArtifact('local', 'OptionMarketWrapper', '../../artifacts/contracts'),
    OptionToken: getContractArtifact('local', 'OptionToken', '../../artifacts/contracts'),
    ShortPoolHedger: getContractArtifact('local', 'ShortPoolHedger', '../../artifacts/contracts'),
    ShortCollateral: getContractArtifact('local', 'ShortCollateral', '../../artifacts/contracts'),
    SynthetixAdapter: getContractArtifact('local', 'SynthetixAdapter', '../../artifacts/contracts'),
    TestAddressResolver: getContractArtifact('local', 'TestAddressResolver', '../../artifacts/contracts'),
    TestCollateralShort: getContractArtifact('local', 'TestCollateralShort', '../../artifacts/contracts'),
    TestCurve: getContractArtifact('local', 'TestCurve', '../../artifacts/contracts'),
    TestDelegateApprovals: getContractArtifact('local', 'TestDelegateApprovals', '../../artifacts/contracts'),
    TestERC20Fail: getContractArtifact('local', 'TestERC20Fail', '../../artifacts/contracts'),
    TestSynthetixReturnZero: getContractArtifact('local', 'TestSynthetixReturnZero', '../../artifacts/contracts'),
    TestFaucet: getContractArtifact('local', 'TestFaucet', '../../artifacts/contracts'),
    TestExchanger: getContractArtifact('local', 'TestExchanger', '../../artifacts/contracts'),
    TestExchangeRates: getContractArtifact('local', 'TestExchangeRates', '../../artifacts/contracts'),
    MockAggregator: getContractArtifact('local', 'MockAggregatorV2V3', '../../artifacts/contracts'),
    KeeperHelper: getContractArtifact('local', 'KeeperHelper', '../../artifacts/contracts'),
  }
};
