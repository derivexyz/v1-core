import fse from 'fs-extra';
import { deleteRecursive } from './parseFiles';

// Moving artifacts from root to dist/ for transpiled deploy scripts in @lyrafinance/core

if (!fse.existsSync('dist/artifacts')) {
  fse.mkdirSync('dist/artifacts');
}

try {
  fse.copySync('artifacts', 'dist/artifacts', { overwrite: true });
  console.log('Success - artifacts copied!');
} catch (err) {
  console.error(err);
}

if (fse.existsSync('dist/deployments')) {
  deleteRecursive('dist/deployments');
}

fse.mkdirSync('dist/deployments');
fse.mkdirSync('dist/deployments/kovan-ovm');

try {
  fse.copySync('deployments/kovan-ovm/deployment.json', 'dist/deployments/kovan-ovm/deployment.json', {
    overwrite: true,
  });
  console.log('Success - deployments copied!');
} catch (err) {
  console.error(err);
}
