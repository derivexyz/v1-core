import fse from 'fs-extra';
import { deleteRecursive } from './parseFiles';

// Moving artifacts from root to dist/ for transpiled deploy scripts in @lyrafinance/protocol

async function main() {
  if (fse.existsSync('dist/artifacts')) {
    deleteRecursive('dist/artifacts');
  }
  fse.mkdirSync('dist/artifacts');

  try {
    fse.copySync('artifacts', 'dist/artifacts', { overwrite: true });
    console.log('Success - artifacts copied!');
  } catch (err) {
    console.error(err);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
