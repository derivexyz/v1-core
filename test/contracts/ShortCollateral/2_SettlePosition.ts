import { BigNumberish } from 'ethers';
import { HOUR_SEC, MONTH_SEC, OptionType, PositionState, toBN } from '../../../scripts/util/web3utils';
import {
  fullyClosePosition,
  mockPrice,
  openDefaultLongCall,
  openPosition,
  openPositionWithOverrides,
  setETHPrice,
} from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

export async function settlePositionAndCheckQuoteBalance(
  mockPrice: string,
  positionId: BigNumberish,
  traderProfit: string,
  returnedCollat: string,
) {
  await fastForward(MONTH_SEC);
  await setETHPrice(toBN(mockPrice));
  await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
  const preBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  const preOutstanding = await hre.f.c.liquidityPool.totalOutstandingSettlements();

  await hre.f.c.shortCollateral.settleOptions([positionId]);
  const postBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  const postOutstanding = await hre.f.c.liquidityPool.totalOutstandingSettlements();

  expect(preBalance.add(toBN(traderProfit)).add(toBN(returnedCollat))).to.eq(postBalance);
  expect(preOutstanding.sub(toBN(traderProfit))).to.eq(postOutstanding);
}

export async function settlePositionAndCheckBaseBalance(
  mockPrice: string,
  positionId: BigNumberish,
  returnedCollat: string,
) {
  await fastForward(MONTH_SEC);
  await setETHPrice(toBN(mockPrice));
  await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
  const preBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
  expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(toBN('0'));
  await hre.f.c.shortCollateral.settleOptions([positionId]);
  const postBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
  expect(preBalance.add(toBN(returnedCollat))).to.eq(postBalance);
  expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(toBN('0'));
}

