import type { EventEntry, FaultPayload, MeasurementSample } from '../types/simulator';

export function buildDiagnosticsCsv(
  logs: EventEntry[],
  samples: MeasurementSample[],
  fault: FaultPayload,
): string {
  const escape = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ['tipo', 'data_hora', 'evento', 'corrente_A', 'potencia_kW', 'frequencia_Hz'],
    ['falha', fault.timestamp, fault.type, fault.current, '', ''],
    ...logs.map((entry) => ['evento', entry.timestamp, entry.message, '', '', '']),
    ...samples.map((sample) => ['medicao', sample.timestamp, '', sample.current.toFixed(2), sample.power.toFixed(2), sample.frequency.toFixed(2)]),
  ];
  return `\uFEFFsep=;\r\n${rows.map((row) => row.map(escape).join(';')).join('\r\n')}`;
}

export function downloadDiagnosticsCsv(logs: EventEntry[], samples: MeasurementSample[], fault: FaultPayload): void {
  const blob = new Blob([buildDiagnosticsCsv(logs, samples, fault)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `diagnostico-${fault.type.toLowerCase().replaceAll(' ', '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}