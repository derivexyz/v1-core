import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { HOUR_SEC, MONTH_SEC, toBN, TradeType } from '../../../scripts/util/web3utils';
import { assertCloseTo, fastForward, restoreSnapshot, takeSnapshot } from '../../utils';
import { deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { expect } from '../../utils/testSetup';

describe('SafeSlippage trading tests', () => {
  let account: Signer;
  let account2: Signer;
  let accountAddr: string;

  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    account2 = signers[1];
    accountAddr = await account.getAddress();

    c = await deployTestSystem(account);

    await seedTestSystem(account, c);
    await c.test.quoteToken.mint(await account2.getAddress(), toBN('1000000'));
    await c.test.quoteToken.mint(await account.getAddress(), toBN('1000000'));

    await c.test.quoteToken.connect(account).approve(c.optionMarketSafeSlippage.address, toBN('1000000'));
    await c.test.baseToken.connect(account).approve(c.optionMarketSafeSlippage.address, toBN('1000000'));
    // await c.optionMarket.connect(account).approve(c.optionMarket.address, toBN('100000'));

    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();

    boardId = (await c.optionMarket.getLiveBoards())[0];
    listingIds = await c.optionMarket.getBoardListings(boardId);

    //approving optionMarket to handle ERC1155 tokens
    await c.optionToken.connect(c.optionMarket.signer).setApprovalForAll(c.optionMarketSafeSlippage.address, true);
  });

  describe('opening positions (No slippage)', async () => {
    describe('revert conditions', async () => {
      it('should revert if the listing id is invalid', async () => {
        await expect(
          c.optionMarketSafeSlippage.openPosition(10000, TradeType.LONG_CALL, toBN('1'), toBN('500'), toBN('200')),
        ).revertedWith('BoardFrozenOrTradingCutoffReached');
      });

      it('should revert if the listing is close to expiry', async () => {
        // Fast forward to an hour before expiry
        await fastForward(MONTH_SEC - HOUR_SEC);
        await expect(
          c.optionMarketSafeSlippage.openPosition(
            listingIds[0],
            TradeType.LONG_CALL,
            toBN('1'),
            toBN('300'),
            toBN('500'),
          ),
        ).revertedWith('BoardFrozenOrTradingCutoffReached');
      });
    });

    // No slippage cases using a range where min <= total <= max
    describe('base case long calls (No slippage)', async () => {
      it('should update the user balance and net exposure', async () => {
        const bal = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);

        // Using wide cost range
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('200'), toBN('500'));

        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(bal.add(toBN('1')));
      });

      it('should allow the user to buy both long and short calls', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('200'),
          toBN('500'),
        );
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('200'),
          toBN('500'),
        );
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));
      });

      it('should buy the base asset and send it to the LP', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('200'),
          toBN('500'),
        );
        await c.liquidityPool.exchangeBase();
        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(toBN('1'));
      });
    });

    describe('base case long puts (No slippage)', async () => {
      it('should allow open if the user is short puts', async () => {
        await c.optionMarketSafeSlippage.openPosition(1, TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50'));
        await c.optionMarketSafeSlippage.openPosition(1, TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));
      });

      it('should update the user balance and net exposure', async () => {
        await c.optionMarketSafeSlippage.openPosition(1, TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT);
        expect(balance).to.eq(toBN('1'));
      });

      it('should lock strike * amount in the LP', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_PUT,
          toBN('1'),
          toBN('80'),
          toBN('85'),
        );
        expect(
          (await c.liquidityPool.getLiquidity(toBN('1742.01337'), c.test.collateralShort.address)).usedCollatLiquidity,
        ).to.eq(toBN('1500'));
      });
    });

    describe('base case short calls (No slippage)', async () => {
      it('should update the user balance and net exposure', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('290'),
          toBN('300'),
        );
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL);
        expect(balance).to.eq(toBN('1'));
      });

      // This doesn't make much sense. You mean 'should allow open if the user has long calls'???
      it('should allow open if the user is long calls', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('300'),
          toBN('350'),
        );
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('290'),
          toBN('300'),
        );
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));
      });
    });

    describe('base case short puts (No slippage)', async () => {
      it('should allow open if the user is long puts', async () => {
        await c.optionMarketSafeSlippage.openPosition(1, TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));
        await c.optionMarketSafeSlippage.openPosition(1, TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));
      });

      it('should update the user balance and net exposure', async () => {
        await c.optionMarketSafeSlippage.openPosition(1, TradeType.SHORT_CALL, toBN('1'), toBN('290'), toBN('300'));
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL);
        expect(balance).to.eq(toBN('1'));
      });
    });
  });

  // Close Position testing
  describe('closing positions (No slippage)', async () => {
    // Testing that users can not pass invalid ids or sell/buy on expired boards
    describe('revert conditions', async () => {
      it('should revert if the listing id is invalid', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('300'),
          toBN('350'),
        );

        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);
        expect(balance).to.eq(toBN('1'));
        await fastForward(MONTH_SEC - HOUR_SEC);

        await expect(
          c.optionMarketSafeSlippage.closePosition(
            listingIds[0],
            TradeType.LONG_CALL,
            toBN('1'),
            toBN('300'),
            toBN('350'),
          ),
        ).revertedWith('BoardFrozenOrTradingCutoffReached');
      });
    });

    // closing long call (out of the money)
    describe('closing long call (non slip)', async () => {
      it('closing long call', async () => {
        // opening long call

        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('200'),
          toBN('350'),
        );

        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);
        expect(balance).to.eq(toBN('1'));
        await fastForward(HOUR_SEC);
        const quotePreBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // closing the position
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('200'),
          toBN('350'),
        );

        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        expect(assertCloseTo(postBalance.sub(quotePreBalance), toBN('296.9727118')));
      });
    });

    describe('closing long put (non slip)', async () => {
      it('closing long put', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.LONG_PUT,
          toBN('1'),
          toBN('50'),
          toBN('85'),
        );

        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT);
        expect(balance).to.eq(toBN('1'));
        await fastForward(HOUR_SEC);
        const quotePreBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // closing the position
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.LONG_PUT,
          toBN('1'),
          toBN('40'),
          toBN('60'),
        );

        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        expect(assertCloseTo(postBalance.sub(quotePreBalance), toBN('45.94019375')));
      });
    });

    // out of the money(for the user). Therefore loss
    describe('closing short call (non slip)', async () => {
      it('closing short call', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('290'),
          toBN('300'),
        );

        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL);
        expect(balance).to.eq(toBN('1'));
        await fastForward(HOUR_SEC);
        const quotePreBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // closing the position
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('290'),
          toBN('500'),
        );

        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        expect(assertCloseTo(postBalance.sub(quotePreBalance), toBN('-338.054140878690005699')));
      });
    });
    // In the money(for the client). Therefore gain.
    describe('closing short put (non slip)', async () => {
      it('closing short put', async () => {
        await c.optionMarketSafeSlippage.openPosition(
          listingIds[0],
          TradeType.SHORT_PUT,
          toBN('1'),
          toBN('1'),
          toBN('50'),
        );

        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT);
        expect(balance).to.eq(toBN('1'));
        await fastForward(HOUR_SEC);
        const quotePreBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // closing the position
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.SHORT_PUT,
          toBN('1'),
          toBN('1'),
          toBN('150'),
        );

        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // #tothemoon
        expect(assertCloseTo(postBalance.sub(quotePreBalance), toBN('1417.939615487810872505')));
      });
    });
  });

  describe('opening positions (Slippage tests)', async () => {
    describe('long call slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const bal = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('300'), toBN('350'));

        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(bal.add(toBN('1')));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.002'));
      });

      it('revert same trade, slippage expected', async () => {
        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('300'), toBN('350')),
        ).revertedWith('ERC20: transfer amount exceeds balance');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const bal = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('300'), toBN('350'));

        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(bal.add(toBN('1')));
      });
    });

    describe('long put slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.002'));
      });

      it('revert same trade, slippage expected', async () => {
        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85')),
        ).revertedWith('ERC20: transfer amount exceeds balance');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));
      });
    });

    describe('short call slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'), toBN('290'), toBN('300'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('0.998'));
      });

      it('revert same trade, slippage expected', async () => {
        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'), toBN('290'), toBN('300')),
        ).revertedWith('Total cost outside specified bounds');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'), toBN('290'), toBN('300'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));
      });
    });

    describe('short puts slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('0.998'));
      });

      it('revert same trade, slippage expected', async () => {
        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50')),
        ).revertedWith('Total cost outside specified bounds');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));
      });
    });
  });

  describe('closing positions (Slippage tests)', async () => {
    describe('long call slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const bal = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('300'), toBN('350'));

        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(bal.add(toBN('1')));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.002'));

        // Close positions
        await fastForward(HOUR_SEC);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('200'),
          toBN('350'),
        );
        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        assertCloseTo(postBalance.sub(preBalance), toBN('296.9727118'));
      });

      it('revert same trade, slippage expected', async () => {
        // open position first
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('300'), toBN('350'));

        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        // try to close position
        await fastForward(HOUR_SEC);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'), toBN('300'), toBN('308')),
        ).revertedWith('Total cost outside specified bounds');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.LONG_CALL,
          toBN('1'),
          toBN('200'),
          toBN('350'),
        );
        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        assertCloseTo(postBalance.sub(preBalance), toBN('296.9727118'));
      });
    });

    describe('long put slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.002'));

        // Close positions
        await fastForward(HOUR_SEC);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.LONG_PUT,
          toBN('1'),
          toBN('45'),
          toBN('50'),
        );
        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        assertCloseTo(postBalance.sub(preBalance), toBN('45.940193'));
      });

      it('revert same trade, slippage expected', async () => {
        // open position first
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85'));

        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        // try to close position
        await fastForward(HOUR_SEC);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'), toBN('80'), toBN('85')),
        ).revertedWith('Total cost outside specified bounds');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.LONG_PUT,
          toBN('1'),
          toBN('45'),
          toBN('50'),
        );
        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        assertCloseTo(postBalance.sub(preBalance), toBN('45.940193'));
      });
    });

    describe('short call slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        //const bal = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT);
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'), toBN('250'), toBN('300'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('0.998'));

        // Close positions
        await fastForward(HOUR_SEC);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('300'),
          toBN('350'),
        );

        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        assertCloseTo(postBalance.sub(preBalance), toBN('-338.054'));
      });

      it('revert same trade, slippage expected', async () => {
        // open position first
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'), toBN('250'), toBN('300'));

        // SetIV from 1 -> 1.1 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        // try to close position
        await fastForward(HOUR_SEC);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'), toBN('300'), toBN('350')),
        ).revertedWith('ERC20: transfer amount exceeds balance');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('300'),
          toBN('350'),
        );
        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // going to be off by .2%
        assertCloseTo(postBalance.sub(preBalance), toBN('-338.054'));
      });
    });

    describe('short put slippage (cause slippage)', async () => {
      it('set IV and change it with a trade', async () => {
        // Set IV to 1
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50'));

        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));

        // Check the IV has changed
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('0.998'));

        // Close positions
        await fastForward(HOUR_SEC);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.SHORT_PUT,
          toBN('1'),
          toBN('80'),
          toBN('95'),
        );

        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        assertCloseTo(postBalance.sub(preBalance), toBN('1417.93'));
      });

      it('revert same trade, slippage expected', async () => {
        // open position first
        await c.optionMarketSafeSlippage
          .connect(account)
          .openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'), toBN('45'), toBN('50'));

        // SetIV from 1 -> 1.2 to cause slippage (change in premium cost)
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1.1'));
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('1.1'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('1.1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        // try to close position
        await fastForward(HOUR_SEC);

        await expect(
          c.optionMarketSafeSlippage
            .connect(account)
            .closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'), toBN('80'), toBN('95')),
        ).revertedWith('Total cost outside specified bounds');

        // Set IV back to 1 - trade goes through
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('1'));
        await c.optionMarket.setBoardFrozen(boardId, false);

        const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
        await c.optionMarketSafeSlippage.closePosition(
          listingIds[0],
          TradeType.SHORT_PUT,
          toBN('1'),
          toBN('80'),
          toBN('95'),
        );
        const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
        // going to be off by .2%
        assertCloseTo(postBalance.sub(preBalance), toBN('1417.93'));
      });
    });
  }); // Closing positions
});
