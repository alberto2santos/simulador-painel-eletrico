import { describe, expect, it } from 'vitest';
import { calculateThermalTripSeconds, checkInstantaneousShortCircuit, stepThermalRelay } from './fault-simulator';

describe('proteções do motor', () => {
  it('desarma mais rápido em 6× do que em 1,2× para classe 10', () => {
    const moderateOverload = calculateThermalTripSeconds(1.2, 1.05, 10);
    const severeOverload = calculateThermalTripSeconds(6, 1.05, 10);
    expect(moderateOverload).toBeGreaterThan(60);
    expect(severeOverload).toBeLessThan(20);
    expect(severeOverload).toBeLessThan(moderateOverload);
  });

  it('acumula aquecimento durante sobrecarga e resfria quando a corrente cai', () => {
    const warm = stepThermalRelay(30, 21, 10, 2, 0.5);
    const cooling = stepThermalRelay(20, 21, 10, warm.accumulatedSeconds, 0.5);
    expect(warm.accumulatedSeconds).toBe(2.5);
    expect(warm.tripped).toBe(false);
    expect(cooling.accumulatedSeconds).toBeLessThan(warm.accumulatedSeconds);
  });

  it('dispara a proteção magnética instantânea em 10× nominal', () => {
    expect(checkInstantaneousShortCircuit(210, 21)).toBe(true);
    expect(checkInstantaneousShortCircuit(209, 21)).toBe(false);
  });

});