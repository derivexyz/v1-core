// integration tests
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
// import * as _ from 'lodash';
import { currentTime, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { LiquidityPool } from '../../../typechain-types';
import { openDefaultLongPut } from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE, DEFAULT_LIQUIDITY_POOL_PARAMS, DEFAULT_SECURITY_MODULE } from '../../utils/defaultParams';
import {
  deployGlobalTestContracts,
  deployMarketTestContracts,
  initGlobalTestSystem,
  initMarketTestSystem,
  TestSystemContractsType,
} from '../../utils/deployTestSystem';
import { seedFixture } from '../../utils/fixture';
import { mergeDeep } from '../../utils/package/merge';
import { expect, hre } from '../../utils/testSetup';

describe('Misc', async () => {
  let c: TestSystemContractsType;
  let lp: LiquidityPool;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
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
      c.liquidityTokens.address,
      c.optionGreekCache.address,
      ZERO_ADDRESS,
      deployer.address,
      c.snx.quoteAsset.address,
      c.snx.baseAsset.address,
    );

    await lp.setLiquidityPoolParameters(DEFAULT_LIQUIDITY_POOL_PARAMS);
  });

  it('reverts in a number of scenarios', async () => {
    await expect(lp.lockQuote(1, 0)).revertedWith('LockingMoreQuoteThanIsFree');
    await expect(lp.sendShortPremium(ZERO_ADDRESS, 1, 0, 0)).revertedWith('SendPremiumNotEnoughCollateral');
    await lp.boardSettlement(0, 0, 0, 0);
    const time = BigNumber.from(await currentTime());
    expect(await lp.CBTimestamp()).eq(time.add(DEFAULT_LIQUIDITY_POOL_PARAMS.boardSettlementCBTimeout));
    await lp.setLiquidityPoolParameters({
      ...DEFAULT_LIQUIDITY_POOL_PARAMS,
      boardSettlementCBTimeout: 60,
    });
    await lp.boardSettlement(0, 0, 0, 0);
    // timestamp hasn't updated because new timeout was lower than existing CB
    expect(await lp.CBTimestamp()).eq(time.add(DEFAULT_LIQUIDITY_POOL_PARAMS.boardSettlementCBTimeout));

    await c.snx.quoteAsset.mint(lp.address, toBN('1000'));

    await c.snx.quoteAsset.setForceFail(true);
    await expect(lp.sendShortPremium(alice.address, toBN('1'), toBN('1000'), 0)).revertedWith('QuoteTransferFailed');
    await c.snx.quoteAsset.setForceFail(false);

    await lp.boardSettlement(0, 0, toBN('10'), 0);
    await lp.sendSettlementValue(alice.address, toBN('100'));
    // only 10 is transferred as that is how much is outstanding
    expect(await c.snx.quoteAsset.balanceOf(alice.address)).eq(toBN('10'));

    await expect(lp.reclaimInsolventQuote(DEFAULT_BASE_PRICE, toBN('1000'))).revertedWith(
      'NotEnoughFreeToReclaimInsolvency',
    );

    await expect(lp.connect(alice).transferQuoteToHedge(DEFAULT_BASE_PRICE, 0)).revertedWith('OnlyPoolHedger');
    await expect(lp.connect(alice).lockQuote(0, 0)).revertedWith('OnlyOptionMarket');
    await expect(lp.connect(alice).sendSettlementValue(alice.address, 0)).revertedWith('OnlyShortCollateral');
  });

  it('reverts if optionValue > total asset value', async () => {
    await seedFixture();
    await hre.f.c.poolHedger.hedgeDelta();
    await openDefaultLongPut();

    const lpQuoteBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
    await hre.f.c.snx.quoteAsset.burn(hre.f.c.liquidityPool.address, lpQuoteBalance);
    await expect(hre.f.c.liquidityPool.getTotalPoolValueQuote()).revertedWith('OptionValueDebtExceedsTotalAssets');
  });

  it.skip('test all modifiers...');
});
