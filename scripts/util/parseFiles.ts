/* tslint:disable */
/* eslint-disable */
import path from 'path';
import { Params } from './index';

export function loadLyraContractData(deploymentParams: Params, name: string, market?: string) {
  const filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'lyra.json');
  const data = require(filePath);
  try {
    if (market) {
      return {
        target: data.targets.markets[market][name],
        source: data.sources[data.targets.markets[market][name].source],
      };
    }
    return {
      target: data.targets[name],
      source: data.sources[data.targets[name].source],
    };
  } catch (e) {
    console.log({ filePath, name, market, deploymentParams });
    throw e;
  }
}

export function loadLyraContractDeploymentBlock(deploymentParams: Params, name: string, market?: string) {
  const filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'lyra.json');
  const data = require(filePath);
  try {
    if (market) {
      return data.targets.markets[market][name].blockNumber;
    }
    return data.targets[name].blockNumber;
  } catch (e) {
    console.log({ filePath, name, market, deploymentParams });
    throw e;
  }
}

export function loadSynthetixContractData(params: Params, name: string) {
  let filePath;
  if (params.network === 'mainnet-ovm' || ['Exchanger', 'ExchangeRates'].includes(name)) {
    filePath = path.join(__dirname, '../../deployments', params.network, 'synthetix.json');
  } else {
    filePath = path.join(__dirname, '../../deployments', params.network, 'synthetix.mocked.json');
  }
  const data = require(filePath);
  try {
    const source = data.targets[name].source;
    return {
      target: data.targets[name],
      // Treat proxy as Synth
      source: data.sources[source == 'ProxyERC20' ? 'Synth' : data.targets[name].source],
    };
  } catch (e) {
    console.log({ filePath, name, params });
    throw e;
  }
}
/* tslint:enable */
/* eslint-enable */
