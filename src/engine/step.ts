import type { FaultType, SimulationEngineState, SimulationStepResult } from '../types/simulator';
import { calculateThermalTripSeconds, checkInstantaneousShortCircuit, stepThermalRelay } from '../utils/fault-simulator';

const STAR_SWITCH_WINDOW_SECONDS = 0.25;

export function estimateStarTransitionPeakRatio(
  transitionSeconds: number,
  accelerationSeconds: number,
  torqueMultiplier: number,
): number {
  const recommendedSeconds = Math.max(0.5, accelerationSeconds * 1.2);
  const timingError = Math.abs(transitionSeconds - recommendedSeconds) / recommendedSeconds;
  return 4.5 + Math.min(4, timingError * 2.5) + Math.max(0, torqueMultiplier - 1) * 0.8;
}

function faultResult(state: SimulationEngineState, type: FaultType, message: string, current: number): SimulationStepResult {
  return {
    state: { ...state, status: 'fault', phase: 'idle', current, faultType: type },
    trip: { type, message, current },
    explanation: message,
  };
}

function explainState(state: SimulationEngineState): string {
  const en = state.language === 'en';
  if (state.status === 'stopped') return en ? 'Motor de-energized; power contactors are open.' : 'Motor desenergizado; contatores de potência abertos.';
  if (state.status === 'fault') return en ? `Electrical protection ${state.faultType ?? 'fault'} tripped; reset is required.` : `Proteção ${state.faultType ?? 'elétrica'} atuada; partidas bloqueadas até o reset.`;
  if (state.status === 'stopping') return en ? 'The drive is lowering frequency using the configured deceleration ramp.' : 'Inversor reduz a frequência pela rampa de desaceleração configurada.';
  if (state.mode === 'star-triangle' && state.phase === 'star') return en ? 'K1 and K2 are closed; the motor windings are connected in star to limit current.' : 'K1 e K2 fechados; o enrolamento está ligado em estrela para limitar a corrente.';
  if (state.mode === 'star-triangle' && state.phase === 'switching') return en ? 'K2 opened before K3 closes; the interlock prevents both contactors from closing together.' : 'K2 abriu antes do fechamento de K3; o intertravamento mantém os dois contatores impedidos de fechar juntos.';
  if (state.mode === 'star-triangle' && state.phase === 'steady') return en ? 'K2 is open and K3 is closed; the motor runs in delta after transition.' : 'K2 aberto e K3 fechado; o motor opera em triângulo após a comutação.';
  if (state.direction === 'reverse') return en ? 'Reverse phase sequence selected; the electrical interlock prevents simultaneous direction contactors.' : 'Contatores de reversão com sequência de fases invertida; intertravamento elétrico impede acionamento simultâneo.';
  if (state.mode === 'vfd') return en ? `VFD controls frequency at ${state.frequencyHz.toFixed(1)} Hz and limits current during the ramp.` : `VFD controla a frequência em ${state.frequencyHz.toFixed(1)} Hz e limita a corrente durante a rampa.`;
  if (state.mode === 'soft-starter') return en ? 'The soft starter controls applied voltage and limits current during acceleration.' : 'Soft-starter controla a tensão aplicada e reduz o pico de corrente durante a aceleração.';
  if (state.mode === 'autotransformer') return en ? 'The autotransformer tap reduces motor voltage during starting.' : 'Chave compensadora reduz a tensão pela derivação selecionada durante a partida.';
  return en ? 'K1 is closed; three-phase line voltage is applied directly to the motor.' : 'K1 fechado; alimentação trifásica direta aplicada ao motor.';
}

function startingTimeSeconds(state: SimulationEngineState): number {
  const inertiaFactor = state.load.inertiaMultiplier * (1 + state.motor.inertiaKgM2);
  return Math.max(0.4, state.motor.rampUpTime / 1000 * inertiaFactor);
}

function normalCurrent(state: SimulationEngineState, currentMultiple = 1): number {
  return state.motor.nominalCurrent * state.load.currentMultiplier * currentMultiple;
}

