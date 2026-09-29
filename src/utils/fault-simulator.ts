const INVERSE_CURVE_EXPONENT = 0.02;
const STANDARD_INVERSE_CONSTANT = 0.14;
const REFERENCE_MULTIPLE = 7.2;

export interface ThermalRelayStep {
  accumulatedSeconds: number;
  tripAfterSeconds: number;
  tripped: boolean;
}

export function calculateThermalTripSeconds(
  currentMultiple: number,
  relayPickupMultiple = 1.05,
  relayClassSeconds = 10,
): number {
  const multipleOfPickup = currentMultiple / relayPickupMultiple;
  if (multipleOfPickup <= 1) return Number.POSITIVE_INFINITY;

  const referenceTime = STANDARD_INVERSE_CONSTANT / (REFERENCE_MULTIPLE ** INVERSE_CURVE_EXPONENT - 1);
  const operatingTime = STANDARD_INVERSE_CONSTANT / (multipleOfPickup ** INVERSE_CURVE_EXPONENT - 1);
  return relayClassSeconds * operatingTime / referenceTime;
}

export function stepThermalRelay(
  current: number,
  nominalCurrent: number,
  relayClassSeconds: number,
  accumulatedSeconds: number,
  dtSeconds: number,
  pickupMultiple = 1.05,
): ThermalRelayStep {
  const pickupCurrent = nominalCurrent * pickupMultiple;
  const nextAccumulated = current > pickupCurrent
    ? accumulatedSeconds + dtSeconds
    : Math.max(0, accumulatedSeconds - dtSeconds * 0.04);
  const tripAfterSeconds = calculateThermalTripSeconds(current / nominalCurrent, pickupMultiple, relayClassSeconds);
  return {
    accumulatedSeconds: nextAccumulated,
    tripAfterSeconds,
    tripped: nextAccumulated >= tripAfterSeconds,
  };
}

export function checkInstantaneousShortCircuit(current: number, nominalCurrent: number, tripMultiple = 10): boolean {
  return current >= nominalCurrent * tripMultiple;
}