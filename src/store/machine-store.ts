import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { virtualBroker } from '../services/virtual-broker';
import { stepSimulation } from '../engine/step';
import { translateFaultType } from '../i18n/translations';
import type {
  EventEntry,
  FaultPayload,
  FaultTest,
  Language,
  LoadProfileId,
  MachineStatus,
  MeasurementSample,
  RotationDirection,
  SimulationEngineState,
  StartMode,
  StartPhase,
  TelemetryPacket,
  VfdSettings,
} from '../types/simulator';
import { LOAD_PROFILES, MOTOR_OPTIONS, generateAutotransformerCurve, generateDirectStartCurve, generateSoftStarterCurve, generateStarTriangleCurve, generateVfdStartCurve } from '../utils/simulator';

const FIXED_STEP_SECONDS = 0.1;
const MAX_LOG_ENTRIES = 50;
const MAX_SAMPLE_ENTRIES = 1200;
const DEFAULT_VFD: VfdSettings = { accelerationSeconds: 5, decelerationSeconds: 4, targetFrequencyHz: 60 };

export const GUIDED_STEPS = [
  { title: 'Observe o pico de partida', description: 'Selecione partida direta, ligue o motor e observe o pico próximo de sete vezes a corrente nominal.' },
  { title: 'Compare com estrela-triângulo', description: 'Troque o modo e observe o pico na transição. Ajuste o tempo Y-Δ para visualizar a influência da comutação.' },
  { title: 'Reduza a corrente com o VFD', description: 'Use o inversor, ajuste a rampa e compare a corrente enquanto a frequência aumenta.' },
];

interface SimulatorState {
  status: MachineStatus;
  phase: StartPhase;
  mode: StartMode;
  motorId: string;
  loadId: LoadProfileId;
  direction: RotationDirection;
  faultTest: FaultTest;
  starTransitionSeconds: number;
  vfdSettings: VfdSettings;
  softStarterCurrentLimit: number;
  autotransformerTapRatio: number;
  thermalClassSeconds: number;
  current: number;
  power: number;
  frequencyHz: number;
  speedRatio: number;
  thermalElapsedSeconds: number;
  elapsed: number;
  chartPoints: number[];
  samples: MeasurementSample[];
  logs: EventEntry[];
  fault: FaultPayload | null;
  explanation: string;
  lastTelemetryJson: string;
  telemetryPackets: number;
  language: Language;
  tutorialIndex: number;
  showComparison: boolean;
  setMode: (mode: StartMode) => void;
  setMotor: (motorId: string) => void;
  setLoad: (loadId: LoadProfileId) => void;
  setDirection: (direction: RotationDirection) => void;
  setFaultTest: (test: FaultTest) => void;
  setStarTransitionSeconds: (seconds: number) => void;
  setVfdSettings: (settings: Partial<VfdSettings>) => void;
  setSoftStarterCurrentLimit: (limit: number) => void;
  setAutotransformerTapRatio: (ratio: number) => void;
  setThermalClassSeconds: (seconds: number) => void;
  setLanguage: (language: Language) => void;
  setTutorialIndex: (index: number) => void;
  setShowComparison: (show: boolean) => void;
  start: () => void;
  stop: () => void;
  emergencyStop: () => void;
  resetFault: () => void;
  clearLogs: () => void;
  receiveTelemetry: (payload: string) => void;
}

const INITIAL_POINTS = Array<number>(60).fill(0);
let simulationTimer: ReturnType<typeof setInterval> | undefined;
let sampleAccumulator = 0;

function motorFor(motorId: string) {
  return MOTOR_OPTIONS.find((motor) => motor.id === motorId) ?? MOTOR_OPTIONS[1];
}

function addLog(message: string, englishMessage = message): void {
  const localizedMessage = useMachineStore.getState().language === 'en' ? englishMessage : message;
  const entry: EventEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    message: localizedMessage,
  };
  useMachineStore.setState((state) => ({ logs: [entry, ...state.logs].slice(0, MAX_LOG_ENTRIES) }));
}

function stopClock(): void {
  if (simulationTimer) clearInterval(simulationTimer);
  simulationTimer = undefined;
  sampleAccumulator = 0;
}