function protectionTrip(state: SimulationEngineState): SimulationStepResult | null {
  if (!state.hasAllPhases) {
    return faultResult(state, 'FALTA DE FASE', state.language === 'en' ? 'Phase loss detected; the thermal relay opened the circuit.' : 'Falta de fase detectada; o relé térmico abre o circuito para proteger o motor.', state.current);
  }
  if (state.voltageRatio < 0.85) {
    return faultResult(state, 'SUBTENSÃO', state.language === 'en' ? `Voltage dropped to ${(state.voltageRatio * 100).toFixed(0)}% of nominal.` : `Tensão caiu para ${(state.voltageRatio * 100).toFixed(0)}% do valor nominal.`, state.current);
  }
  if (!state.phaseSequenceCorrect) {
    return faultResult(state, 'SEQUÊNCIA DE FASE INCORRETA', state.language === 'en' ? 'Supply phase sequence does not match the selected rotation direction.' : 'Sequência de fases incompatível com o sentido de rotação selecionado.', state.current);
  }
  return null;
}

function applyThermalRelay(state: SimulationEngineState, nextState: SimulationEngineState, dtSeconds: number): SimulationStepResult {
  if (checkInstantaneousShortCircuit(nextState.current, state.motor.nominalCurrent)) {
    return faultResult(state, 'CURTO-CIRCUITO', state.language === 'en' ? 'Instantaneous current exceeded 10× nominal; magnetic protection tripped.' : 'Corrente instantânea acima de 10× nominal; proteção magnética atuada.', nextState.current);
  }
  const relay = stepThermalRelay(nextState.current, state.motor.nominalCurrent, state.thermalClassSeconds, state.thermalElapsedSeconds, dtSeconds);
  const updatedState = { ...nextState, thermalElapsedSeconds: relay.accumulatedSeconds };

  if (relay.accumulatedSeconds === 0 || nextState.current <= state.motor.nominalCurrent * 1.05) {
    return { state: updatedState, explanation: explainState(updatedState) };
  }
  if (relay.tripped) {
    return faultResult(state, 'SOBRECARGA', state.language === 'en' ? `Class ${state.thermalClassSeconds} thermal relay: ${(nextState.current / state.motor.nominalCurrent).toFixed(1)}× nominal current for ${relay.accumulatedSeconds.toFixed(1)} s.` : `Relé térmico classe ${state.thermalClassSeconds}: ${(nextState.current / state.motor.nominalCurrent).toFixed(1)}× a corrente nominal por ${relay.accumulatedSeconds.toFixed(1)} s.`, nextState.current);
  }

  return {
    state: updatedState,
    explanation: state.language === 'en'
      ? `Class ${state.thermalClassSeconds} relay: ${(nextState.current / state.motor.nominalCurrent).toFixed(1)}× nominal; estimated trip time ${Math.max(0, relay.tripAfterSeconds - relay.accumulatedSeconds).toFixed(1)} s.`
      : `Relé classe ${state.thermalClassSeconds}: ${(nextState.current / state.motor.nominalCurrent).toFixed(1)}× nominal; tempo estimado até o disparo ${Math.max(0, relay.tripAfterSeconds - relay.accumulatedSeconds).toFixed(1)} s.`,
  };
}

