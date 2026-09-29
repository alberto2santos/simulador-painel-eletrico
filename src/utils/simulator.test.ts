import { describe, expect, it, vi } from 'vitest';
import { estimateStarTransitionPeakRatio, stepSimulation } from '../engine/step';
import { calculateThermalTripSeconds } from './fault-simulator';
import { LOAD_PROFILES, MOTOR_OPTIONS, MOTOR_PARAMS, generateAutotransformerCurve, generateDirectStartCurve, generateSoftStarterCurve, generateStarTriangleCurve, generateVfdStartCurve } from './simulator';
import type { SimulationEngineState } from '../types/simulator';

function runningState(overrides: Partial<SimulationEngineState> = {}): SimulationEngineState {
  return {
    status: 'running',
    language: 'pt',
    phase: 'steady',
    mode: 'direct',
    direction: 'forward',
    motor: MOTOR_PARAMS,
    load: LOAD_PROFILES.pump,
    elapsedSeconds: 5,
    current: MOTOR_PARAMS.nominalCurrent,
    power: MOTOR_PARAMS.nominalPower,
    frequencyHz: MOTOR_PARAMS.frequencyHz,
    speedRatio: 1,
    thermalElapsedSeconds: 0,
    starTransitionSeconds: 3,
    vfd: { accelerationSeconds: 5, decelerationSeconds: 4, targetFrequencyHz: 60 },
    softStarterCurrentLimit: 3,
    autotransformerTapRatio: 0.65,
    thermalClassSeconds: 10,
    hasAllPhases: true,
    voltageRatio: 1,
    phaseSequenceCorrect: true,
    faultType: null,
    faultTest: 'none',
    testCurrentMultiple: null,
    ...overrides,
  };
}

describe('curvas de partida', () => {
  it('gera pico de sete vezes a corrente nominal na partida direta', () => {
    const curve = generateDirectStartCurve(60, MOTOR_PARAMS, () => 0.5);
    expect(curve).toHaveLength(60);
    expect(curve[3]).toBeCloseTo(MOTOR_PARAMS.nominalCurrent * 7, 2);
  });

  it('parametriza o pico direto conforme o motor selecionado', () => {
    const smallerMotor = MOTOR_OPTIONS[0];
    const curve = generateDirectStartCurve(60, smallerMotor, () => 0.5);
    expect(curve[3]).toBeCloseTo(smallerMotor.nominalCurrent * smallerMotor.directPeakRatio, 2);
  });

  it('estabiliza a curva estrela-triângulo na corrente nominal', () => {
    const curve = generateStarTriangleCurve(60, MOTOR_PARAMS, () => 0.5);
    expect(Math.max(...curve)).toBeGreaterThan(MOTOR_PARAMS.nominalCurrent * 2.3);
    expect(curve.at(-1)).toBeCloseTo(MOTOR_PARAMS.nominalCurrent, 1);
  });

  it('eleva a frequência e a corrente gradualmente na rampa do inversor', () => {
    const curve = generateVfdStartCurve(60, MOTOR_PARAMS, 45);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBeCloseTo(MOTOR_PARAMS.nominalCurrent * 0.75, 2);
    expect(curve.every((value, index) => index === 0 || value >= curve[index - 1])).toBe(true);
  });

  it('eleva o pico de comutação quando a temporização Y-Δ se afasta do ajuste recomendado', () => {
    const peakAtRecommendedTime = estimateStarTransitionPeakRatio(2.5, 2.08, 1);
    const peakAtPoorTime = estimateStarTransitionPeakRatio(7, 2.08, 1);
    expect(peakAtPoorTime).toBeGreaterThan(peakAtRecommendedTime);
    expect(Math.max(...generateStarTriangleCurve(60, MOTOR_PARAMS, () => 0.5, 7))).toBeGreaterThan(peakAtRecommendedTime * MOTOR_PARAMS.nominalCurrent);
  });

  it('limita a corrente da soft-starter e reduz o pico pela derivação do autotransformador', () => {
    const softStarter = generateSoftStarterCurve(60, MOTOR_PARAMS, 3);
    const compensated = generateAutotransformerCurve(60, MOTOR_PARAMS, 0.65);
    expect(softStarter[0]).toBeCloseTo(MOTOR_PARAMS.nominalCurrent * 3, 2);
    expect(softStarter.at(-1)).toBe(MOTOR_PARAMS.nominalCurrent);
    expect(compensated[0]).toBeCloseTo(MOTOR_PARAMS.nominalCurrent * (1 + (7 * 0.65 ** 2 - 1)), 2);
    expect(compensated[0]).toBeLessThan(generateDirectStartCurve(60, MOTOR_PARAMS, () => 0.5)[3]);
  });
});