function engineStateFromStore(state: SimulatorState): SimulationEngineState {
  const motor = motorFor(state.motorId);
  return {
    status: state.status,
    language: state.language,
    phase: state.phase,
    mode: state.mode,
    direction: state.direction,
    motor,
    load: LOAD_PROFILES[state.loadId],
    elapsedSeconds: state.elapsed,
    current: state.current,
    power: state.power,
    frequencyHz: state.frequencyHz,
    speedRatio: state.speedRatio,
    thermalElapsedSeconds: state.thermalElapsedSeconds,
    starTransitionSeconds: state.starTransitionSeconds,
    vfd: state.vfdSettings,
    softStarterCurrentLimit: state.softStarterCurrentLimit,
    autotransformerTapRatio: state.autotransformerTapRatio,
    thermalClassSeconds: state.thermalClassSeconds,
    hasAllPhases: state.faultTest !== 'phase-loss',
    voltageRatio: state.faultTest === 'undervoltage' ? 0.72 : 1,
    phaseSequenceCorrect: state.faultTest !== 'wrong-sequence',
    faultType: state.fault?.type ?? null,
    faultTest: state.faultTest,
    testCurrentMultiple: null,
  };
}

function publishSample(current: number, frequency: number, status: MachineStatus): void {
  const state = useMachineStore.getState();
  const motor = motorFor(state.motorId);
  const power = motor.nominalPower * current / motor.nominalCurrent;
  const timestamp = new Date().toISOString();
  const sample: MeasurementSample = { timestamp, current, power, frequency };
  const packet: TelemetryPacket = {
    ...sample,
    deviceId: 'painel-eletrico-01',
    motorId: motor.id,
    status,
    mode: state.mode,
  };

  useMachineStore.setState((currentState) => ({
    current,
    power,
    frequencyHz: frequency,
    samples: [...currentState.samples, sample].slice(-MAX_SAMPLE_ENTRIES),
    chartPoints: [...currentState.chartPoints.slice(-59), current],
  }));
  virtualBroker.publish(packet);
}

function recordTrip(type: FaultPayload['type'], message: string, current: number): void {
  stopClock();
  const state = useMachineStore.getState();
  const fault: FaultPayload = { type, message, current, timestamp: new Date().toISOString() };
  publishSample(current, state.frequencyHz, state.status);
  useMachineStore.setState({
    status: 'fault',
    phase: 'idle',
    current: 0,
    power: 0,
    frequencyHz: 0,
    speedRatio: 0,
    elapsed: 0,
    fault,
    explanation: message,
  });
  addLog(`${type}: ${message}`, `${translateFaultType('en', type)}: ${message}`);
  virtualBroker.publish({
    deviceId: 'painel-eletrico-01',
    motorId: motorFor(state.motorId).id,
    status: 'fault',
    mode: state.mode,
    timestamp: fault.timestamp,
    current,
    power: 0,
    frequency: state.frequencyHz,
  });
}

