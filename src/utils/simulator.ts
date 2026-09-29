import type { LoadProfile, LoadProfileId, MotorParameters } from '../types/simulator';
import { estimateStarTransitionPeakRatio } from '../engine/step';

export const MOTOR_PARAMS: MotorParameters = {
  id: 'weg-w22-11',
  model: 'WEG W22',
  powerLabel: '11 kW · 15 CV',
  nominalCurrent: 21,
  nominalPower: 11,
  voltage: 380,
  inertiaKgM2: 0.04,
  frequencyHz: 60,
  directPeakRatio: 7,
  starPeakRatio: 2.5,
  rampUpTime: 2000,
  starToTriTime: 3000,
};

// Valores aproximados para comparação didática, não para dimensionamento real.
export const MOTOR_OPTIONS: MotorParameters[] = [
  { ...MOTOR_PARAMS, id: 'weg-w22-5-5', powerLabel: '5,5 kW · 7,5 CV', nominalCurrent: 11.5, nominalPower: 5.5, inertiaKgM2: 0.02 },
  MOTOR_PARAMS,
  { ...MOTOR_PARAMS, id: 'weg-w22-22', powerLabel: '22 kW · 30 CV', nominalCurrent: 42, nominalPower: 22, inertiaKgM2: 0.08 },
];

export const LOAD_PROFILES: Record<LoadProfileId, LoadProfile> = {
  pump: { id: 'pump', label: 'Bomba centrífuga', inertiaMultiplier: 1, currentMultiplier: 1.08, torqueMultiplier: 1.05 },
  fan: { id: 'fan', label: 'Ventilador', inertiaMultiplier: 1.15, currentMultiplier: 0.84, torqueMultiplier: 0.78 },
  conveyor: { id: 'conveyor', label: 'Esteira transportadora', inertiaMultiplier: 1.35, currentMultiplier: 1.12, torqueMultiplier: 1.2 },
  'high-inertia': { id: 'high-inertia', label: 'Carga de alta inércia', inertiaMultiplier: 2.4, currentMultiplier: 1.28, torqueMultiplier: 1.4 },
};

const NOMINAL_LOAD: LoadProfile = { id: 'pump', label: 'Carga nominal', inertiaMultiplier: 1, currentMultiplier: 1, torqueMultiplier: 1 };

export function generateDirectStartCurve(
  points = 60,
  motor: MotorParameters = MOTOR_PARAMS,
  random: () => number = Math.random,
  load: LoadProfile = NOMINAL_LOAD,
): number[] {
  const peak = motor.nominalCurrent * motor.directPeakRatio * load.currentMultiplier;
  return Array.from({ length: points }, (_, index) => {
    const time = index / points;
    if (time < 0.05) return Number((peak * (time / 0.05)).toFixed(2));
    if (time < 0.15) {
      const decay = 1 - ((time - 0.05) / 0.1) * 0.65;
      return Number((peak * decay + (random() - 0.5) * 8).toFixed(2));
    }
    if (time < 0.35) {
      const progress = (time - 0.15) / 0.2;
      const steadyCurrent = motor.nominalCurrent * load.currentMultiplier;
      return Number((peak * 0.35 - (peak * 0.35 - steadyCurrent) * progress + (random() - 0.5) * 3).toFixed(2));
    }
    return Number((motor.nominalCurrent * load.currentMultiplier + (random() - 0.5) * 1.5).toFixed(2));
  });
}

export function generateStarTriangleCurve(
  points = 60,
  motor: MotorParameters = MOTOR_PARAMS,
  random: () => number = Math.random,
  transitionSeconds = 3,
  load: LoadProfile = NOMINAL_LOAD,
): number[] {
  const starPeak = motor.nominalCurrent * motor.starPeakRatio * load.currentMultiplier;
  const transitionAt = Math.min(0.7, Math.max(0.18, transitionSeconds / 10));
  const transitionWindow = 0.04;
  const baseline = motor.nominalCurrent * load.currentMultiplier * 0.58;
  const switchPeak = motor.nominalCurrent * estimateStarTransitionPeakRatio(transitionSeconds, motor.rampUpTime / 1000, load.torqueMultiplier) * load.currentMultiplier;

  return Array.from({ length: points }, (_, index) => {
    const time = index / points;
    const starRampEnd = transitionAt * 0.6;
    if (time < starRampEnd) {
      const decay = 1 - (time / Math.max(starRampEnd, 0.01)) * 0.42;
      return Number((starPeak * decay + (random() - 0.5) * 2).toFixed(2));
    }
    if (time < transitionAt) return Number((baseline + (random() - 0.5) * 2).toFixed(2));
    if (time < transitionAt + transitionWindow) {
      const progress = (time - transitionAt) / transitionWindow;
      const value = baseline + (switchPeak - baseline) * Math.sin(Math.PI * progress);
      return Number((value + (random() - 0.5)).toFixed(2));
    }
    if (time < transitionAt + transitionWindow + 0.12) {
      const progress = (time - transitionAt - transitionWindow) / 0.12;
      return Number((switchPeak * (1 - progress * 0.78) + (random() - 0.5) * 2).toFixed(2));
    }
    return Number((motor.nominalCurrent * load.currentMultiplier + (random() - 0.5) * 1.2).toFixed(2));
  });
}

export function generateVfdStartCurve(
  points = 60,
  motor: MotorParameters = MOTOR_PARAMS,
  targetFrequencyHz = motor.frequencyHz,
  load: LoadProfile = NOMINAL_LOAD,
): number[] {
  return Array.from({ length: points }, (_, index) => {
    const ratio = index / Math.max(points - 1, 1);
    return Number((motor.nominalCurrent * load.currentMultiplier * ratio * (targetFrequencyHz / motor.frequencyHz)).toFixed(2));
  });
}

export function generateSoftStarterCurve(points = 60, motor: MotorParameters = MOTOR_PARAMS, currentLimit = 3, load: LoadProfile = NOMINAL_LOAD): number[] {
  return Array.from({ length: points }, (_, index) => {
    const progress = index / Math.max(points - 1, 1);
    return Number((motor.nominalCurrent * load.currentMultiplier * (1 + (currentLimit - 1) * (1 - progress))).toFixed(2));
  });
}

export function generateAutotransformerCurve(points = 60, motor: MotorParameters = MOTOR_PARAMS, tapRatio = 0.65, load: LoadProfile = NOMINAL_LOAD): number[] {
  const startingRatio = motor.directPeakRatio * tapRatio ** 2;
  return Array.from({ length: points }, (_, index) => {
    const progress = index / Math.max(points - 1, 1);
    return Number((motor.nominalCurrent * load.currentMultiplier * (1 + (startingRatio - 1) * Math.exp(-progress * 4))).toFixed(2));
  });
}

export function generateTimeLabels(points = 60, totalSeconds = 10): string[] {
  return Array.from({ length: points }, (_, index) => `${((index / points) * totalSeconds).toFixed(1)}s`);
}