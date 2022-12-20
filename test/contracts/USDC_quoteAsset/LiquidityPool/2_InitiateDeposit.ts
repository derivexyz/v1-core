import { TransactionResponse } from '@ethersproject/abstract-provider';
import { BigNumber } from 'ethers';
import { getTxTimestamp, HOUR_SEC, MONTH_SEC, toBN, ZERO_ADDRESS } from '../../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../../utils/assert';
import { seedFixtureUSDC } from '../../../utils/fixture';
import { fastForward } from '../../../utils/evm';
import { expect, hre } from '../../../utils/testSetup';
const initialBalance = 100000e6;

// integration tests
describe('USDC_quote - Initiate Deposit', async () => {
  // for each "it"
  //      expect(correct liquidityToken.balanceOf)
  //      expect(correct quote balance of depositor/withdrawer)
  //      expect(correct quote balance of LP)
  //      expect(correct totalQueuedDeposits incrementation)

  beforeEach(async () => {
    await seedFixtureUSDC({ noHedger: true, useUSDC: true });
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, initialBalance);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, initialBalance);
  });

  it('reverts for various reasons', async () => {
    // reverts below minimum deposits
    await expect(hre.f.c.liquidityPool.initiateDeposit(hre.f.alice.address, 9e5)).revertedWith('MinimumDepositNotMet');
    // cannot initiate with zero address
    await expect(hre.f.c.liquidityPool.initiateDeposit(ZERO_ADDRESS, toBN('1'))).revertedWith(
      'InvalidBeneficiaryAddress',
    );
    // reverts if depositor does not have enough quote
    await hre.f.c.snx.quoteAsset.mint(hre.f.signers[3].address, 1000e6);
    await hre.f.c.snx.quoteAsset.connect(hre.f.signers[3]).approve(hre.f.c.liquidityPool.address, 1000e6);

    // deposit called by signer_1 to signer_2
    // initiateDeposite input at 18dp but transfer in quote asset decimals
    await expect(
      hre.f.c.liquidityPool.connect(hre.f.signers[3]).initiateDeposit(hre.f.signers[4].address, 1001e6),
    ).revertedWith('ERC20: transfer amount exceeds balance');
  });

  // TODO check quote balances with deposits
  it('immediately process when all boards settled/no live boards', async () => {
    // settle board
    await fastForward(MONTH_SEC + 1);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(0);

    // initiate immediate deposit
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.signers[2].address, 1000e6);
    expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('0'));
    expect(await hre.f.c.liquidityToken.balanceOf(hre.f.signers[2].address)).eq(toBN('1000'));
    const deposit = await hre.f.c.liquidityPool.queuedDeposits(1);
    expect(deposit.id).eq(0);
  });

  it('stores multiple queued deposits in correct id', async () => {
    let tx: TransactionResponse;

    tx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 100e6);
    let currentTimestamp = await getTxTimestamp(tx);
    expect(await hre.f.c.liquidityPool.nextQueuedDepositId()).eq(2);
    expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('100'));
    await validateDepositRecord(1, hre.f.alice.address, toBN('100'), toBN('0'), currentTimestamp);
    await fastForward(HOUR_SEC);

    tx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 200e6);
    currentTimestamp = await getTxTimestamp(tx);
    expect(await hre.f.c.liquidityPool.nextQueuedDepositId()).eq(3);
    expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('300'));
    await validateDepositRecord(2, hre.f.alice.address, toBN('200'), toBN('0'), currentTimestamp);
    await fastForward(HOUR_SEC);

    tx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 300e6);
    currentTimestamp = await getTxTimestamp(tx);
    expect(await hre.f.c.liquidityPool.nextQueuedDepositId()).eq(4);
    expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('600'));
    await validateDepositRecord(3, hre.f.alice.address, toBN('300'), toBN('0'), currentTimestamp);
    await fastForward(HOUR_SEC);

    const quoteBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address);
    expect(initialBalance - quoteBalance).to.eq(600e6);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(500600e6);
  });
});

export async function validateDepositRecord(
  id: number,
  beneficiary: string,
  amountLiquidity: BigNumber,
  mintedTokens: BigNumber,
  depositInitiatedTime: number,
) {
  const deposit = await hre.f.c.liquidityPool.queuedDeposits(id);
  expect(deposit.id).to.eq(id);
  expect(deposit.beneficiary).to.eq(beneficiary);
  expect(deposit.amountLiquidity).to.eq(amountLiquidity);
  assertCloseToPercentage(deposit.mintedTokens, mintedTokens, toBN('0.0001'));
  expect(deposit.depositInitiatedTime).to.eq(depositInitiatedTime);
}
