import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { getTxTimestamp, MONTH_SEC, toBN, UNIT, WEEK_SEC, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// integration tests
describe('Initiate Withdraw', async () => {
  // for each "it"
  //      expect(correct liquidityToken.balanceOf)
  //      expect(correct quote balance of depositor/withdrawer)
  //      expect(correct quote balance of LP)
  //      expect(correct totalQueuedWithdraw incrementation)

  let alice: SignerWithAddress;
  beforeEach(async () => {
    await seedFixture(); /// seed is probably overriding
    alice = hre.f.alice;
    await hre.f.c.snx.quoteAsset.mint(alice.address, toBN('100000'));
    await hre.f.c.snx.quoteAsset.connect(alice).approve(hre.f.c.liquidityPool.address, toBN('100000'));
    await hre.f.c.liquidityPool.connect(alice).initiateDeposit(alice.address, toBN('10000'));
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processDepositQueue(1);
    expect(await hre.f.c.liquidityTokens.balanceOf(alice.address)).eq(toBN('10000'));
  });

  // general
  it('revert cases', async () => {
    // reverts below minimum deposits
    await expect(hre.f.c.liquidityPool.initiateWithdraw(hre.f.alice.address, toBN('0.9'))).revertedWith(
      'MinimumWithdrawNotMet',
    );
    // cannot initiate with zero address
    await expect(hre.f.c.liquidityPool.initiateWithdraw(ZERO_ADDRESS, toBN('1'))).revertedWith(
      'InvalidBeneficiaryAddress',
    );
  });

  it("burns operator's tokens but sends quote to beneficiary", async () => {
    const oldBeneficiaryBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

    // initiate
    await hre.f.c.liquidityPool.connect(alice).initiateWithdraw(hre.f.deployer.address, toBN('1000'));
    expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('1000'));
    const withdrawalFee = toBN('1000').mul(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalFee).div(UNIT);

    // process
    await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);
    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(1);
    expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('0'));
    expect(oldBeneficiaryBal).to.eq(
      (await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.deployer.address)).sub(toBN('1000').sub(withdrawalFee)),
    );
  });

  // immediate
  it('withdraw amount below minimum', async () => {
    const minWithdraw = DEFAULT_LIQUIDITY_POOL_PARAMS.minDepositWithdraw as BigNumber;
    await expect(hre.f.c.liquidityPool.initiateWithdraw(alice.address, minWithdraw.sub(toBN('1')))).to.revertedWith(
      'MinimumWithdrawNotMet',
    );
  });
  it('immediately process when all boards settled and no live boards', async () => {
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    await hre.f.c.liquidityPool.connect(alice).initiateWithdraw(alice.address, toBN('10000'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(alice.address)).eq(toBN('100000')); // no fee
  });

  it('successfully queues and generates correct withdrawal ticket', async () => {
    const firstWithdrawal = await hre.f.c.liquidityPool.connect(alice).initiateWithdraw(alice.address, toBN('1000'));
    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);
    expect(await hre.f.c.liquidityPool.nextQueuedWithdrawalId()).eq(1);
    expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('1000'));

    const secondWithdrawal = await hre.f.c.liquidityPool.connect(alice).initiateWithdraw(alice.address, toBN('3000'));
    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);
    expect(await hre.f.c.liquidityPool.nextQueuedWithdrawalId()).eq(2);
    expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('4000'));

    const thirdWithdrawal = await hre.f.c.liquidityPool.connect(alice).initiateWithdraw(alice.address, toBN('6000'));
    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);
    expect(await hre.f.c.liquidityPool.nextQueuedWithdrawalId()).eq(3);
    expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('10000'));

    expect(await hre.f.c.liquidityTokens.balanceOf(alice.address)).eq(toBN('0'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(alice.address)).to.eq(toBN('90000'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('510000'));

    await validateWithdrawalRecord(0, alice.address, toBN('1000'), toBN('0'), await getTxTimestamp(firstWithdrawal));
    await validateWithdrawalRecord(1, alice.address, toBN('3000'), toBN('0'), await getTxTimestamp(secondWithdrawal));
    await validateWithdrawalRecord(2, alice.address, toBN('6000'), toBN('0'), await getTxTimestamp(thirdWithdrawal));

    // console.log("") // deal with fantom "AssertionError: Expected "0" to be equal 2" error
  });
});

export async function validateWithdrawalRecord(
  id: number,
  beneficiary: string,
  tokens: BigNumber,
  quoteSent: BigNumber,
  initiatedTime: number,
) {
  const withdrawal = await hre.f.c.liquidityPool.queuedWithdrawals(id);
  expect(withdrawal.id).to.eq(id);
  expect(withdrawal.beneficiary).to.eq(beneficiary);
  assertCloseToPercentage(withdrawal.amountTokens, tokens, toBN('0.0001'));
  expect(withdrawal.quoteSent).to.eq(quoteSent);
  expect(withdrawal.withdrawInitiatedTime).to.eq(initiatedTime);
}
