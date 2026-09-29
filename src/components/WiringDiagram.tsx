import React from 'react';
import type { Language, MachineStatus, RotationDirection, StartMode, StartPhase } from '../types/simulator';

interface WiringDiagramProps {
  mode: StartMode;
  phase: StartPhase;
  status: MachineStatus;
  frequencyHz: number;
  direction: RotationDirection;
  language: Language;
}

interface ContactorProps {
  name: string;
  x: number;
  closed: boolean;
  label: string;
}

function Contactor({ name, x, closed, label }: ContactorProps) {
  const color = closed ? '#83c99d' : '#66756a';
  return (
    <g className={closed ? 'contactor contactor-closed' : 'contactor'}>
      <rect x={x} y="44" width="100" height="90" rx="2" fill="#18211c" stroke={closed ? '#83c99d' : '#405046'} />
      <text x={x + 50} y="61" textAnchor="middle" fill="#e9eee8" className="diagram-tag">{name}</text>
      <text x={x + 50} y="75" textAnchor="middle" fill="#91a095" className="diagram-label">{label}</text>
      {[0, 1, 2].map((pole) => {
        const poleX = x + 24 + pole * 26;
        return (
          <g key={pole}>
            <circle cx={poleX} cy="91" r="3" fill={color} />
            <circle cx={poleX} cy="119" r="3" fill={color} />
            <line x1={poleX} y1={closed ? 94 : 94} x2={poleX} y2={closed ? 116 : 107} stroke={color} strokeWidth="3" />
          </g>
        );
      })}
      <circle cx={x + 50} cy="147" r="4" fill={closed ? '#83c99d' : '#344239'} />
    </g>
  );
}

export default function WiringDiagram({ mode, phase, status, frequencyHz, direction, language }: WiringDiagramProps) {
  const en = language === 'en';
  const energized = status === 'starting' || status === 'running' || status === 'stopping';
  const direct = mode === 'direct' && energized;
  const poweredStarter = mode === 'vfd' || mode === 'soft-starter' || mode === 'autotransformer';
  const vfd = mode === 'vfd';
  const star = mode === 'star-triangle' && energized && phase === 'star';
  const triangle = mode === 'star-triangle' && status === 'running' && phase === 'steady';
  const main = direct || star || triangle || (vfd && energized);
  const selectedStarter = mode === 'soft-starter' ? 'SS-01' : mode === 'autotransformer' ? 'TA-01' : 'INV-01';
  const selectedStarterLabel = mode === 'soft-starter' ? (en ? 'SOFT STARTER' : 'SOFT-STARTER') : mode === 'autotransformer' ? (en ? 'AUTOTRANSFORMER' : 'AUTOTRANSFORMADOR') : 'VFD';
  const modeName = mode === 'star-triangle' ? (en ? 'star-delta' : 'estrela-triângulo') : mode === 'vfd' ? 'VFD' : mode === 'soft-starter' ? (en ? 'soft starter' : 'soft-starter') : mode === 'autotransformer' ? (en ? 'autotransformer' : 'chave compensadora') : (en ? 'direct-on-line' : 'partida direta');

  return (
    <section className="wiring-panel" aria-label="Diagrama elétrico de força">
      <div className="wiring-heading">
        <div className="section-title"><span>04</span><h2>{en ? 'Power circuit' : 'Diagrama de força'}</h2></div>
        <span className="diagram-legend"><i /> {en ? 'CLOSED CONTACTOR' : 'CONTATOR FECHADO'}</span>
      </div>
      <div className="diagram-scroll">
        <svg className="wiring-svg" viewBox="0 0 850 190" role="img" aria-label={`${en ? 'Power diagram' : 'Esquema'} ${modeName}`}>
          <text x="16" y="87" className="diagram-label">{en ? 'SUPPLY 3~' : 'REDE 3~'}</text>
          {[0, 1, 2].map((line) => <g key={line}>
            <text x="105" y={84 + line * 14} textAnchor="end" className="diagram-label">L{line + 1}</text>
            <line x1="112" y1={80 + line * 14} x2="185" y2={80 + line * 14} className={main ? 'wire wire-live' : 'wire'} />
          </g>)}
          {poweredStarter ? <g>
            <rect x="185" y="44" width="100" height="90" rx="2" className={energized ? 'drive-box drive-live' : 'drive-box'} />
            <text x="235" y="75" textAnchor="middle" className="diagram-tag">{selectedStarter}</text>
            <text x="235" y="93" textAnchor="middle" className="diagram-label">{selectedStarterLabel}</text>
            <text x="235" y="115" textAnchor="middle" className="diagram-value">{frequencyHz.toFixed(1)} Hz</text>
            <line x1="285" y1="89" x2="365" y2="89" className={energized ? 'wire wire-live' : 'wire'} />
          </g> : <>
            <Contactor name="K1" x={185} closed={main} label={en ? 'MAIN' : 'PRINCIPAL'} />
            <line x1="285" y1="89" x2="315" y2="89" className={main ? 'wire wire-live' : 'wire'} />
            {mode === 'star-triangle' ? <>
              <Contactor name="K2" x={315} closed={star} label={en ? 'STAR' : 'ESTRELA'} />
              <Contactor name="K3" x={445} closed={triangle} label={en ? 'DELTA' : 'TRIÂNGULO'} />
              <line x1="545" y1="89" x2="625" y2="89" className={main ? 'wire wire-live' : 'wire'} />
            </> : mode === 'direct' ? <>
              <Contactor name="K2" x={315} closed={direct && direction === 'forward'} label={en ? 'FORWARD' : 'DIRETO'} />
              <Contactor name="K3" x={445} closed={direct && direction === 'reverse'} label={en ? 'REVERSE' : 'REVERSO'} />
              <line x1="545" y1="89" x2="625" y2="89" className={main ? 'wire wire-live' : 'wire'} />
            </> : <line x1="315" y1="89" x2="625" y2="89" className={main ? 'wire wire-live' : 'wire'} />}
          </>}
          <g className={main ? 'motor-load motor-load-live' : 'motor-load'}>
            <circle cx="680" cy="89" r="37" />
            <text x="680" y="94" textAnchor="middle" className="diagram-tag">M 3~</text>
            <text x="680" y="145" textAnchor="middle" className="diagram-label">{en ? 'MOTOR' : 'MOTOR'}</text>
          </g>
          <line x1={poweredStarter ? 285 : mode === 'star-triangle' || mode === 'direct' ? 545 : 315} y1="89" x2="643" y2="89" className={main ? 'wire wire-live' : 'wire'} />
        </svg>
      </div>
      <p className="diagram-caption">{mode === 'star-triangle' ? phase === 'star' ? (en ? 'K1 + K2 closed · star starting' : 'K1 + K2 fechados · partida em estrela') : phase === 'switching' ? (en ? 'K2 opened · dead-time before K3 closes' : 'K2 abriu · tempo morto antes do fechamento de K3') : triangle ? (en ? 'K1 + K3 closed · delta running' : 'K1 + K3 fechados · operação em triângulo') : (en ? 'Contactors open · motor de-energized' : 'Contatores abertos · motor desenergizado') : poweredStarter ? (en ? `${selectedStarterLabel} controls motor voltage and current` : `${selectedStarterLabel} controla tensão e corrente do motor`) : direct ? (en ? `K1 and ${direction === 'forward' ? 'K2' : 'K3'} closed · direction interlocked` : `K1 e ${direction === 'forward' ? 'K2' : 'K3'} fechados · contatores de sentido intertravados`) : (en ? 'Main contactors open · motor de-energized' : 'Contatores de potência abertos · motor desenergizado')}</p>
    </section>
  );
}