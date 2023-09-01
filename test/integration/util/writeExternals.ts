import fs from 'fs';
import path from 'path';
import * as externals from './externals.json';

export function writeExternalsSync() {
  // TODO: uniswap, curve
  fs.writeFileSync(
    path.join(__dirname, '../../..', '.cannon-deployment', 'UniSwapRouter.json'),
    JSON.stringify(externals.UniSwapRouter),
  );
  fs.writeFileSync(path.join(__dirname, '../../..', '.cannon-deployment', 'USDC.json'), JSON.stringify(externals.USDC));
  fs.writeFileSync(path.join(__dirname, '../../..', '.cannon-deployment', 'wETH.json'), JSON.stringify(externals.WETH));
  fs.writeFileSync(
    path.join(__dirname, '../../..', '.cannon-deployment', 'CurveRegistry.json'),
    JSON.stringify(externals.CurveRegistry),
  );
}
