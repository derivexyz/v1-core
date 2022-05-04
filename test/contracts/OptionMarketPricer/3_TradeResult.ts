describe('getTradeResult', async () => {
  it.skip('if amount == 0, return 0');
  it.skip('adds fee to premium if isBuy == true');
  it.skip('subtracts fee from premium if isBuy == false');
  it.skip('if isBuy == false and fee > premium, return 0');
  it.skip('returns twap vol for volTraded when force closed with twap');

  it.skip('if amount is 0, charge 0 fees regardless of other parameters');

  it.skip('adds a spot price fee if vegautil and optionPrice are both 0');
  it.skip('adds a vega util fee if spotPrice and optionPrice are both 0');
  it.skip('adds a optionPrice fee if spotPrice and vega util are both 0');
});
