import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import * as _ from 'lodash';
import { getEventArgs, OptionType, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { ShortCollateral } from '../../../typechain-types';
import { DEFAULT_SECURITY_MODULE } from '../../utils/defaultParams';
import {
  deployGlobalTestContracts,
  deployMarketTestContracts,
  initGlobalTestSystem,
  initMarketTestSystem,
  TestSystemContractsType,
} from '../../utils/deployTestSystem';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { expect } from '../../utils/testSetup';

describe('Collateral transfer', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
    const shortCollateralOverride = (await (await ethers.getContractFactory('ShortCollateral'))
      .connect(deployer)
      .deploy()) as ShortCollateral;

    const globalSystem = await deployGlobalTestContracts(deployer, false, {});
    const marketSystem = await deployMarketTestContracts(globalSystem, deployer, 'sETH', false, {});
    c = _.merge(globalSystem, marketSystem);

    await initGlobalTestSystem(c, deployer, {});
    await initMarketTestSystem('sETH', c, marketSystem, deployer, { shortCollateral: shortCollateralOverride.address });

    c.shortCollateral = shortCollateralOverride;
    await c.shortCollateral.init(
      deployer.address,
      c.liquidityPool.address,
      c.optionToken.address,
      c.synthetixAdapter.address,
      c.snx.quoteAsset.address,
      c.snx.baseAsset.address,
    );

    await c.synthetixAdapter.setGlobalsForContract(
      deployer.address,
      toBytes32('sUSD'),
      toBytes32('sETH'),
      DEFAULT_SECURITY_MODULE,
      toBytes32(''),
    );
    await c.snx.quoteAsset.mint(c.shortCollateral.address, toBN('100'));
    await c.snx.baseAsset.mint(c.shortCollateral.address, toBN('1'));
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('should not allow init twice', async () => {
      await expect(
        c.shortCollateral.init(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS),
      ).revertedWith('AlreadyInitialised');
    });

    it('only owner can initialize', async () => {
      await expect(
        c.shortCollateral
          .connect(alice)
          .init(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS),
      ).revertedWith('OnlyOwner');
    });
  });

  describe('sendQuoteCollateral', async () => {
    it('reverts if amount > balance', async () => {
      await expect(c.shortCollateral.sendQuoteCollateral(deployer.address, toBN('110'))).revertedWith(
        'OutOfQuoteCollateralForTransfer',
      );
    });
    it('reverts if transfer fails', async () => {
      await c.snx.quoteAsset.setForceFail(true);
      await expect(c.shortCollateral.sendQuoteCollateral(deployer.address, toBN('100'))).revertedWith(
        'QuoteTransferFailed',
      );
    });
  });

  describe('sendBaseCollateral', async () => {
    it('sends balance is amount > balance', async () => {
      await expect(c.shortCollateral.sendBaseCollateral(deployer.address, toBN('1.1'))).revertedWith(
        'OutOfBaseCollateralForTransfer',
      );
    });
    it('reverts if transfer fails', async () => {
      await c.snx.baseAsset.setForceFail(true);
      await expect(c.shortCollateral.sendBaseCollateral(deployer.address, toBN('1'))).revertedWith(
        'BaseTransferFailed',
      );
    });
  });

  describe('routeLiquidationFunds', async () => {
    it('base liquidation', async () => {
      await c.shortCollateral.routeLiquidationFunds(alice.address, deployer.address, OptionType.SHORT_CALL_BASE, {
        insolventAmount: 0,
        liquidatorFee: toBN('0.1'),
        lpFee: toBN('0.1'),
        lpPremiums: toBN('0.1'),
        returnCollateral: toBN('0.3'),
        smFee: toBN('0'),
      });
    });

    it('reverts for various reasons', async () => {
      await c.snx.quoteAsset.setForceFail(true);
      await expect(
        c.shortCollateral.routeLiquidationFunds(alice.address, deployer.address, OptionType.SHORT_CALL_BASE, {
          insolventAmount: 0,
          liquidatorFee: toBN('0.1'),
          lpFee: toBN('0.1'),
          lpPremiums: toBN('0.1'),
          returnCollateral: toBN('0.3'),
          smFee: toBN('0'),
        }),
      ).revertedWith('QuoteTransferFailed');
      await c.snx.quoteAsset.setForceFail(false);
      await expect(
        c.shortCollateral.routeLiquidationFunds(alice.address, deployer.address, OptionType.SHORT_CALL_BASE, {
          insolventAmount: 0,
          liquidatorFee: toBN('0.1'),
          lpFee: toBN('0.1'),
          lpPremiums: toBN('1'),
          returnCollateral: toBN('0.3'),
          smFee: toBN('0'),
        }),
      ).revertedWith('OutOfBaseCollateralForExchangeAndTransfer');
    });
  });

  describe('boardSettlement', async () => {
    it('sends balance even if amount > balance', async () => {
      const tx = await c.shortCollateral.boardSettlement(toBN('1.1'), toBN('110'));
      expect(getEventArgs(await tx.wait(), 'BaseSent').amount).eq(toBN('1'));
      expect(getEventArgs(await tx.wait(), 'QuoteSent').amount).eq(toBN('100'));
      expect(await c.shortCollateral.LPBaseExcess()).eq(toBN('0.1'));
      expect(await c.shortCollateral.LPQuoteExcess()).eq(toBN('10'));
    });
    it('reverts if quote transfer fails', async () => {
      await c.snx.quoteAsset.setForceFail(true);
      await expect(c.shortCollateral.boardSettlement(toBN('1.1'), toBN('110'))).revertedWith('QuoteTransferFailed');
    });
    it('reverts if base transfer fails', async () => {
      await c.snx.baseAsset.setForceFail(true);
      await expect(c.shortCollateral.boardSettlement(toBN('1.1'), toBN('110'))).revertedWith('BaseTransferFailed');
    });
  });
});
