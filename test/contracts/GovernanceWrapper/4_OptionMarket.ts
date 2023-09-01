import { DEFAULT_GOV_OPTION_MARKET_BOUNDS } from '../../utils/defaultParams';
import { currentTime, MAX_UINT, MONTH_SEC, toBN, toBN18 } from '../../../scripts/util/web3utils';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { OptionMarketParametersStruct } from '../../../typechain-types/OptionMarketGovernanceWrapper';

describe('OptionMarketGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  let boards: BigNumber[];

  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.optionMarketGov.setRiskCouncil(RC.address);
    await govWrap.optionMarketGov.setOptionMarketBounds(DEFAULT_GOV_OPTION_MARKET_BOUNDS);
    boards = await hre.f.gc.optionMarket.getLiveBoards();
  });

  ///////////
  // Admin //
  ///////////

  it('should be able to set risk council', async () => {
    expect(await govWrap.optionMarketGov.riskCouncil()).eq(hre.f.alice.address);
  });

  it('should NOT be able to set option market again', async () => {
    await expect(govWrap.optionMarketGov.setOptionMarket(hre.f.gc.optionMarket.address)).revertedWith(
      'OMGW_OptionMarketAlreadySet',
    );
  });

  it('should be able to set board manager', async () => {
    await govWrap.optionMarketGov.setBoardManager(hre.f.alice.address);
    expect(await govWrap.optionMarketGov.boardManager()).eq(hre.f.alice.address);
  });

  it('should be able to forceChangeOwner', async () => {
    expect(await hre.f.gc.optionMarket.owner()).eq(govWrap.optionMarketGov.address);
    await govWrap.optionMarketGov.forceChangeOwner(await govWrap.optionMarketGov.optionMarket(), RC.address);
    expect(await hre.f.gc.optionMarket.owner()).eq(govWrap.optionMarketGov.address);
    expect(await hre.f.gc.optionMarket.nominatedOwner()).eq(RC.address);
    await hre.f.gc.optionMarket.connect(RC).acceptOwnership();
    expect(await hre.f.gc.optionMarket.owner()).eq(RC.address);
  });

  it('should be able to create option board', async () => {
    const expiry = (await currentTime()) + MONTH_SEC;
    const baseIv = toBN('1.15');
    const strikePrices = ['1000', '1500', '2000', '2500', '3000'].map(toBN18);
    const skews = ['1', '1', '1', '1', '1'].map(toBN18);
    await govWrap.optionMarketGov.createOptionBoard(expiry, baseIv, strikePrices, skews, false);

    const board = await hre.f.gc.optionMarket.getOptionBoard(2);
    expect(board.iv).eq(baseIv);
  });

  it('should be able to add strike to option board', async () => {
    const strikePrice = toBN('1150');
    const skew = toBN('1.15');
    let board = await hre.f.gc.optionMarket.getOptionBoard(1);
    expect(board.strikeIds.length).eq(3);

    // Add 1 strike to the current 3 strikes
    await govWrap.optionMarketGov.addStrikeToBoard(1, strikePrice, skew);
    board = await hre.f.gc.optionMarket.getOptionBoard(1);
    expect(board.strikeIds.length).eq(4);

    await expect(govWrap.optionMarketGov.connect(hre.f.alice).addStrikeToBoard(1, strikePrice, skew)).revertedWith(
      'OMGW_OnlyOwnerOrBoardManager',
    );
  });

  it('should be able to recover funds', async () => {
    await govWrap.optionMarketGov.setOptionMarketBounds({
      ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
      recoverFundsBlocked: true,
    });

    // Mint some ERC20 to OM
    const LYRA = await (
      await ethers.getContractFactory('TestERC20SetDecimalsFail', hre.f.deployer)
    ).deploy('LYRA', 'LYRA', 18);
    const amount = ethers.utils.parseUnits('100', 18);
    await LYRA.mint(hre.f.gc.optionMarket.address, amount);

    // Try to recover funds blocked funds
    await expect(govWrap.optionMarketGov.recoverOMFunds(LYRA.address, hre.f.alice.address)).revertedWith(
      'OMGW_RecoverFundsBlocked',
    );

    // Unlbock and try again
    await govWrap.optionMarketGov.setOptionMarketBounds({
      ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
      recoverFundsBlocked: false,
    });

    await govWrap.optionMarketGov.recoverOMFunds(LYRA.address, hre.f.alice.address);

    // Expect funds to be recovered
    const balance = await LYRA.balanceOf(hre.f.alice.address);
    expect(balance).to.equal(amount);
  });
  ////////////
  // Params //
  ////////////

  it('can set board frozen', async () => {
    await govWrap.optionMarketGov.setOptionMarketBounds({
      ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
      boardFreezingBlocked: true,
    });

    await govWrap.optionMarketGov.setBoardFrozen(boards[0], true);

    // reverts when risk council tries to set forzen but its blocked
    await expect(govWrap.optionMarketGov.connect(RC).setBoardFrozen(boards[0], true)).to.be.revertedWith(
      'OMGW_BoardFreezingIsBlocked',
    );
  });

  it('can set board base iv', async () => {
    await govWrap.optionMarketGov.setOptionMarketBounds({
      ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
      boardFreezingBlocked: true,
      minBaseIv: toBN('0.01'),
      maxBaseIv: toBN('10'),
    });

    await govWrap.optionMarketGov.setBoardFrozen(boards[0], true);

    await govWrap.optionMarketGov.setBoardBaseIv(boards[0], 100);

    await govWrap.optionMarketGov.connect(RC).setBoardBaseIv(boards[0], toBN('0.1'));
    const board = await hre.f.gc.optionMarket.getOptionBoard(1);
    expect(board.iv).eq(toBN('0.1'));

    // reverts
    await expect(govWrap.optionMarketGov.connect(RC).setBoardBaseIv(boards[0], 0)).to.be.revertedWith(
      'OMGW_BaseIVOutOfBounds',
    );
    await expect(hre.f.gc.optionMarket.connect(RC).setBoardBaseIv(boards[0], 100)).to.be.revertedWith('OnlyOwner');
  });

  it('can set strike skew, reverts when rc out of bounds', async () => {
    await govWrap.optionMarketGov.setOptionMarketBounds({
      ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
      boardFreezingBlocked: true,
      minSkew: toBN('0.01'),
      maxSkew: toBN('10'),
    });

    // freeze board
    await govWrap.optionMarketGov.setBoardFrozen(boards[0], true);

    const strikes = await hre.f.gc.optionMarket.getBoardStrikes(boards[0]);

    await govWrap.optionMarketGov.setStrikeSkew(strikes[0], toBN('100'));

    await govWrap.optionMarketGov.connect(RC).setStrikeSkew(strikes[0], toBN('1'));

    // graeter than
    await expect(govWrap.optionMarketGov.connect(RC).setStrikeSkew(strikes[0], toBN('100'))).to.be.revertedWith(
      'OMGW_SkewOutOfBounds',
    );

    // less than
    await expect(govWrap.optionMarketGov.connect(RC).setStrikeSkew(strikes[0], toBN('0.00001'))).to.be.revertedWith(
      'OMGW_SkewOutOfBounds',
    );
  });

  it('can force settle board, reverts when rc boarding settling blocked', async () => {
    await govWrap.optionMarketGov.setBoardFrozen(boards[0], true);

    await expect(govWrap.optionMarketGov.forceSettleBoard(boards[0])).to.be.revertedWith(
      'OMGW_BoardForceSettlingIsBlocked',
    );

    // set governance defaults to allow force setteling
    await govWrap.optionMarketGov.setOptionMarketBounds({
      ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
      boardForceSettlingBlocked: false,
    });

    await govWrap.optionMarketGov.forceSettleBoard(boards[0]);
  });

  it('can set option market params', async () => {
    const params = {
      securityModule: hre.f.deployer.address,
      feePortionReserved: toBN('1'),
      maxBoardExpiry: MONTH_SEC * 12,
      staticBaseSettlementFee: toBN('0.1'),
      baseLimit: MAX_UINT,
    } as OptionMarketParametersStruct;

    await govWrap.optionMarketGov.setOptionMarketParams(params);
    compareStruct(await hre.f.gc.optionMarket.getOptionMarketParams(), params);
  });

  it('can set option market base limit', async () => {
    await govWrap.optionMarketGov.setOptionMarketBaseLimit(toBN('100'));
    expect(await hre.f.gc.optionMarket.baseLimit()).eq(toBN('100'));
  });

  it('risk council cannot set option market base limit', async () => {
    await expect(govWrap.optionMarketGov.connect(RC).setOptionMarketBaseLimit(toBN('100'))).to.be.revertedWith(
      'OMGW_BaseLimitInvalid',
    );
  });
  
  it('risk council can only set base limit to zero', async() => {
    await expect(govWrap.optionMarketGov.connect(RC).setOptionMarketBaseLimit(toBN('100'))).to.be.revertedWith(
      'OMGW_BaseLimitInvalid',
    );
    
    await expect(govWrap.optionMarketGov.connect(RC).setOptionMarketBaseLimit(toBN('0'))).to.not.be.reverted;
  });

  it('Should revert with option market bound is not set to true', async () => {
    await govWrap.optionMarketGov.setOptionMarketBounds(
      {
        ...DEFAULT_GOV_OPTION_MARKET_BOUNDS,
        canZeroBaseLimit: false
      }
    );

    await expect(govWrap.optionMarketGov.connect(RC).setOptionMarketBaseLimit(toBN('0'))).to.be.revertedWith(
      'OMGW_BaseLimitInvalid',
    );
  });
  it('should be able to get option market bounds', async () => {
    compareStruct(await govWrap.optionMarketGov.getOptionMarketBounds(), DEFAULT_GOV_OPTION_MARKET_BOUNDS);
  });
});
