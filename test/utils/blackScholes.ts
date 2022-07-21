import { erf } from 'mathjs';

export function stdNormalCDF(x: number): number {
  return (1.0 - erf(-x / Math.sqrt(2))) / 2.0;
}

export function stdNormal(x: number): number {
  return Math.exp((-x * x) / 2.0) / Math.sqrt(2.0 * Math.PI);
}

export function d1(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return (Math.log(spot / strikePrice) + (rate + (vol * vol) / 2.0) * tAnnualised) / (vol * Math.sqrt(tAnnualised));
}

export function d2(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return d1(tAnnualised, vol, spot, strikePrice, rate) - vol * Math.sqrt(tAnnualised);
}

export function PV(value: number, rate: number, tAnnualised: number): number {
  return value * Math.exp(-rate * tAnnualised);
}

export function callPrice(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return (
    stdNormalCDF(d1(tAnnualised, vol, spot, strikePrice, rate)) * spot -
    stdNormalCDF(d2(tAnnualised, vol, spot, strikePrice, rate)) * PV(strikePrice, rate, tAnnualised)
  );
}

export function putPrice(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return (
    stdNormalCDF(-d2(tAnnualised, vol, spot, strikePrice, rate)) * PV(strikePrice, rate, tAnnualised) -
    stdNormalCDF(-d1(tAnnualised, vol, spot, strikePrice, rate)) * spot
  );
}

export function optionPrices(
  tAnnualised: number,
  vol: number,
  spot: number,
  strikePrice: number,
  rate: number,
): [number, number] {
  return [callPrice(tAnnualised, vol, spot, strikePrice, rate), putPrice(tAnnualised, vol, spot, strikePrice, rate)];
}

export function callDelta(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return stdNormalCDF(d1(tAnnualised, vol, spot, strikePrice, rate));
}

export function putDelta(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return callDelta(tAnnualised, vol, spot, strikePrice, rate) - 1.0;
}

export function vega(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  return spot * stdNormal(d1(tAnnualised, vol, spot, strikePrice, rate)) * Math.sqrt(tAnnualised);
}

export function stdVega(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number): number {
  const minStandardisation = 7 / 365;
  const daysToExpiry = Math.floor((tAnnualised < minStandardisation ? minStandardisation : tAnnualised) * 365);
  const normalisationFactor = Math.sqrt(30 / daysToExpiry) / 100;

  return vega(tAnnualised, vol, spot, strikePrice, rate) * normalisationFactor;
}

export function gamma(tAnnualised: number, vol: number, spot: number, strikePrice: number, rate: number) {
  return stdNormal(d1(tAnnualised, vol, spot, strikePrice, rate)) / (spot * vol * Math.sqrt(tAnnualised));
}

export function theta(
  tAnnualized: number,
  vol: number,
  spot: number,
  strikePrice: number,
  rate: number,
  isCall: boolean,
) {
  if (isCall) {
    return (
      (-spot * stdNormal(d1(tAnnualized, vol, spot, strikePrice, rate)) * vol) / (2 * Math.sqrt(tAnnualized)) -
      rate * strikePrice * Math.exp(-rate * tAnnualized) * stdNormalCDF(d2(tAnnualized, vol, spot, strikePrice, rate))
    );
  } else {
    return (
      (-spot * stdNormal(d1(tAnnualized, vol, spot, strikePrice, rate)) * vol) / (2 * Math.sqrt(tAnnualized)) +
      rate * strikePrice * Math.exp(-rate * tAnnualized) * stdNormalCDF(-d2(tAnnualized, vol, spot, strikePrice, rate))
    );
  }
}

export function rho(
  tAnnualised: number,
  vol: number,
  spot: number,
  strikePrice: number,
  rate: number,
  isCall: boolean,
) {
  if (isCall) {
    return (
      strikePrice *
      tAnnualised *
      Math.exp(-rate * tAnnualised) *
      stdNormalCDF(d2(tAnnualised, vol, spot, strikePrice, rate))
    );
  } else {
    return (
      -strikePrice *
      tAnnualised *
      Math.exp(-rate * tAnnualised) *
      stdNormalCDF(-d2(tAnnualised, vol, spot, strikePrice, rate))
    );
  }
}
