/**
 * main.js
 * Orquestra toda a lógica de controle:
 * - Ações dos botões Start/Stop/E-STOP
 * - Atualização dos LEDs e dados técnicos
 * - Coordena ChartController, MotorController, EventLogger e FaultSimulator
 * @author Alberto Luiz
 */

// ---- Estado Global ----
const AppState = {
  isRunning:      false,
  isStarting:     false,
  startMode:      'direct',
  timerInterval:  null,
  elapsedSeconds: 0,
  isFault:        false,   // ← 2.1 novo
};

// ---- Elementos DOM ----
const DOM = {
  btnStart:    document.getElementById('btnStart'),
  btnStop:     document.getElementById('btnStop'),
  btnEstop:    document.getElementById('btn-estop'),   // ← 2.3 novo
  ledGreen:    document.getElementById('ledGreen'),
  ledRed:      document.getElementById('ledRed'),
  ledYellow:   document.getElementById('ledYellow'),
  statusDot:   document.getElementById('statusDot'),
  statusText:  document.getElementById('statusText'),
  dataCurrent: document.getElementById('dataCurrent'),
  dataPower:   document.getElementById('dataPower'),
  dataTimer:   document.getElementById('dataTimer'),
  dataMode:    document.getElementById('dataMode'),
};

// ---- Inicialização ----
document.addEventListener('DOMContentLoaded', () => {
  ChartController.init();
  MotorController.init();
  EventLogger.init();   // ← 2.2 inicializa o log

  // Escuta mudança no seletor de modo
  document.querySelectorAll('input[name="startMode"]').forEach(radio => {
    radio.addEventListener('change', e => {
      AppState.startMode = e.target.value;
    });
  });

  // ← 2.3 listener do botão de emergência
  DOM.btnEstop.addEventListener('click', handleEmergencyStop);

  EventLogger.add('🟡 Sistema inicializado. Aguardando comando.');
});

// ---- HANDLER: START ----
function handleStart() {
  if (AppState.isRunning || AppState.isStarting || AppState.isFault) return;

  AppState.isStarting = true;
  AppState.startMode  = document.querySelector('input[name="startMode"]:checked').value;

  DOM.btnStart.disabled = true;
  DOM.btnStop.disabled  = false;

  const modeLabel = AppState.startMode === 'star-triangle' ? 'Estrela-Triângulo' : 'Direta';
  EventLogger.add(`▶ Partida iniciada — Modo: ${modeLabel}`);   // ← 2.2

  if (AppState.startMode === 'star-triangle') {
    _startStarTriangle();
  } else {
    _startDirect();
  }
}

// ---- HANDLER: STOP ----
function handleStop() {
  if (!AppState.isRunning && !AppState.isStarting) return;

  AppState.isRunning  = false;
  AppState.isStarting = false;

  DOM.btnStart.disabled = false;
  DOM.btnStop.disabled  = true;

  _setLEDs('stopped');
  _setStatus('stopped');

  MotorController.stop();
  ChartController.reset();

  _stopTimer();
  _updateTechData({ current: 0, power: 0, mode: '—' });

  EventLogger.add('■ Motor parado pelo operador.');   // ← 2.2
}

// ---- HANDLER: EMERGÊNCIA (E-STOP) ← 2.3 ----
function handleEmergencyStop() {
  if (!AppState.isRunning && !AppState.isStarting) return;

  AppState.isRunning  = false;
  AppState.isStarting = false;
  AppState.isFault    = true;

  DOM.btnStart.disabled = true;   // bloqueia start até resetar
  DOM.btnStop.disabled  = true;

  _setLEDs('fault');
  _setStatus('fault');

  MotorController.stop();
  ChartController.reset();

  _stopTimer();
  _updateTechData({ current: 0, power: 0, mode: 'EMERGÊNCIA' });

  EventLogger.add('🚨 PARADA DE EMERGÊNCIA acionada!');   // ← 2.2

  // Mostra botão de reset após 2s para o usuário confirmar
  _showFaultReset('EMERGÊNCIA acionada. Clique para resetar o painel.');
}

// ---- Partida Direta ----
function _startDirect() {
  _setLEDs('starting');
  _setStatus('starting');

  DOM.dataMode.textContent = 'DIRETA';

  setTimeout(() => {
    AppState.isRunning  = true;
    AppState.isStarting = false;

    _setLEDs('running');
    _setStatus('running');

    MotorController.start();
    ChartController.updateForStart('direct');

    _startTimer();
    _animateTechData('direct');

    EventLogger.add('✅ Motor em operação — Partida Direta.');   // ← 2.2
  }, 100);
}

// ---- Partida Estrela-Triângulo ----
function _startStarTriangle() {
  _setLEDs('starting');
  _setStatus('starting');

  DOM.dataMode.textContent = 'ESTRELA (Y)';
  MotorController.startStar();
  ChartController.updateForStart('star-triangle');

  EventLogger.add('⭐ Fase 1: Motor em Estrela (Y)...');   // ← 2.2

  setTimeout(() => {
    if (!AppState.isStarting) return;

    DOM.dataMode.textContent = 'COMUTANDO Y→Δ';
    _setLEDs('switching');
    EventLogger.add('🔄 Comutando Estrela → Triângulo...');   // ← 2.2

  }, SimulatorEngine.MOTOR_PARAMS.starToTriTime);

  setTimeout(() => {
    if (!AppState.isStarting) return;

    AppState.isRunning  = true;
    AppState.isStarting = false;

    DOM.dataMode.textContent = 'TRIÂNGULO (Δ)';
    _setLEDs('running');
    _setStatus('running');

    MotorController.switchToTriangle();
    _startTimer();
    _animateTechData('star-triangle');

    EventLogger.add('✅ Motor em operação — Triângulo (Δ).');   // ← 2.2

  }, SimulatorEngine.MOTOR_PARAMS.starToTriTime + 500);
}

