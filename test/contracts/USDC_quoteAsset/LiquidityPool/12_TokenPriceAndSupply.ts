import { currentTime, DAY_SEC, toBN, WEEK_SEC } from '../../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../../utils/assert';
import { openDefaultLongCall } from '../../../utils/contractHelpers';
import { fastForward } from '../../../utils/evm';
import { deployFixtureUSDC, seedFixtureUSDC } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

// integration tests
describe.skip('USDC_quote - TokenPriceAndSupply', async () => {
  beforeEach(async () => {
    await seedFixtureUSDC({ useUSDC: true });
  });

  it('gets price before deposits', async () => {
    await deployFixtureUSDC();
    expect(await hre.f.c.liquidityPool.getTokenPrice()).to.eq(toBN('1'));
    expect(await hre.f.c.liquidityPool.getTotalTokenSupply()).to.eq(toBN('0'));
  });

  it('gets price on first deposit', async () => {
    expect(await hre.f.c.liquidityPool.getTokenPrice()).to.eq(toBN('1'));
    expect(await hre.f.c.liquidityPool.getTotalTokenSupply()).to.eq(toBN('500000'));
  });

  it('accounts for withdrawal fee during 100% withdrawal', async () => {
    await hre.f.c.liquidityPool.initiateWithdraw(
      hre.f.deployer.address,
      await hre.f.c.liquidityToken.balanceOf(hre.f.deployer.address),
    );
    expect(await hre.f.c.liquidityPool.getTotalTokenSupply()).to.eq(toBN('500000'));

    await fastForward(WEEK_SEC * 2);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);

    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).to.eq(2);
    expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('5000'));
    expect(await hre.f.c.liquidityPool.getTotalTokenSupply()).to.eq(toBN('0'));
    expect(await hre.f.c.liquidityPool.getTokenPrice()).to.eq(toBN('1'));
  });

  it.skip('gives new depositor accrued fee after 100% withdrawal & liveBoards == 0', async () => {
    // poolHedger.hedgeDelta acts differently causing issues here
    // remove largest deposit and charge fee
    await hre.f.c.liquidityPool.initiateWithdraw(
      hre.f.deployer.address,
      await hre.f.c.liquidityToken.balanceOf(hre.f.deployer.address),
    );
    await fastForward(WEEK_SEC * 2);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);
    await fastForward(WEEK_SEC * 2 + 1);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(0);
    expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('5000'));
    expect(await hre.f.c.liquidityPool.getTokenPrice()).to.eq(toBN('1'));

    // new depositor to gain accrued fees
    await hre.f.c.snx.quoteAsset.mint(hre.f.signers[1].address, 10000e6);
    await hre.f.c.snx.quoteAsset.connect(hre.f.signers[1]).approve(hre.f.c.liquidityPool.address, 10000e6);
    await hre.f.c.liquidityPool.connect(hre.f.signers[1]).initiateDeposit(hre.f.signers[1].address, 10000e6);

    expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('15000'));
    expect(await hre.f.c.liquidityPool.getTotalTokenSupply()).to.eq(toBN('10000'));

    await hre.f.c.liquidityPool.connect(hre.f.signers[1]).initiateWithdraw(hre.f.signers[1].address, toBN('10000'));
    expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('0'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[1].address)).to.eq(15000e6);
  });

  it('includes queued withdrawals in supply', async () => {
    await hre.f.c.liquidityPool.initiateWithdraw(
      hre.f.deployer.address,
      await hre.f.c.liquidityToken.balanceOf(hre.f.deployer.address),
    );
    expect(await hre.f.c.liquidityPool.getTotalTokenSupply()).to.eq(toBN('500000'));
  });

  it('getTokenPriceWithCheck returns CBtimestamp', async () => {
    await openDefaultLongCall();
    await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, toBN('500000'));
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).to.be.gt(await currentTime());
    await fastForward(DAY_SEC);
    const result = await hre.f.c.liquidityPool.getTokenPriceWithCheck();
    assertCloseToPercentage(result[0], toBN('1'), toBN('0.01'));
    expect(result[1]).to.eq(true);
    expect(result[2]).to.eq(await hre.f.c.liquidityPool.CBTimestamp());
  });
});