describe('SettlePosition', () => {
  beforeEach(seedFixture);

  describe('Invalid settles', async () => {
    it("reverts if strike hasn't expired", async () => {
      const positionId = await openDefaultLongCall();
      await expect(hre.f.c.shortCollateral.settleOptions([positionId])).to.revertedWith('BoardMustBeSettled');
    });

    it("reverts if one strike of batch hasn't expired", async () => {
      await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: 2 * MONTH_SEC });
      const [, correctBoardPosition] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      const [, incorrectBoardPosition] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 6,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await fastForward(MONTH_SEC);
      await expect(
        hre.f.c.shortCollateral.settleOptions([correctBoardPosition, incorrectBoardPosition]),
      ).to.revertedWith('BoardMustBeSettled');
    });

    it('reverts if position closed', async () => {
      const [, position] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await fastForward(HOUR_SEC);
      await fullyClosePosition(position);
      await fastForward(MONTH_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await expect(hre.f.c.shortCollateral.settleOptions([position])).to.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });

    it('reverts if position merged', async () => {
      const [, firstPosition] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      const [, secondPosition] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('5'),
      });

      await hre.f.c.optionToken.merge([firstPosition, secondPosition]);
      expect((await hre.f.c.optionToken.getOptionPosition(firstPosition)).state).to.eq(PositionState.ACTIVE);
      expect((await hre.f.c.optionToken.getOptionPosition(secondPosition)).state).to.eq(PositionState.MERGED);

      await fastForward(MONTH_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await expect(hre.f.c.shortCollateral.settleOptions([secondPosition])).to.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
      await hre.f.c.shortCollateral.settleOptions([firstPosition]);
    });

    it('reverts if position liquidated', async () => {
      const [, position] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('2'),
        setCollateralTo: toBN('1'),
      });

      await mockPrice('sETH', toBN('4000'));

      await hre.f.c.optionMarket.liquidatePosition(position, hre.f.deployer.address);
      expect((await hre.f.c.optionToken.getOptionPosition(position)).state).to.eq(PositionState.LIQUIDATED);

      await fastForward(MONTH_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await expect(hre.f.c.shortCollateral.settleOptions([position])).to.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });

    it("reverts if board hasn't been settled", async () => {
      const positionId = await openDefaultLongCall();
      await fastForward(MONTH_SEC);
      await setETHPrice(toBN('2000'));
      await expect(hre.f.c.shortCollateral.settleOptions([positionId])).to.revertedWith('BoardMustBeSettled');
    });
  });

  describe('long call', async () => {
    let posId: BigNumberish;
    beforeEach(async () => {
      [, posId] = await openPosition({
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: hre.f.strike.strikeId,
      });
    });

    it('pays out nothing if OTM', async () => {
      await settlePositionAndCheckQuoteBalance('1000', posId, '0', '0');
    });
    it('pays out value if ITM', async () => {
      await settlePositionAndCheckQuoteBalance('2000', posId, '5000', '0');
    });
  });

  describe('long put', async () => {
    let posId: BigNumberish;
    beforeEach(async () => {
      [, posId] = await openPosition({
        amount: toBN('10'),
        optionType: OptionType.LONG_PUT,
        strikeId: hre.f.strike.strikeId,
      });
    });

    it('pays out nothing if OTM', async () => {
      await settlePositionAndCheckQuoteBalance('2000', posId, '0', '0');
    });
    it('pays out value if ITM', async () => {
      await settlePositionAndCheckQuoteBalance('1000', posId, '5000', '0');
    });
  });

  describe('short call base', async () => {
    let posId: BigNumberish;
    beforeEach(async () => {
      [, posId] = await openPosition({
        amount: toBN('10'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('10'),
        strikeId: hre.f.strike.strikeId,
      });
    });

    it('returns collateral fully if OTM', async () => {
      await settlePositionAndCheckBaseBalance('1000', posId, '10');
    });
    it('returns collateral minus value if ITM', async () => {
      await settlePositionAndCheckBaseBalance('2000', posId, '7.48110831234256927');
    });
    it('returns 0 collateral in the case where fee + amount owed is greater than the value of the base', async () => {
      await settlePositionAndCheckBaseBalance('2000000', posId, '0');
    });
  });

  describe('short put', async () => {
    let posId: BigNumberish;
    beforeEach(async () => {
      [, posId] = await openPosition({
        amount: toBN('10'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        setCollateralTo: toBN('15000'),
        strikeId: hre.f.strike.strikeId,
      });
    });

    it('returns collateral fully if OTM', async () => {
      await settlePositionAndCheckQuoteBalance('2000', posId, '0', '15000');
    });
    it('returns collateral minus value if ITM', async () => {
      await settlePositionAndCheckQuoteBalance('1000', posId, '0', '10000');
    });
  });

  describe('Misc', async () => {
    it('can settle split positions', async () => {
      const [, firstPosition] = await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('10'),
      });

      await hre.f.c.optionToken.split(firstPosition, toBN('5'), toBN('0'), hre.f.alice.address);
      const secondPosition = (await hre.f.c.optionToken.getOwnerPositions(hre.f.alice.address))[0].positionId;
      expect((await hre.f.c.optionToken.getOptionPosition(firstPosition)).state).to.eq(PositionState.ACTIVE);
      expect((await hre.f.c.optionToken.getOptionPosition(secondPosition)).state).to.eq(PositionState.ACTIVE);

      await fastForward(MONTH_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.shortCollateral.settleOptions([firstPosition, secondPosition]);
    });

    it('sets position states to settled and allows non-owners to settle', async () => {
      const r1 = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      const r2 = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_PUT,
        amount: toBN('1'),
      });
      const r3 = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('1'),
        setCollateralTo: toBN('1'),
      });
      const r4 = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('1'),
        setCollateralTo: toBN('10000'),
      });
      const r5 = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_PUT_QUOTE,
        amount: toBN('1'),
        setCollateralTo: toBN('10000'),
      });

      const positionIds = [r1[1], r2[1], r3[1], r4[1], r5[1]];

      await fastForward(MONTH_SEC);
      await setETHPrice(toBN('3000'));
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      // settle insolvent first
      await hre.f.c.shortCollateral.connect(hre.f.alice).settleOptions(positionIds);

      const positions = await hre.f.c.optionToken.getOptionPositions(positionIds);
      for (const position of positions) {
        expect(position.state).to.eq(PositionState.SETTLED);
      }

      expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).longCall).to.eq(toBN('1'));
      expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).longPut).to.eq(toBN('1'));
      expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).shortCallBase).to.eq(toBN('1'));
      expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).shortCallQuote).to.eq(toBN('1'));
      expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).shortPut).to.eq(toBN('1'));
    });
  });
});