// ---- LEDs ----
function _setLEDs(state) {
  DOM.ledGreen.classList.remove('active');
  DOM.ledRed.classList.remove('active');
  DOM.ledYellow.classList.remove('active');

  switch (state) {
    case 'stopped':
      DOM.ledRed.classList.add('active');
      break;
    case 'starting':
    case 'switching':
      DOM.ledYellow.classList.add('active');
      break;
    case 'running':
      DOM.ledGreen.classList.add('active');
      break;
    case 'fault':                              // ← 2.1 e 2.3
      DOM.ledRed.classList.add('active', 'blink');
      break;
  }
}

// ---- Status no Header ----
function _setStatus(state) {
  DOM.statusDot.className = 'status-dot';
  switch (state) {
    case 'stopped':
      DOM.statusText.textContent = 'PARADO';
      break;
    case 'starting':
      DOM.statusDot.classList.add('starting');
      DOM.statusText.textContent = 'PARTIDA...';
      break;
    case 'running':
      DOM.statusDot.classList.add('running');
      DOM.statusText.textContent = 'EM OPERAÇÃO';
      break;
    case 'fault':                              // ← 2.1 e 2.3
      DOM.statusDot.classList.add('fault');
      DOM.statusText.textContent = 'FALHA!';
      break;
  }
}

// ---- Timer ----
function _startTimer() {
  AppState.elapsedSeconds = 0;
  clearInterval(AppState.timerInterval);

  AppState.timerInterval = setInterval(() => {
    AppState.elapsedSeconds++;
    const m = String(Math.floor(AppState.elapsedSeconds / 60)).padStart(2, '0');
    const s = String(AppState.elapsedSeconds % 60).padStart(2, '0');
    DOM.dataTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function _stopTimer() {
  clearInterval(AppState.timerInterval);
  AppState.timerInterval  = null;
  AppState.elapsedSeconds = 0;
  DOM.dataTimer.textContent = '00:00';
}

// ---- Dados Técnicos ----
function _updateTechData({ current, power, mode }) {
  if (current !== undefined) {
    DOM.dataCurrent.textContent = `${current.toFixed(1)} A`;
    DOM.dataCurrent.classList.toggle('highlight', current > 0);
  }
  if (power !== undefined) {
    DOM.dataPower.textContent = `${power.toFixed(1)} kW`;
    DOM.dataPower.classList.toggle('highlight', power > 0);
  }
  if (mode !== undefined) {
    DOM.dataMode.textContent = mode;
  }
}

// ---- Animação dos Dados Técnicos + Verificação de Falha ← 2.1 ----
function _animateTechData(mode) {
  const { nominalCurrent, nominalPower } = SimulatorEngine.MOTOR_PARAMS;

  const interval = setInterval(() => {
    if (!AppState.isRunning) {
      clearInterval(interval);
      return;
    }

    const noise   = (Math.random() - 0.5) * 1.8;
    const current = nominalCurrent + noise;
    const power   = nominalPower * (current / nominalCurrent);

    _updateTechData({ current, power });

    // ← 2.1 verifica sobrecarga a cada atualização
    const { fault, type, message } = FaultSimulator.checkOverload(current);
    if (fault) {
      clearInterval(interval);
      _triggerFaultState(type, message);
    }

  }, 1500);
}

// ---- Dispara estado de falha ← 2.1 ----
function _triggerFaultState(type, message) {
  AppState.isRunning  = false;
  AppState.isStarting = false;
  AppState.isFault    = true;

  DOM.btnStart.disabled = true;
  DOM.btnStop.disabled  = true;

  _setLEDs('fault');
  _setStatus('fault');

  MotorController.stop();
  ChartController.reset();

  _stopTimer();
  _updateTechData({ current: 0, power: 0, mode: `FALHA: ${type}` });

  EventLogger.add(`⚠️ FALHA DETECTADA — ${type}: ${message}`);   // ← 2.2

  _showFaultReset(message);
}

// ---- Exibe aviso + botão de reset após falha ----
function _showFaultReset(message) {
  // Remove alerta anterior se existir
  const old = document.getElementById('fault-alert');
  if (old) old.remove();

  const alert = document.createElement('div');
  alert.id        = 'fault-alert';
  alert.className = 'fault-alert';
  alert.innerHTML = `
    <span class="fault-msg">⚠️ ${message}</span>
    <button class="fault-reset-btn" onclick="_resetFault()">🔄 RESETAR PAINEL</button>
  `;
  document.querySelector('.panel-controls').prepend(alert);
}

// Relógio em tempo real no header
function _startClock() {
  const el = document.getElementById('headerClock');
  if (!el) return;

  setInterval(() => {
    el.textContent = new Date().toLocaleTimeString('pt-BR');
  }, 1000);
}

// Dentro do DOMContentLoaded, adiciona:
_startClock();

// ---- Reseta o estado de falha ----
function _resetFault() {
  AppState.isFault = false;

  DOM.btnStart.disabled = false;
  DOM.btnStop.disabled  = true;

  _setLEDs('stopped');
  _setStatus('stopped');
  _updateTechData({ current: 0, power: 0, mode: '—' });

  const alert = document.getElementById('fault-alert');
  if (alert) alert.remove();

  EventLogger.add('🔄 Painel resetado. Pronto para nova partida.');   // ← 2.2
}