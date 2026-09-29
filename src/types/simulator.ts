export type StartMode = 'direct' | 'star-triangle' | 'vfd' | 'soft-starter' | 'autotransformer';
export type MachineStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'fault';
export type StartPhase = 'idle' | 'direct' | 'star' | 'switching' | 'steady' | 'vfd-ramp-up' | 'vfd-ramp-down' | 'soft-ramp' | 'autotransformer-ramp';
export type FaultTest = 'none' | 'overload' | 'short' | 'phase-loss' | 'undervoltage' | 'wrong-sequence';
export type FaultType = 'SOBRECARGA' | 'CURTO-CIRCUITO' | 'FALTA DE FASE' | 'SUBTENSÃO' | 'SEQUÊNCIA DE FASE INCORRETA' | 'PARADA DE EMERGÊNCIA';
export type LoadProfileId = 'pump' | 'fan' | 'conveyor' | 'high-inertia';
export type RotationDirection = 'forward' | 'reverse';
export type Language = 'pt' | 'en';

export interface MotorParameters {
  id: string;
  model: string;
  powerLabel: string;
  nominalCurrent: number;
  nominalPower: number;
  voltage: number;
  inertiaKgM2: number;
  frequencyHz: number;
  directPeakRatio: number;
  starPeakRatio: number;
  rampUpTime: number;
  starToTriTime: number;
}

export interface VfdSettings {
  accelerationSeconds: number;
  decelerationSeconds: number;
  targetFrequencyHz: number;
}

export interface FaultPayload {
  type: FaultType;
  message: string;
  current: number;
  timestamp: string;
}

export type FaultResult =
  | { fault: false }
  | { fault: true; type: FaultType; message: string; current?: number };

export interface EventEntry {
  id: string;
  timestamp: string;
  message: string;
}

export interface MeasurementSample {
  timestamp: string;
  current: number;
  power: number;
  frequency: number;
}

export interface TelemetryPacket extends MeasurementSample {
  deviceId: string;
  motorId: string;
  status: MachineStatus;
  mode: StartMode;
}

export interface LoadProfile {
  id: LoadProfileId;
  label: string;
  inertiaMultiplier: number;
  currentMultiplier: number;
  torqueMultiplier: number;
}

export interface ElectricalConditions {
  hasAllPhases: boolean;
  voltageRatio: number;
  phaseSequenceCorrect: boolean;
}

export interface SimulationEngineState extends ElectricalConditions {
  status: MachineStatus;
  language: Language;
  faultType: FaultType | null;
  faultTest: FaultTest;
  testCurrentMultiple: number | null;
  mode: StartMode;
  phase: StartPhase;
  direction: RotationDirection;
  motor: MotorParameters;
  load: LoadProfile;
  elapsedSeconds: number;
  current: number;
  power: number;
  frequencyHz: number;
  speedRatio: number;
  thermalElapsedSeconds: number;
  starTransitionSeconds: number;
  vfd: VfdSettings;
  softStarterCurrentLimit: number;
  autotransformerTapRatio: number;
  thermalClassSeconds: number;
}

export interface SimulationStepResult {
  state: SimulationEngineState;
  trip?: { type: FaultType; message: string; current: number };
  explanation: string;
}