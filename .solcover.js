module.exports = {
  // skipFiles: ['./test-helpers', './periphery', './synthetix', './openzeppelin-l2', 'interfaces'],
  skipFiles: [
    './test-helpers',
    './synthetix',
    './openzeppelin-l2',
    './contracts/periphery/Wrapper/BasicOptionMarketWrapper.sol',
    './contracts/periphery/BasicFeeCounter.sol',
    './contracts/periphery/BasicLiquidityCounter.sol',
    'interfaces',
  ],
  configureYulOptimizer: true,
};
