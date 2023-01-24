import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { beforeEach } from 'mocha';
import { MONTH_SEC, OptionType, toBN, WEEK_SEC, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import {
  closePositionWithOverrides,
  defaultBTCExchange,
  DEFAULT_SHORT_CALL_BASE,
  openDefaultShortCallBase,
  resetMinCollateralParameters,
} from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// Integration test
describe('Market & Global Pause', async () => {
  beforeEach(async () => {
    await seedFixture();
    await switchToOnlyMarketPause();
  });

  it('reverts if not owner', async () => {
    await expect(pauseMarket(false, hre.f.alice)).to.revertedWith('OnlyOwner');
    await expect(pauseGlobal(false, hre.f.alice)).to.revertedWith('OnlyOwner');
  });
  it('reverts on invalid market pause', async () => {
    await expect(hre.f.c.synthetixAdapter.setMarketPaused(ZERO_ADDRESS, true)).revertedWith('InvalidAddress');
  });
  it('reverts getExchangeParams when set to paused', async () => {
    await expect(hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address)).to.revertedWith(
      'MarketIsPaused',
    );
    await switchToOnlyGlobalPause();
    await expect(hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address)).to.revertedWith(
      'AllMarketsPaused',
    );

    await pauseGlobal(false);
    await pauseMarket(false);
    await expect(hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address));
  });
  it('executes getExchangeParams when paused on other market', async () => {
    await defaultBTCExchange();
    await expect(hre.f.c.synthetixAdapter.getExchangeParams(ZERO_ADDRESS));
  });
  it('reverts open/close/liquidate when paused', async () => {
    await expect(openDefaultShortCallBase()).to.revertedWith('MarketIsPaused');
    await switchToOnlyGlobalPause();
    await expect(openDefaultShortCallBase()).to.revertedWith('AllMarketsPaused');
  });
  it('reverts open/close/liquidate when paused', async () => {
    const positionId = await bypassPauseAndOpenPosition();
    await expect(closeDefaultBasePosition(positionId)).to.revertedWith('MarketIsPaused');
    await switchToOnlyGlobalPause();
    await expect(closeDefaultBasePosition(positionId)).to.revertedWith('AllMarketsPaused');
  });
  it('reverts liquidate when paused', async () => {
    const positionId = await bypassPauseAndOpenPosition();
    await resetMinCollateralParameters({
      minStaticQuoteCollateral: DEFAULT_SHORT_CALL_BASE.setCollateralTo.add(toBN('0.01')),
    });
    await expect(hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.deployer.address)).revertedWith(
      'MarketIsPaused',
    );
    await switchToOnlyGlobalPause();
    await expect(hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.deployer.address)).revertedWith(
      'AllMarketsPaused',
    );
  });
  it('reverts settle position/board when paused', async () => {
    const positionId = await bypassPauseAndOpenPosition();
    await fastForward(MONTH_SEC);
    await expect(hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId)).to.revertedWith('MarketIsPaused');
    await switchToOnlyGlobalPause();
    await expect(hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId)).to.revertedWith('AllMarketsPaused');

    await pauseGlobal(false, hre.f.signers[0]);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    await switchToOnlyMarketPause();
    await expect(hre.f.c.shortCollateral.settleOptions([positionId])).to.revertedWith('MarketIsPaused');
    await switchToOnlyGlobalPause();
    await expect(hre.f.c.shortCollateral.settleOptions([positionId])).to.revertedWith('AllMarketsPaused');
  });
  it('reverts deposit/withdraw action when paused', async () => {
    await expect(hre.f.c.liquidityPool.initiateDeposit(hre.f.signers[0].address, toBN('10000'))).revertedWith(
      'MarketIsPaused',
    );
    await expect(hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, toBN('5000'))).revertedWith(
      'MarketIsPaused',
    );
    await pauseMarket(false);
    await hre.f.c.liquidityPool.initiateDeposit(hre.f.signers[0].address, toBN('10000'));
    await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, toBN('5000'));
    await fastForward(WEEK_SEC + 1);
    await pauseMarket(true);

    await expect(hre.f.c.liquidityPool.processDepositQueue(1)).to.revertedWith('MarketIsPaused');
    await expect(hre.f.c.liquidityPool.processWithdrawalQueue(1)).to.revertedWith('MarketIsPaused');
    await switchToOnlyGlobalPause();
    await expect(hre.f.c.liquidityPool.processDepositQueue(1)).to.revertedWith('AllMarketsPaused');
    await expect(hre.f.c.liquidityPool.processWithdrawalQueue(1)).to.revertedWith('AllMarketsPaused');
  });
  it('reverts delta hedge when paused', async () => {
    await expect(hre.f.c.poolHedger.hedgeDelta()).to.revertedWith('MarketIsPaused');
    await switchToOnlyGlobalPause();
    await expect(hre.f.c.poolHedger.hedgeDelta()).to.revertedWith('AllMarketsPaused');
  });
});

export const pauseMarket = async (pause: boolean, signer?: SignerWithAddress) => {
  return await hre.f.c.synthetixAdapter
    .connect(signer || hre.f.signers[0])
    .setMarketPaused(hre.f.c.optionMarket.address, pause);
};

export const pauseGlobal = async (pause: boolean, signer?: SignerWithAddress) => {
  return await hre.f.c.synthetixAdapter.connect(signer || hre.f.signers[0]).setGlobalPaused(pause);
};

export const switchToOnlyGlobalPause = async () => {
  await pauseMarket(false);
  await pauseGlobal(true);
};

export const switchToOnlyMarketPause = async () => {
  await pauseMarket(true);
  await pauseGlobal(false);
};

export const bypassPauseAndOpenPosition = async () => {
  await pauseMarket(false, hre.f.signers[0]);
  const positionId = await openDefaultShortCallBase();
  await pauseMarket(true, hre.f.signers[0]);
  return positionId;
};

export const closeDefaultBasePosition = async (positionId: BigNumber) => {
  return await closePositionWithOverrides(hre.f.c, {
    strikeId: hre.f.strike.strikeId,
    positionId: positionId,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: toBN('1'),
    setCollateralTo: 0,
  });
};