function beginFixedStepLoop(): void {
  stopClock();
  simulationTimer = setInterval(() => {
    const before = useMachineStore.getState();
    const result = stepSimulation(engineStateFromStore(before), FIXED_STEP_SECONDS);
    if (result.trip) {
      recordTrip(result.trip.type, result.trip.message, result.trip.current);
      return;
    }

    useMachineStore.setState({
      status: result.state.status,
      phase: result.state.phase,
      current: result.state.current,
      power: result.state.power,
      frequencyHz: result.state.frequencyHz,
      speedRatio: result.state.speedRatio,
      thermalElapsedSeconds: result.state.thermalElapsedSeconds,
      elapsed: result.state.elapsedSeconds,
      explanation: result.explanation,
    });

    if (before.phase !== 'switching' && result.state.phase === 'switching') addLog(result.explanation);
    if (before.status !== 'running' && result.state.status === 'running') addLog('Motor estabilizado em operação.', 'Motor reached nominal operation.');
    if (before.status === 'stopping' && result.state.status === 'stopped') {
      stopClock();
      addLog('Motor parado após a rampa de desaceleração.', 'Motor stopped after the deceleration ramp.');
    }

    sampleAccumulator += FIXED_STEP_SECONDS;
    if (sampleAccumulator >= 0.2 && result.state.status !== 'stopped') {
      sampleAccumulator = 0;
      publishSample(result.state.current, result.state.frequencyHz, result.state.status);
    }
  }, FIXED_STEP_SECONDS * 1000);
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export const useMachineStore = create<SimulatorState>()(persist((set, get) => ({
  status: 'stopped',
  phase: 'idle',
  mode: 'direct',
  motorId: 'weg-w22-11',
  loadId: 'pump',
  direction: 'forward',
  faultTest: 'none',
  starTransitionSeconds: 3,
  vfdSettings: DEFAULT_VFD,
  softStarterCurrentLimit: 3,
  autotransformerTapRatio: 0.65,
  thermalClassSeconds: 10,
  current: 0,
  power: 0,
  frequencyHz: 0,
  speedRatio: 0,
  thermalElapsedSeconds: 0,
  elapsed: 0,
  chartPoints: INITIAL_POINTS,
  samples: [],
  logs: [{ id: 'startup', timestamp: new Date().toLocaleTimeString('pt-BR'), message: 'Painel inicializado. Aguardando comando do operador.' }],
  fault: null,
  explanation: 'Motor desenergizado; contatores de potência abertos.',
  lastTelemetryJson: '',
  telemetryPackets: 0,
  language: 'pt',
  tutorialIndex: -1,
  showComparison: false,

  setMode: (mode) => {
    if (get().status === 'stopped') set({ mode });
  },
  setMotor: (motorId) => {
    if (get().status === 'stopped' && MOTOR_OPTIONS.some((motor) => motor.id === motorId)) set({ motorId });
  },
  setLoad: (loadId) => {
    if (get().status === 'stopped') set({ loadId });
  },
  setDirection: (direction) => {
    if (get().status === 'stopped') set({ direction });
  },
  setFaultTest: (faultTest) => {
    if (get().status === 'stopped') set({ faultTest });
  },
  setStarTransitionSeconds: (seconds) => {
    if (get().status === 'stopped') set({ starTransitionSeconds: clamp(seconds, 0.5, 8, 3) });
  },
  setVfdSettings: (settings) => {
    if (get().status !== 'stopped') return;
    set((state) => ({
      vfdSettings: {
        accelerationSeconds: clamp(settings.accelerationSeconds ?? state.vfdSettings.accelerationSeconds, 1, 30, state.vfdSettings.accelerationSeconds),
        decelerationSeconds: clamp(settings.decelerationSeconds ?? state.vfdSettings.decelerationSeconds, 1, 30, state.vfdSettings.decelerationSeconds),
        targetFrequencyHz: clamp(settings.targetFrequencyHz ?? state.vfdSettings.targetFrequencyHz, 5, 60, state.vfdSettings.targetFrequencyHz),
      },
    }));
  },
  setSoftStarterCurrentLimit: (limit) => {
    if (get().status === 'stopped') set({ softStarterCurrentLimit: clamp(limit, 1.5, 5, 3) });
  },
  setAutotransformerTapRatio: (ratio) => {
    if (get().status === 'stopped') set({ autotransformerTapRatio: clamp(ratio, 0.5, 0.85, 0.65) });
  },
  setThermalClassSeconds: (seconds) => {
    if (get().status === 'stopped' && [10, 20, 30].includes(seconds)) set({ thermalClassSeconds: seconds });
  },
  setLanguage: (language) => set({ language }),
  setTutorialIndex: (tutorialIndex) => set({ tutorialIndex: clamp(tutorialIndex, -1, GUIDED_STEPS.length - 1, -1) }),
  setShowComparison: (showComparison) => set({ showComparison }),
  start: () => {
    const state = get();
    if (state.status !== 'stopped') return;
    stopClock();
    const motor = motorFor(state.motorId);
    const load = LOAD_PROFILES[state.loadId];
    const chartPoints = state.mode === 'direct'
      ? generateDirectStartCurve(60, motor, Math.random, load)
      : state.mode === 'star-triangle'
        ? generateStarTriangleCurve(60, motor, Math.random, state.starTransitionSeconds, load)
        : state.mode === 'vfd'
          ? generateVfdStartCurve(60, motor, state.vfdSettings.targetFrequencyHz, load)
          : state.mode === 'soft-starter'
            ? generateSoftStarterCurve(60, motor, state.softStarterCurrentLimit, load)
            : generateAutotransformerCurve(60, motor, state.autotransformerTapRatio, load);
    set({ status: 'starting', phase: 'direct', elapsed: 0, current: 0, power: 0, frequencyHz: 0, speedRatio: 0, thermalElapsedSeconds: 0, fault: null, samples: [], chartPoints, explanation: 'Partida iniciada; o motor está acelerando.' });
    const modeLabel = state.mode === 'direct' ? 'partida direta' : state.mode === 'star-triangle' ? 'estrela-triângulo' : state.mode === 'vfd' ? 'inversor de frequência' : state.mode === 'soft-starter' ? 'soft-starter' : 'chave compensadora';
    const englishModeLabel = state.mode === 'direct' ? 'direct-on-line' : state.mode === 'star-triangle' ? 'star-delta' : state.mode === 'vfd' ? 'VFD' : state.mode === 'soft-starter' ? 'soft starter' : 'autotransformer';
    addLog(`Partida iniciada: ${modeLabel}. Carga: ${load.label}.`, `Starting method: ${englishModeLabel}. Load: ${load.id}.`);
    beginFixedStepLoop();
  },
  stop: () => {
    const state = get();
    if (state.status !== 'starting' && state.status !== 'running') return;
    if (state.mode === 'vfd' && state.frequencyHz > 0) {
      set({ status: 'stopping', phase: 'vfd-ramp-down', explanation: 'VFD desacelerando pela rampa configurada.' });
      addLog(`Desaceleração do inversor iniciada (${state.vfdSettings.decelerationSeconds} s).`, `VFD deceleration started (${state.vfdSettings.decelerationSeconds} s).`);
      return;
    }
    stopClock();
    set({ status: 'stopped', phase: 'idle', current: 0, power: 0, frequencyHz: 0, speedRatio: 0, elapsed: 0, thermalElapsedSeconds: 0, chartPoints: INITIAL_POINTS, explanation: 'Motor desenergizado; contatores de potência abertos.' });
    addLog('Motor parado pelo operador.', 'Motor stopped by operator.');
  },
  emergencyStop: () => {
    const state = get();
    if (state.status === 'fault') return;
    const message = get().language === 'en' ? 'Emergency stop pressed. Reset the panel before restarting.' : 'E-stop acionado. Confirme o reset antes de reiniciar.';
    recordTrip('PARADA DE EMERGÊNCIA', message, state.current);
  },
  resetFault: () => {
    if (get().status !== 'fault') return;
    set({ status: 'stopped', phase: 'idle', current: 0, power: 0, frequencyHz: 0, speedRatio: 0, elapsed: 0, thermalElapsedSeconds: 0, fault: null, chartPoints: INITIAL_POINTS, explanation: 'Falha resetada; o painel está pronto para nova partida.' });
    addLog('Proteção resetada. Painel liberado para nova partida.', 'Protection reset. The panel is ready for a new start.');
  },
  clearLogs: () => set({ logs: [] }),
  receiveTelemetry: (lastTelemetryJson) => set((state) => ({ lastTelemetryJson, telemetryPackets: state.telemetryPackets + 1 })),
}), {
  name: 'eletrica-lab-simulator-v3',
  version: 3,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    motorId: state.motorId,
    loadId: state.loadId,
    mode: state.mode,
    direction: state.direction,
    starTransitionSeconds: state.starTransitionSeconds,
    vfdSettings: state.vfdSettings,
    softStarterCurrentLimit: state.softStarterCurrentLimit,
    autotransformerTapRatio: state.autotransformerTapRatio,
    thermalClassSeconds: state.thermalClassSeconds,
    logs: state.logs,
    language: state.language,
    tutorialIndex: state.tutorialIndex,
  }),
  merge: (persisted, current) => ({ ...current, ...(persisted as Partial<SimulatorState>), status: 'stopped', phase: 'idle', current: 0, power: 0, frequencyHz: 0, speedRatio: 0 }),
}));

virtualBroker.subscribe((payload) => useMachineStore.getState().receiveTelemetry(payload));