export function stepSimulation(state: SimulationEngineState, dtSeconds: number): SimulationStepResult {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return { state, explanation: explainState(state) };
  }
  if (state.status === 'stopped' || state.status === 'fault') {
    return { state, explanation: explainState(state) };
  }

  const trip = protectionTrip(state);
  if (trip) return trip;
  if (state.faultTest === 'short') {
    return faultResult(state, 'CURTO-CIRCUITO', state.language === 'en' ? 'Simulated short circuit; instantaneous protection opened the circuit.' : 'Curto-circuito simulado; a proteção instantânea abriu o circuito.', state.motor.nominalCurrent * 11);
  }

  const elapsedSeconds = state.elapsedSeconds + dtSeconds;
  const accelerationSeconds = startingTimeSeconds(state);
  const progress = Math.min(1, elapsedSeconds / accelerationSeconds);
  let phase = state.phase;
  let status = state.status;
  let frequencyHz = state.frequencyHz;
  let speedRatio = state.speedRatio;
  let current = state.current;
  const voltageRatio = Math.min(1.2, Math.max(0, state.voltageRatio));

  if (state.status === 'stopping' && state.mode === 'vfd') {
    const frequencyStep = state.motor.frequencyHz * dtSeconds / state.vfd.decelerationSeconds;
    frequencyHz = Math.max(0, state.frequencyHz - frequencyStep);
    current = normalCurrent(state, frequencyHz / state.motor.frequencyHz);
    speedRatio = frequencyHz / state.motor.frequencyHz;
    if (frequencyHz <= 0) {
      const stoppedState = { ...state, status: 'stopped' as const, phase: 'idle' as const, elapsedSeconds: 0, current: 0, power: 0, frequencyHz: 0, speedRatio: 0, thermalElapsedSeconds: 0 };
      return { state: stoppedState, explanation: state.language === 'en' ? 'Frequency reached zero; motor de-energized after the drive ramp.' : 'Frequência zerada; motor desenergizado após a rampa do inversor.' };
    }
    const stoppingState = { ...state, elapsedSeconds, frequencyHz, current, power: state.motor.nominalPower * current / state.motor.nominalCurrent, speedRatio, phase: 'vfd-ramp-down' as const };
    return applyThermalRelay(state, stoppingState, dtSeconds);
  }

  if (state.mode === 'star-triangle') {
    const transitionEnd = state.starTransitionSeconds + STAR_SWITCH_WINDOW_SECONDS;
    if (elapsedSeconds < state.starTransitionSeconds) {
      phase = 'star';
      speedRatio = Math.min(0.86, progress);
      const starCurrent = state.motor.starPeakRatio * (1 - Math.min(1, elapsedSeconds / accelerationSeconds) * 0.65);
      current = normalCurrent(state, starCurrent);
      status = 'starting';
    } else if (elapsedSeconds < transitionEnd) {
      phase = 'switching';
      status = 'starting';
      speedRatio = Math.min(0.9, progress);
      const peakRatio = estimateStarTransitionPeakRatio(state.starTransitionSeconds, accelerationSeconds, state.load.torqueMultiplier);
      const transitionProgress = (elapsedSeconds - state.starTransitionSeconds) / STAR_SWITCH_WINDOW_SECONDS;
      current = normalCurrent(state, Math.max(0.58, peakRatio * Math.sin(Math.PI * transitionProgress)));
    } else {
      phase = 'steady';
      status = 'running';
      speedRatio = 1;
      current = normalCurrent(state, 1);
    }
  } else if (state.mode === 'vfd') {
    const target = state.vfd.targetFrequencyHz;
    const frequencyStep = state.motor.frequencyHz * dtSeconds / state.vfd.accelerationSeconds;
    frequencyHz = Math.min(target, state.frequencyHz + frequencyStep);
    speedRatio = frequencyHz / state.motor.frequencyHz;
    current = normalCurrent(state, Math.max(0.18, speedRatio) * (1 + (1 - progress) * 0.55));
    phase = frequencyHz >= target ? 'steady' : 'vfd-ramp-up';
    status = frequencyHz >= target ? 'running' : 'starting';
  } else {
    speedRatio = progress;
    const startupMultiple = state.mode === 'direct'
      ? state.motor.directPeakRatio
      : state.mode === 'soft-starter'
        ? state.softStarterCurrentLimit
        : state.motor.directPeakRatio * state.autotransformerTapRatio ** 2;
    const decay = Math.exp(-progress * 3.4);
    current = normalCurrent(state, 1 + (startupMultiple - 1) * decay);
    phase = state.mode === 'soft-starter' ? 'soft-ramp' : state.mode === 'autotransformer' ? 'autotransformer-ramp' : 'direct';
    if (progress >= 1) {
      status = 'running';
      phase = 'steady';
      speedRatio = 1;
      current = normalCurrent(state);
    } else {
      status = 'starting';
    }
  }

  current *= voltageRatio >= 0.85 ? 1 / voltageRatio : 1;
  if (state.testCurrentMultiple !== null) current = state.motor.nominalCurrent * state.testCurrentMultiple;
  else if (state.faultTest === 'overload') current = state.motor.nominalCurrent * 6;
  const nextState: SimulationEngineState = {
    ...state,
    status,
    phase,
    elapsedSeconds,
    current,
    power: state.motor.nominalPower * current / state.motor.nominalCurrent,
    frequencyHz: state.mode === 'vfd' ? frequencyHz : state.motor.frequencyHz,
    speedRatio,
  };
  return applyThermalRelay(state, nextState, dtSeconds);
}