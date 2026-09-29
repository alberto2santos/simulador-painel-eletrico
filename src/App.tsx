import React, { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import CommandDiagram from './components/CommandDiagram';
import WiringDiagram from './components/WiringDiagram';
import { GUIDED_STEPS, useMachineStore } from './store/machine-store';
import type { Language, LoadProfileId, MachineStatus, MotorParameters, StartMode } from './types/simulator';
import { downloadDiagnosticsCsv } from './utils/export-diagnostics';
import { LOAD_PROFILES, MOTOR_OPTIONS, generateAutotransformerCurve, generateDirectStartCurve, generateSoftStarterCurve, generateStarTriangleCurve, generateTimeLabels, generateVfdStartCurve } from './utils/simulator';
import { translate, translateFaultType } from './i18n/translations';
import type { TranslationKey } from './i18n/translations';

type IconName = 'bolt' | 'wave' | 'power' | 'clock' | 'play' | 'stop' | 'copy' | 'reset' | 'download' | 'github' | 'mail';

const STATUS_LABEL_KEYS: Record<MachineStatus, 'stopped' | 'starting' | 'running' | 'stopping' | 'fault'> = {
  stopped: 'stopped',
  starting: 'starting',
  running: 'running',
  stopping: 'stopping',
  fault: 'fault',
};

const LOAD_LABEL_KEYS: Record<LoadProfileId, TranslationKey> = {
  pump: 'pump',
  fan: 'fan',
  conveyor: 'conveyor',
  'high-inertia': 'highInertia',
};

function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function formatMetric(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }): React.ReactElement {
  const shared = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  const paths: Record<IconName, React.ReactNode> = {
    bolt: <path d="m13 2-3 8H5l6 12 3-9h5L13 2Z" />,
    wave: <path d="M2 12h3l3-8 5 16 3-8h6" />,
    power: <><path d="M12 2v10" /><path d="M5.6 5.6a9 9 0 1 0 12.8 0" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
    stop: <rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" /></>,
    reset: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
    github: <path fill="currentColor" stroke="none" d="M12 .7a11.3 11.3 0 0 0-3.58 22.02c.57.1.78-.25.78-.55v-2.14c-3.18.69-3.85-1.35-3.85-1.35-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.09 1.76 1.19 1.76 1.19 1.02 1.75 2.67 1.25 3.32.96.1-.74.4-1.25.73-1.54-2.54-.29-5.21-1.27-5.21-5.64 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.82 1.18 3.07 0 4.38-2.68 5.35-5.23 5.63.41.36.78 1.06.78 2.13v3.17c0 .3.21.66.79.55A11.3 11.3 0 0 0 12 .7Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function MotorGraphic({ status, motor }: { status: MachineStatus; motor: MotorParameters }): React.ReactElement {
  return (
    <svg className={`motor-graphic ${status === 'running' ? 'is-running' : ''}`} viewBox="0 0 320 190" role="img" aria-label={`Motor trifásico ${motor.model}, ${motor.powerLabel}`}>
      <defs>
        <linearGradient id="motorBody" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#465a50" /><stop offset="1" stopColor="#26352e" /></linearGradient>
      </defs>
      <path d="M48 55h174a16 16 0 0 1 16 16v70a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V71a16 16 0 0 1 16-16Z" fill="url(#motorBody)" stroke="#8aa18f" strokeWidth="2" />
      <path d="M76 59v94m13-94v94m13-94v94m13-94v94m13-94v94" stroke="#718478" strokeWidth="3" opacity=".65" />
      <rect x="104" y="35" width="66" height="22" rx="5" fill="#293a31" stroke="#8aa18f" strokeWidth="2" />
      <g transform="translate(188 105)"><g className="motor-rotor"><circle r="35" fill="#17231d" stroke="#b6c9b8" strokeWidth="2" /><path d="M0-29v58M-29 0h58M-20-20l40 40m0-40-40 40" stroke="#91a995" strokeWidth="4" strokeLinecap="round" /></g><circle r="8" fill="#e79a48" /></g>
      <path d="M238 92h48v26h-48" fill="#62766a" stroke="#a6b4a8" strokeWidth="2" />
      <path d="M67 157v10h31v-10m79 0v10h31v-10" fill="#65786d" stroke="#a6b4a8" strokeWidth="2" />
      <rect x="70" y="119" width="62" height="27" rx="3" fill="#18231d" stroke="#65786d" />
      <text x="101" y="131" fill="#d4ded4" fontSize="9" fontFamily="Share Tech Mono, monospace" textAnchor="middle">WEG W22</text>
      <text x="101" y="141" fill="#91a995" fontSize="6" fontFamily="Share Tech Mono, monospace" textAnchor="middle">{formatMetric(motor.nominalPower)} kW · {motor.voltage} V</text>
    </svg>
  );
}

function App(): React.ReactElement {
  const status = useMachineStore((state) => state.status);
  const phase = useMachineStore((state) => state.phase);
  const mode = useMachineStore((state) => state.mode);
  const motorId = useMachineStore((state) => state.motorId);
  const loadId = useMachineStore((state) => state.loadId);
  const direction = useMachineStore((state) => state.direction);
  const faultTest = useMachineStore((state) => state.faultTest);
  const vfdSettings = useMachineStore((state) => state.vfdSettings);
  const starTransitionSeconds = useMachineStore((state) => state.starTransitionSeconds);
  const softStarterCurrentLimit = useMachineStore((state) => state.softStarterCurrentLimit);
  const autotransformerTapRatio = useMachineStore((state) => state.autotransformerTapRatio);
  const thermalClassSeconds = useMachineStore((state) => state.thermalClassSeconds);
  const language = useMachineStore((state) => state.language);
  const tutorialIndex = useMachineStore((state) => state.tutorialIndex);
  const showComparison = useMachineStore((state) => state.showComparison);
  const current = useMachineStore((state) => state.current);
  const power = useMachineStore((state) => state.power);
  const frequencyHz = useMachineStore((state) => state.frequencyHz);
  const elapsed = useMachineStore((state) => state.elapsed);
  const chartPoints = useMachineStore((state) => state.chartPoints);
  const samples = useMachineStore((state) => state.samples);
  const logs = useMachineStore((state) => state.logs);
  const fault = useMachineStore((state) => state.fault);
  const explanation = useMachineStore((state) => state.explanation);
  const lastTelemetryJson = useMachineStore((state) => state.lastTelemetryJson);
  const telemetryPackets = useMachineStore((state) => state.telemetryPackets);
  const start = useMachineStore((state) => state.start);
  const stop = useMachineStore((state) => state.stop);
  const emergencyStop = useMachineStore((state) => state.emergencyStop);
  const resetFault = useMachineStore((state) => state.resetFault);
  const setMode = useMachineStore((state) => state.setMode);
  const setMotor = useMachineStore((state) => state.setMotor);
  const setLoad = useMachineStore((state) => state.setLoad);
  const setDirection = useMachineStore((state) => state.setDirection);
  const setFaultTest = useMachineStore((state) => state.setFaultTest);
  const setVfdSettings = useMachineStore((state) => state.setVfdSettings);
  const setStarTransitionSeconds = useMachineStore((state) => state.setStarTransitionSeconds);
  const setSoftStarterCurrentLimit = useMachineStore((state) => state.setSoftStarterCurrentLimit);
  const setAutotransformerTapRatio = useMachineStore((state) => state.setAutotransformerTapRatio);
  const setThermalClassSeconds = useMachineStore((state) => state.setThermalClassSeconds);
  const setLanguage = useMachineStore((state) => state.setLanguage);
  const setTutorialIndex = useMachineStore((state) => state.setTutorialIndex);
  const setShowComparison = useMachineStore((state) => state.setShowComparison);
  const clearLogs = useMachineStore((state) => state.clearLogs);
  const selectedMotor = MOTOR_OPTIONS.find((motor) => motor.id === motorId) ?? MOTOR_OPTIONS[1];
  const selectedLoad = LOAD_PROFILES[loadId];
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const selectedLoadLabel = t(LOAD_LABEL_KEYS[loadId]);
  const chartCanvas = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart<'line', number[], string> | null>(null);
  const selectedMotorRef = useRef(selectedMotor);
  const [now, setNow] = useState(() => new Date());
  selectedMotorRef.current = selectedMotor;
  const comparisonCurves = useMemo(() => ({
    direct: generateDirectStartCurve(60, selectedMotor, () => 0.5, selectedLoad),
    star: generateStarTriangleCurve(60, selectedMotor, () => 0.5, starTransitionSeconds, selectedLoad),
    vfd: generateVfdStartCurve(60, selectedMotor, vfdSettings.targetFrequencyHz, selectedLoad),
  }), [selectedMotor, selectedLoad, starTransitionSeconds, vfdSettings.targetFrequencyHz]);

  useEffect(() => {
    const canvas = chartCanvas.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    const gradient = context.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(112, 190, 145, 0.22)');
    gradient.addColorStop(1, 'rgba(112, 190, 145, 0)');
    chartInstance.current = new Chart(context, {
      type: 'line',
      data: {
        labels: generateTimeLabels(),
        datasets: [{
          label: t('measured'),
          data: chartPoints,
          borderColor: '#91d6a5',
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: true,
          segment: { borderColor: (segment) => (segment.p1.parsed.y ?? 0) > selectedMotorRef.current.nominalCurrent * 5 ? '#f0b64f' : '#91d6a5' },
        }, {
          label: t('direct'), data: comparisonCurves.direct, borderColor: '#73cbd0', borderWidth: 1.5, pointRadius: 0, tension: 0.2, borderDash: [5, 4], hidden: true,
        }, {
          label: t('starDelta'), data: comparisonCurves.star, borderColor: '#f0b64f', borderWidth: 1.5, pointRadius: 0, tension: 0.2, borderDash: [3, 3], hidden: true,
        }, {
          label: 'VFD', data: comparisonCurves.vfd, borderColor: '#f17469', borderWidth: 1.5, pointRadius: 0, tension: 0.2, borderDash: [8, 3], hidden: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#17211b',
            borderColor: '#405348',
            borderWidth: 1,
            titleColor: '#b6c9b8',
            bodyColor: '#f0f3ed',
            callbacks: { label: (context) => ` ${context.dataset.label}: ${(context.parsed.y ?? 0).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} A` },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(125, 151, 132, .12)' }, ticks: { color: '#829187', maxTicksLimit: 7, maxRotation: 0 } },
          y: { beginAtZero: true, suggestedMax: selectedMotor.nominalCurrent * 7, grid: { color: 'rgba(125, 151, 132, .12)' }, ticks: { color: '#829187', callback: (value) => `${value} A` } },
        },
      },
    });
    return () => chartInstance.current?.destroy();
  }, []);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;
    chart.data.datasets[0].data = chartPoints;
    chart.data.datasets[1].data = comparisonCurves.direct;
    chart.data.datasets[2].data = comparisonCurves.star;
    chart.data.datasets[3].data = comparisonCurves.vfd;
    chart.data.datasets[1].hidden = !showComparison;
    chart.data.datasets[2].hidden = !showComparison;
    chart.data.datasets[3].hidden = !showComparison;
    chart.data.labels = generateTimeLabels(chartPoints.length, 10);
    const yScale = chart.options.scales?.y;
    if (yScale) yScale.suggestedMax = Math.max(selectedMotor.nominalCurrent * 2, Math.ceil(Math.max(...chartPoints, ...comparisonCurves.direct, ...comparisonCurves.star) * 1.15));
    chart.update('none');
  }, [chartPoints, selectedMotor, comparisonCurves, showComparison]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const statusText = t(STATUS_LABEL_KEYS[status]);
  const motorText = status === 'running'
    ? mode === 'star-triangle' && phase === 'steady' ? (language === 'pt' ? 'TRIÂNGULO (Δ)' : 'DELTA (Δ)') : mode === 'vfd' ? `${formatMetric(frequencyHz)} Hz` : t('running')
    : status === 'starting'
      ? phase === 'switching' ? (language === 'pt' ? 'COMUTANDO Y → Δ' : 'SWITCHING Y → Δ') : phase === 'star' ? (language === 'pt' ? 'PARTIDA EM ESTRELA' : 'STAR START') : mode === 'vfd' ? (language === 'pt' ? 'RAMPA DE ACELERAÇÃO' : 'ACCELERATION RAMP') : t('starting')
      : status === 'stopping' ? (language === 'pt' ? 'RAMPA DE DESACELERAÇÃO' : 'DECELERATION RAMP') : status === 'fault' ? t('faultActive') : (language === 'pt' ? 'AGUARDANDO PARTIDA' : 'READY TO START');
  const canStop = status === 'running' || status === 'starting';
  const selectedFrequency = frequencyHz || (mode === 'vfd' ? 0 : selectedMotor.frequencyHz);
  const tutorialMessages = [t('tutorialStart'), t('tutorialCompare'), t('tutorialVfd')];

  function advanceTutorial() {
    const nextIndex = tutorialIndex + 1;
    if (nextIndex >= GUIDED_STEPS.length) {
      setTutorialIndex(-1);
      return;
    }
    setTutorialIndex(nextIndex);
    setMode((['direct', 'star-triangle', 'vfd'] as StartMode[])[nextIndex]);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Painel elétrico, início">
          <span className="brand-mark"><Icon name="bolt" size={20} /></span>
          <span><strong>ELÉTRICA<span>/</span>LAB</strong><small>{t('subtitle')}</small></span>
        </a>
        <div className="topbar-meta">
          <span className={`status-pill status-${status}`}><i />{statusText}</span>
          <div className="header-datetime">
            <time className="header-date" dateTime={now.toISOString()}>{now.toLocaleDateString(t('dateLocale'), { day: '2-digit', month: 'short', year: 'numeric' })}</time>
            <time className="header-clock" dateTime={now.toISOString()}>{now.toLocaleTimeString(t('dateLocale'))}</time>
          </div>
          <div className="language-switch" role="group" aria-label="Language / Idioma">
            <button type="button" onClick={() => setLanguage('pt')} aria-pressed={language === 'pt'}>PT</button>
            <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
          </div>
        </div>
      </header>

      <main id="inicio" className="dashboard">
        <section className="page-heading">
          <div><span className="eyebrow">{t('bench')}</span><h1>{t('title')}</h1><p>{t('pageDescription')}</p></div>
          <div className="heading-actions">
            <button className="guided-trigger" type="button" onClick={() => setTutorialIndex(tutorialIndex < 0 ? 0 : -1)} aria-pressed={tutorialIndex >= 0}>{t('guidedMode')}</button>
            <label className="machine-tag"><span className="machine-tag-light" /><span className="machine-picker-copy"><small>{t('selectedMotor')}</small><select aria-label={t('selectedMotor')} value={motorId} onChange={(event) => setMotor(event.target.value)} disabled={status !== 'stopped'}>{MOTOR_OPTIONS.map((motor) => <option key={motor.id} value={motor.id}>{motor.model} · {motor.powerLabel}</option>)}</select></span></label>
          </div>
        </section>

        {tutorialIndex >= 0 && <section className="tutorial-panel" aria-live="polite"><div><span>{t('tutorialStep')} {tutorialIndex + 1} / {GUIDED_STEPS.length}</span><h2>{language === 'pt' ? GUIDED_STEPS[tutorialIndex].title : ['Observe the starting peak', 'Compare star-delta', 'Try the VFD'][tutorialIndex]}</h2><p>{tutorialMessages[tutorialIndex]}</p></div><div className="tutorial-actions"><button type="button" onClick={() => setTutorialIndex(Math.max(0, tutorialIndex - 1))} disabled={tutorialIndex === 0}>{t('previous')}</button><button type="button" onClick={advanceTutorial}>{tutorialIndex === GUIDED_STEPS.length - 1 ? t('finishTutorial') : t('next')}</button></div></section>}

        <section className="kpi-grid" aria-label="Indicadores do motor">
          <article className="kpi-card"><span className="kpi-symbol"><Icon name="bolt" /></span><div><span className="kpi-label">{t('voltage')}</span><strong>{selectedMotor.voltage} <small>V</small></strong></div><span className="kpi-note">{t('threePhase')}</span></article>
          <article className="kpi-card"><span className="kpi-symbol"><Icon name="wave" /></span><div><span className="kpi-label">{t('current')}</span><strong className={current > 0 ? 'value-live' : ''}>{formatMetric(current)} <small>A</small></strong></div><span className="kpi-note">{t('nominalCurrent')} {formatMetric(selectedMotor.nominalCurrent)} A</span></article>
          <article className="kpi-card"><span className="kpi-symbol"><Icon name="power" /></span><div><span className="kpi-label">{t('power')}</span><strong className={power > 0 ? 'value-live' : ''}>{formatMetric(power)} <small>kW</small></strong></div><span className="kpi-note">{t('nominalCurrent')} {formatMetric(selectedMotor.nominalPower)} kW</span></article>
          <article className="kpi-card runtime-card"><span className="kpi-symbol"><Icon name="clock" /></span><div><span className="kpi-label">{t('runtime')}</span><strong>{formatTime(elapsed)}</strong></div><span className="kpi-note">HH:MM</span></article>
          <article className="kpi-card frequency-card"><span className="kpi-symbol"><Icon name="wave" /></span><div><span className="kpi-label">{t('frequency')}</span><strong>{formatMetric(selectedFrequency)} <small>Hz</small></strong></div><span className="kpi-note">{t('frequencyTarget')} {mode === 'vfd' ? vfdSettings.targetFrequencyHz : selectedMotor.frequencyHz} Hz</span></article>
        </section>

        <div className="workbench">
          <aside className="control-panel" aria-label="Comandos do motor">
            <div className="section-title"><span>01</span><h2>Comando</h2></div>
            <div className="indicator-list">
              <div className={`indicator ${status === 'running' ? 'active green' : ''}`} role="status" aria-label={`${t('operation')}: ${status === 'running' ? t('running') : t('stopped')}`}><i /><span>{t('operation')}</span><b>{status === 'running' ? t('running') : t('stopped')}</b></div>
              <div className={`indicator ${status === 'starting' || status === 'stopping' ? 'active amber' : ''}`} role="status" aria-label={`${t('startup')}: ${status === 'starting' || status === 'stopping' ? t('starting') : t('stopped')}`}><i /><span>{t('startup')}</span><b>{status === 'starting' ? t('starting') : status === 'stopping' ? t('stopping') : t('stopped')}</b></div>
              <div className={`indicator ${status === 'fault' ? 'active red' : ''}`} role="status" aria-label={`${t('protection')}: ${status === 'fault' ? t('fault') : 'OK'}`}><i /><span>{t('protection')}</span><b>{status === 'fault' ? t('fault') : 'OK'}</b></div>
            </div>

            <fieldset className="control-group" disabled={status !== 'stopped'}>
              <legend>{t('driveMode')}</legend>
              <div className="mode-options">
                {([
                  ['direct', 'direct', 'directHint'],
                  ['star-triangle', 'starDelta', 'starHint'],
                  ['vfd', 'vfd', 'vfdHint'],
                  ['soft-starter', 'softStarter', 'softHint'],
                  ['autotransformer', 'autotransformer', 'autoHint'],
                ] as const).map(([value, labelKey, hintKey]) => <label key={value} className={mode === value ? 'selected' : ''}><input type="radio" name="startMode" value={value} checked={mode === value} onChange={() => setMode(value)} /><span>{t(labelKey)}</span><small>{t(hintKey)}</small></label>)}
              </div>
            </fieldset>

            <div className="parameter-settings">
              <label>{t('load')}<select aria-label={t('load')} value={loadId} onChange={(event) => setLoad(event.target.value as keyof typeof LOAD_PROFILES)} disabled={status !== 'stopped'}><option value="pump">{t('pump')}</option><option value="fan">{t('fan')}</option><option value="conveyor">{t('conveyor')}</option><option value="high-inertia">{t('highInertia')}</option></select></label>
              <label>{t('direction')}<select aria-label={t('direction')} value={direction} onChange={(event) => setDirection(event.target.value as 'forward' | 'reverse')} disabled={status !== 'stopped'}><option value="forward">{t('forward')}</option><option value="reverse">{t('reverse')}</option></select></label>
              <label>{t('thermalClass')}<select aria-label={t('thermalClass')} value={thermalClassSeconds} onChange={(event) => setThermalClassSeconds(Number(event.target.value))} disabled={status !== 'stopped'}><option value="10">{language === 'pt' ? 'Classe 10' : 'Class 10'}</option><option value="20">{language === 'pt' ? 'Classe 20' : 'Class 20'}</option><option value="30">{language === 'pt' ? 'Classe 30' : 'Class 30'}</option></select></label>
            </div>

            {mode === 'star-triangle' && <fieldset className="vfd-settings" disabled={status !== 'stopped'}><legend>{t('transition')}</legend><label>{t('transition')} <span><input type="range" min="0.5" max="8" step="0.5" value={starTransitionSeconds} onChange={(event) => setStarTransitionSeconds(Number(event.currentTarget.value))} />{formatMetric(starTransitionSeconds)} s</span></label><p className="setting-note">{language === 'pt' ? 'Tempos inadequados elevam o pico de corrente na comutação.' : 'Poor timing increases the current peak during transition.'}</p></fieldset>}

            {mode === 'vfd' && <fieldset className="vfd-settings" disabled={status !== 'stopped'}><legend>{t('vfdParameters')}</legend>
              <label>{t('targetFrequency')} <span><input type="number" min="5" max="60" step="1" value={vfdSettings.targetFrequencyHz} onChange={(event) => setVfdSettings({ targetFrequencyHz: event.currentTarget.valueAsNumber })} /> Hz</span></label>
              <label>{t('acceleration')} <span><input type="number" min="1" max="30" step="1" value={vfdSettings.accelerationSeconds} onChange={(event) => setVfdSettings({ accelerationSeconds: event.currentTarget.valueAsNumber })} /> s</span></label>
              <label>{t('deceleration')} <span><input type="number" min="1" max="30" step="1" value={vfdSettings.decelerationSeconds} onChange={(event) => setVfdSettings({ decelerationSeconds: event.currentTarget.valueAsNumber })} /> s</span></label>
            </fieldset>}

            {mode === 'soft-starter' && <fieldset className="vfd-settings"><legend>{t('softStarter')}</legend><label>{t('softCurrentLimit')} <span><input type="range" min="1.5" max="5" step="0.5" value={softStarterCurrentLimit} onChange={(event) => setSoftStarterCurrentLimit(Number(event.currentTarget.value))} disabled={status !== 'stopped'} />{formatMetric(softStarterCurrentLimit)}× In</span></label></fieldset>}
            {mode === 'autotransformer' && <fieldset className="vfd-settings"><legend>{t('autotransformer')}</legend><label>{t('transformerTap')} <span><input type="range" min="0.5" max="0.85" step="0.05" value={autotransformerTapRatio} onChange={(event) => setAutotransformerTapRatio(Number(event.currentTarget.value))} disabled={status !== 'stopped'} />{Math.round(autotransformerTapRatio * 100)}%</span></label></fieldset>}

            <div className="relay-detail"><strong>{language === 'pt' ? `Relé tempo-inverso · classe ${thermalClassSeconds}` : `Inverse-time relay · class ${thermalClassSeconds}`}</strong><span>{language === 'pt' ? '1,2× demora · 6× desarma rápido' : '1.2× trips slowly · 6× trips quickly'}</span></div>

            <div className="control-group command-group"><span className="field-label">{t('actuation')}</span><div className="command-buttons"><button className="command-button start-button" type="button" onClick={start} disabled={status !== 'stopped'}><Icon name="play" size={17} />{t('start')}</button><button className="command-button stop-button" type="button" onClick={stop} disabled={!canStop}><Icon name="stop" size={16} />{t('stop')}</button></div></div>
            <div className="emergency-block"><span className="field-label">{t('emergency')}</span><button type="button" className="emergency-button" aria-label={t('emergency')} onClick={emergencyStop} disabled={status === 'fault'}><span className="emergency-head"><b>STOP</b><small>E-STOP</small></span><span>{t('activate')}</span></button></div>

            <label className="fault-select-label" htmlFor="faultTest">{t('protectionTest')}</label>
            <select id="faultTest" value={faultTest} onChange={(event) => setFaultTest(event.target.value as typeof faultTest)} disabled={status !== 'stopped'}><option value="none">{t('noFault')}</option><option value="overload">{t('overload')}</option><option value="short">{t('shortCircuit')}</option><option value="phase-loss">{t('phaseLoss')}</option><option value="undervoltage">{t('undervoltage')}</option><option value="wrong-sequence">{t('wrongSequence')}</option></select>
            {status === 'fault' && fault && <div className="fault-alert" role="alert"><strong>{t('faultActive')} · {translateFaultType(language, fault.type)}</strong><p>{fault.message}</p><button type="button" onClick={() => downloadDiagnosticsCsv(logs, samples, fault)}><Icon name="download" size={15} />{t('exportFault')}</button><button type="button" onClick={resetFault}><Icon name="reset" size={15} />{t('reset')}</button></div>}
            <p className="safety-note">{t('safetyNote')}</p>
          </aside>

          <section className="visual-panel" aria-label={t('motorAssembly')}>
            <div className="visual-heading"><div className="section-title"><span>02</span><h2>{t('motorAssembly')}</h2></div><span className={`motor-state state-${status}`} role="status"><i />{motorText}</span></div>
            <div className={`motor-stage stage-${status}`}><div className="stage-grid" /><MotorGraphic status={status} motor={selectedMotor} /><div className="motor-caption"><span>{selectedLoadLabel} · J {selectedMotor.inertiaKgM2.toFixed(2)} kg·m²</span><span>3~ · {selectedMotor.voltage} V · {formatMetric(frequencyHz || selectedMotor.frequencyHz)} Hz · {direction === 'forward' ? t('forward') : t('reverse')}</span></div></div>
            <div className="chart-section"><div className="chart-heading"><div><span className="field-label">{t('monitoring')}</span><h3>{t('currentChart')}</h3></div><button className="compare-toggle" type="button" aria-pressed={showComparison} onClick={() => setShowComparison(!showComparison)}>{t('compareCurves')}</button></div><div className="chart-canvas"><canvas ref={chartCanvas} aria-label={t('currentChart')} /></div><div className="chart-legend"><span><i className="legend-current" />{t('measured')}</span><span><i className="legend-direct" />{t('direct')}</span><span><i className="legend-star" />{t('starDelta')}</span><span><i className="legend-vfd" />VFD</span><span><i className="legend-nominal" />{t('nominal')} · {formatMetric(selectedMotor.nominalCurrent)} A</span></div></div>
          </section>

          <aside className="event-panel" aria-label={t('eventLog')}>
            <div className="event-heading"><div className="section-title"><span>03</span><h2>{t('eventLog')}</h2></div><button type="button" className="clear-button" onClick={clearLogs} aria-label={t('clearEvents')} title={t('clearEvents')}><Icon name="reset" size={15} /></button></div>
            <div className="event-count">{t('systemLog')} <span>{String(logs.length).padStart(2, '0')}</span></div>
            <ul className="event-list" aria-live="polite">{logs.length === 0 ? <li className="empty-log">{t('noEvents')}</li> : logs.map((item, index) => <li key={item.id} className={index === 0 ? 'latest-event' : ''}><time>{item.timestamp}</time><span className="event-mark" /><p>{item.message}</p></li>)}</ul>
            <div className="event-footer"><Icon name="copy" size={15} /><span>{t('lastRecords')}</span></div>
          </aside>
        </div>

        <section className="explanation-panel" aria-live="polite"><span>{t('explanation')}</span><p>{explanation}</p></section>
        <WiringDiagram mode={mode} phase={phase} status={status} frequencyHz={frequencyHz} direction={direction} language={language} />
        <CommandDiagram mode={mode} phase={phase} status={status} direction={direction} language={language} />

        <section className="telemetry-panel" aria-label={t('telemetry')}>
          <div className="telemetry-heading"><div className="section-title"><span>07</span><h2>{t('telemetry')}</h2></div><span className="broker-status"><i /> {t('virtualBroker')} · {telemetryPackets} {t('packets')}</span></div>
          <pre>{lastTelemetryJson || t('waitingTelemetry')}</pre>
        </section>
      </main>

      <footer className="page-footer">
        <span>ELÉTRICA/LAB <i>·</i> SIMULADOR EDUCACIONAL</span>
        <nav className="footer-links" aria-label="Links de contato">
          <a href="https://github.com/alberto2santos" target="_blank" rel="noopener noreferrer"><Icon name="github" size={18} /><span>alberto2santos</span></a>
          <a href="mailto:alberto.dos.santos93@gmail.com"><Icon name="mail" size={17} /><span>alberto.dos.santos93@gmail.com</span></a>
        </nav>
        <span>{selectedMotor.model} <i>·</i> {selectedMotor.voltage} V <i>·</i> {formatMetric(selectedMotor.nominalPower)} kW</span>
      </footer>
    </div>
  );
}

export default App;
