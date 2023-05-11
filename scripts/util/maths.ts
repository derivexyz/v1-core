import { BigNumber } from "ethers";
import { toBN } from "./web3utils";

export function convertPriceE18ToSqrtX96(rawPrice: BigNumber) {
  const sqrtX96Price = sqrt(rawPrice.mul(BigNumber.from(2).pow(96 * 2)).div(toBN('1')));
  return sqrtX96Price;
}

function sqrt(x: BigNumber) {
  let z = x.add(1).div(2);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(2);
  }

  return y;
}