import React from 'react';
import type { Language, MachineStatus, RotationDirection, StartMode, StartPhase } from '../types/simulator';

interface CommandDiagramProps {
  mode: StartMode;
  phase: StartPhase;
  status: MachineStatus;
  direction: RotationDirection;
  language: Language;
}

function Contact({ x, y, tag, closed = false, normallyClosed = false }: { x: number; y: number; tag: string; closed?: boolean; normallyClosed?: boolean }) {
  const color = closed ? '#91d6a5' : '#849491';
  return <g>
    <line x1={x} y1={y - 14} x2={x} y2={y - 6} stroke={color} strokeWidth="2" />
    <line x1={x} y1={y + 6} x2={x} y2={y + 14} stroke={color} strokeWidth="2" />
    <line x1={x - 8} y1={y - 6} x2={x - 8} y2={y + 6} stroke={color} strokeWidth="2" />
    <line x1={x + 8} y1={y - 6} x2={x + 8} y2={y + 6} stroke={color} strokeWidth="2" />
    {normallyClosed && <line x1={x - 10} y1={y + 9} x2={x + 10} y2={y - 9} stroke={color} strokeWidth="1.5" />}
    <text x={x} y={y - 21} textAnchor="middle" className="ladder-tag">{tag}</text>
  </g>;
}

function Coil({ x, y, tag, energized = false }: { x: number; y: number; tag: string; energized?: boolean }) {
  return <g>
    <path d={`M${x - 9} ${y - 12} C${x + 4} ${y - 12}, ${x + 4} ${y + 12}, ${x - 9} ${y + 12} M${x + 9} ${y - 12} C${x - 4} ${y - 12}, ${x - 4} ${y + 12}, ${x + 9} ${y + 12}`} fill="none" stroke={energized ? '#91d6a5' : '#849491'} strokeWidth="2" />
    <text x={x} y={y + 29} textAnchor="middle" className="ladder-tag">{tag}</text>
  </g>;
}

function Rung({ y, children, label, energized }: { y: number; children: React.ReactNode; label: string; energized: boolean }) {
  return <g>
    <text x="18" y={y + 4} className="ladder-rung-label">{label}</text>
    <line x1="90" y1={y} x2="775" y2={y} className={energized ? 'ladder-wire ladder-wire-live' : 'ladder-wire'} />
    {children}
  </g>;
}

export default function CommandDiagram({ mode, phase, status, direction, language }: CommandDiagramProps): React.ReactElement {
  const en = language === 'en';
  const active = status === 'starting' || status === 'running' || status === 'stopping';
  const isStar = mode === 'star-triangle';
  const starCoil = isStar && phase === 'star';
  const deltaCoil = isStar && status === 'running' && phase === 'steady';
  const reversing = direction === 'reverse';
  const firstCoil = isStar ? starCoil : active && !reversing;
  const secondCoil = isStar ? deltaCoil : active && reversing;
  const labels = en
    ? { stop: 'STOP NC', start: 'START NO', seal: 'KM AUX', timer: 'KT', overload: 'THERMAL NC', star: 'STAR COIL', delta: 'DELTA COIL', forward: 'FWD COIL', reverse: 'REV COIL', enabled: 'ENERGIZED', idle: 'DE-ENERGIZED' }
    : { stop: 'PARAR NF', start: 'LIGAR NA', seal: 'KM AUX', timer: 'KT', overload: 'TÉRMICO NF', star: 'BOBINA ESTRELA', delta: 'BOBINA TRIÂNGULO', forward: 'BOBINA DIRETA', reverse: 'BOBINA REVERSA', enabled: 'ENERGIZADO', idle: 'DESENERGIZADO' };

  return (
    <section className="command-diagram wiring-panel" aria-label={en ? 'Control ladder diagram' : 'Diagrama ladder de comando'}>
      <div className="wiring-heading"><div className="section-title"><span>06</span><h2>{en ? 'Control ladder' : 'Diagrama de comando · ladder'}</h2></div><span className="diagram-legend"><i />{active ? labels.enabled : labels.idle}</span></div>
      <div className="diagram-scroll">
        <svg className="ladder-svg" viewBox="0 0 850 230" role="img" aria-label={en ? 'Stop, start, seal-in and interlocked contactor coils' : 'Botoeiras, selo, relé térmico e bobinas intertravadas'}>
          <line x1="100" y1="28" x2="100" y2="204" className="ladder-rail" />
          <line x1="780" y1="28" x2="780" y2="204" className="ladder-rail" />
          <Rung y={75} label="R1" energized={active}>
            <Contact x={150} y={75} tag={labels.stop} normallyClosed />
            <Contact x={250} y={75} tag={labels.overload} normallyClosed />
            <Contact x={365} y={75} tag={labels.start} />
            <Contact x={475} y={75} tag={labels.seal} closed={active} />
            <Contact x={585} y={75} tag={isStar ? 'K3 NF' : reversing ? 'K2 NF' : 'K3 NF'} normallyClosed />
            <Coil x={700} y={75} tag={isStar ? 'K1' : reversing ? 'K3' : 'K2'} energized={active} />
          </Rung>
          <Rung y={158} label="R2" energized={firstCoil || secondCoil}>
            <Contact x={150} y={158} tag={labels.stop} normallyClosed />
            <Contact x={250} y={158} tag={labels.seal} closed={active} />
            <Contact x={365} y={158} tag={labels.timer} closed={deltaCoil} normallyClosed={!deltaCoil} />
            <Contact x={475} y={158} tag={isStar ? 'K3 NF' : 'K2 NF'} normallyClosed />
            <Coil x={600} y={158} tag={isStar ? labels.star : labels.forward} energized={firstCoil} />
            <Contact x={665} y={158} tag={isStar ? 'K2 NF' : 'K3 NF'} normallyClosed />
            <Coil x={730} y={158} tag={isStar ? labels.delta : labels.reverse} energized={secondCoil} />
          </Rung>
          <text x="102" y="218" className="ladder-footnote">{isStar ? (en ? 'Electrical interlock: K2 and K3 cannot energize together.' : 'Intertravamento elétrico: K2 e K3 não podem energizar juntos.') : (en ? 'K2/K3 direction interlock; only one rotation coil can energize.' : 'Intertravamento K2/K3: somente uma bobina de sentido pode energizar.')}</text>
        </svg>
      </div>
    </section>
  );
}