describe('leituras simuladas', () => {
  it('usa ruído determinístico quando o gerador aleatório é fixado', () => {
    const random = vi.fn(() => 0.5);
    const curve = generateDirectStartCurve(60, MOTOR_PARAMS, random);
    expect(curve.at(-1)).toBe(MOTOR_PARAMS.nominalCurrent);
    expect(random).toHaveBeenCalled();
  });

  it('faz o relé classe 10 demorar mais em 1,2× do que em 6×', () => {
    const atTwelveTimes = calculateThermalTripSeconds(1.2, 1.05, 10);
    const atSixTimes = calculateThermalTripSeconds(6, 1.05, 10);
    expect(atTwelveTimes).toBeGreaterThan(60);
    expect(atSixTimes).toBeLessThan(20);
    expect(atSixTimes).toBeLessThan(atTwelveTimes);
  });

  it('dispara a curva inversa após exposição prolongada a 1,2×', () => {
    let state = runningState({ testCurrentMultiple: 1.2 });
    let tripped = false;
    for (let index = 0; index < 30; index += 1) {
      const result = stepSimulation(state, 0.1);
      state = result.state;
      tripped ||= Boolean(result.trip);
    }
    expect(tripped).toBe(false);
    for (let index = 0; index < 1600 && !tripped; index += 1) {
      const result = stepSimulation(state, 0.1);
      state = result.state;
      tripped ||= Boolean(result.trip);
    }
    expect(tripped).toBe(true);
    expect(state.faultType).toBe('SOBRECARGA');
  });

  it('atua imediatamente em falta de fase, subtensão e sequência incorreta', () => {
    expect(stepSimulation(runningState({ hasAllPhases: false }), 0.1).trip?.type).toBe('FALTA DE FASE');
    expect(stepSimulation(runningState({ voltageRatio: 0.7 }), 0.1).trip?.type).toBe('SUBTENSÃO');
    expect(stepSimulation(runningState({ phaseSequenceCorrect: false }), 0.1).trip?.type).toBe('SEQUÊNCIA DE FASE INCORRETA');
  });

  it('atua imediatamente no curto-circuito injetado', () => {
    const result = stepSimulation(runningState({ faultTest: 'short' }), 0.1);
    expect(result.trip?.type).toBe('CURTO-CIRCUITO');
  });

  it('usa o passo de tempo para desacelerar mais lentamente uma carga de alta inércia', () => {
    const state = runningState({ status: 'starting', phase: 'direct', current: 0, power: 0, speedRatio: 0, elapsedSeconds: 0 });
    const light = stepSimulation(state, 0.1);
    const heavy = stepSimulation({ ...state, load: LOAD_PROFILES['high-inertia'] }, 0.1);
    expect(heavy.state.speedRatio).toBeLessThan(light.state.speedRatio);
  });

  it('avança a frequência do VFD pelo dt informado e ignora dt inválido', () => {
    const initial = runningState({ status: 'starting', mode: 'vfd', phase: 'vfd-ramp-up', current: 0, frequencyHz: 0, speedRatio: 0, elapsedSeconds: 0 });
    const unchanged = stepSimulation(initial, 0);
    const advanced = stepSimulation(initial, 0.1);
    expect(unchanged.state).toBe(initial);
    expect(advanced.state.frequencyHz).toBeCloseTo(1.2, 2);
    expect(advanced.state.status).toBe('starting');
  });

  it('mantém as bobinas Y/Δ na janela de transição e depois estabiliza em delta', () => {
    const beforeSwitch = runningState({ status: 'starting', mode: 'star-triangle', phase: 'star', elapsedSeconds: 2.9, current: 12 });
    const switching = stepSimulation(beforeSwitch, 0.1);
    const running = stepSimulation(switching.state, 0.3);
    expect(switching.state.phase).toBe('switching');
    expect(running.state.phase).toBe('steady');
    expect(running.state.status).toBe('running');
  });
});