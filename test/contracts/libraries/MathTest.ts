import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { fromBN, toBN } from '../../../scripts/util/web3utils';
import { MathTest } from '../../../typechain-types';
describe('Oracle - unit test', async () => {
  let deployer: Signer;
  let math: MathTest;

  before(async () => {
    [deployer] = await ethers.getSigners();

    math = (await (await ethers.getContractFactory('MathTest')).connect(deployer).deploy()) as MathTest;
  });

  it('compares accuracy and gas cost of ln', async () => {
    const lnTests = [0.0000001, 1, 5, 10, 1000, 7314, 1423512.512335216];
    for (const i of lnTests) {
      const jsVersion = Math.log(i);
      const bnTest = toBN(i.toString());

      const newVal = parseFloat(fromBN(await math.lnV1(bnTest)));
      const oldVal = parseFloat(fromBN(await math.lnV2(bnTest)));
      const newGas = (await math.estimateGas.lnV1(bnTest)).toString();
      const oldGas = (await math.estimateGas.lnV2(bnTest)).toString();

      console.log(`ln(${i}) = ${jsVersion}`);
      console.log(`new: ${newVal} diff: ${((newVal - jsVersion) / jsVersion) * 100}% gas: ${newGas}`);
      console.log(`old: ${oldVal} diff: ${((oldVal - jsVersion) / jsVersion) * 100}% gas: ${oldGas}`);
      console.log();
    }
  });

  it('compares accuracy and gas cost of exp', async () => {
    const expTests = [
      -40.1345, -20.1234, -10.881325, -2.7521, -1, 0, 1, 2.7521, 10.881325, 20.1324, 40.1345, 60.16999, 99.333,
    ];
    for (const i of expTests) {
      const jsVersion = Math.exp(i);
      const bnTest = toBN(i.toString());
      const newVal = parseFloat(fromBN(await math.expV1(bnTest)));
      const oldVal = parseFloat(fromBN(await math.expV2(bnTest)));
      const newGas = (await math.estimateGas.expV1(bnTest)).toString();
      const oldGas = (await math.estimateGas.expV2(bnTest)).toString();

      console.log(`exp(${i}) = ${jsVersion}`);
      console.log(`new: ${newVal} diff: ${((newVal - jsVersion) / jsVersion) * 100}% gas: ${newGas}`);
      console.log(`old: ${oldVal} diff: ${((oldVal - jsVersion) / jsVersion) * 100}% gas: ${oldGas}`);
      console.log();
    }
  });
});
