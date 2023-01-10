// integration tests
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

// import * as _ from 'lodash';
import { currentTime, MONTH_SEC, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { LiquidityPool } from '../../../typechain-types';
import { openDefaultLongPut } from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_CB_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_SECURITY_MODULE,
} from '../../utils/defaultParams';
import {
  deployGlobalTestContracts,
  deployMarketTestContracts,
  initGlobalTestSystem,
  initMarketTestSystem,
  TestSystemContractsType,
} from '../../utils/deployTestSystem';
import { fastForward, restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { mergeDeep } from '../../utils/package/merge';
import { expect, hre } from '../../utils/testSetup';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';

describe('Misc', async () => {
  let c: TestSystemContractsType;
  let lp: LiquidityPool;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let snapshot: number;
  before(async () => {
    lp = await (await ethers.getContractFactory('LiquidityPool')).deploy();
    [deployer, alice] = await ethers.getSigners();

    const globalSystem = await deployGlobalTestContracts(deployer, false, {});
    const marketSystem = await deployMarketTestContracts(globalSystem, deployer, 'sETH', false, {});
    c = mergeDeep(globalSystem, marketSystem);

    await initGlobalTestSystem(c, deployer, {});
    await initMarketTestSystem('sETH', c, marketSystem, deployer, {
      liquidityPool: lp.address,
    });

    await c.synthetixAdapter.setGlobalsForContract(
      deployer.address,
      toBytes32('sUSD'),
      toBytes32('sETH'),
      DEFAULT_SECURITY_MODULE,
      toBytes32('testCode'),
    );

    await lp.init(
      c.synthetixAdapter.address,
      deployer.address,
      c.liquidityToken.address,
      c.optionGreekCache.address,
      c.poolHedger.address,
      deployer.address,
      c.snx.quoteAsset.address,
      c.snx.baseAsset.address,
    );

    await lp.setLiquidityPoolParameters(DEFAULT_LIQUIDITY_POOL_PARAMS);
    await lp.setCircuitBreakerParameters(DEFAULT_CB_PARAMS);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snapshot);
  });

  it('test all modifiers', async () => {
    await expect(lp.connect(alice).transferQuoteToHedge(toBN('100'))).to.revertedWith('OnlyPoolHedger');

    await expect(lp.connect(alice).boardSettlement(toBN('1'), toBN('1'), toBN('1'), toBN('1'))).to.revertedWith(
      'OnlyOptionMarket',
    );

    await expect(lp.connect(alice).sendSettlementValue(deployer.address, toBN('1'))).to.revertedWith(
      'OnlyShortCollateral',
    );
  });

  it('reverts in a number of scenarios', async () => {
    await expect(lp.lockPutCollateral(1, 0)).revertedWith('LockingMoreQuoteThanIsFree');
    await expect(lp.sendShortPremium(ZERO_ADDRESS, 1, 1, 0, 0, false)).revertedWith('SendPremiumNotEnoughCollateral');
    await lp.boardSettlement(0, 0, 0, 0);
    const time = BigNumber.from(await currentTime());
    expect(await lp.CBTimestamp()).eq(time.add(DEFAULT_CB_PARAMS.boardSettlementCBTimeout));
    await lp.setCircuitBreakerParameters({
      ...DEFAULT_CB_PARAMS,
      boardSettlementCBTimeout: 60,
    });
    await lp.boardSettlement(0, 0, 0, 0);
    // timestamp hasn't updated because new timeout was lower than existing CB
    expect(await lp.CBTimestamp()).eq(time.add(DEFAULT_CB_PARAMS.boardSettlementCBTimeout));

    await c.snx.quoteAsset.mint(lp.address, toBN('1000'));

    await c.snx.quoteAsset.setForceFail(true);
    await expect(lp.sendShortPremium(alice.address, toBN('1'), toBN('1'), toBN('1000'), 0, false)).revertedWith(
      'QuoteTransferFailed',
    );
    await c.snx.quoteAsset.setForceFail(false);

    await lp.boardSettlement(0, 0, toBN('10'), 0);
    await lp.sendSettlementValue(alice.address, toBN('100'));
    // only 10 is transferred as that is how much is outstanding
    expect(await c.snx.quoteAsset.balanceOf(alice.address)).eq(toBN('10'));

    await expect(lp.reclaimInsolventQuote(toBN('1000'))).revertedWith('NotEnoughFreeToReclaimInsolvency');

    await expect(lp.connect(alice).transferQuoteToHedge(DEFAULT_BASE_PRICE)).revertedWith('OnlyPoolHedger');
    await expect(lp.connect(alice).lockPutCollateral(0, 0)).revertedWith('OnlyOptionMarket');
    await expect(lp.connect(alice).sendSettlementValue(alice.address, 0)).revertedWith('OnlyShortCollateral');

    // reclaimInsolventBase failures
    await c.snx.quoteAsset.setForceFail(true);
    await expect(lp.reclaimInsolventBase(toBN('1'))).revertedWith('QuoteApprovalFailure');
    await c.snx.quoteAsset.setForceFail(false);

    await c.snx.baseAsset.mint(lp.address, toBN('1'));
    await c.snx.baseAsset.setForceFail(true);
    await expect(lp.exchangeBase()).revertedWith('BaseApprovalFailure');
    await c.snx.baseAsset.setForceFail(false);
  });

  it('reverts if optionValue > total asset value', async () => {
    await seedFixture();
    await hre.f.c.poolHedger.hedgeDelta();
    await openDefaultLongPut();

    const lpQuoteBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
    await hre.f.c.snx.quoteAsset.burn(hre.f.c.liquidityPool.address, lpQuoteBalance);
    expect((await hre.f.c.liquidityPool.getLiquidity()).longScaleFactor).eq(0);
  });
});
