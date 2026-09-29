import { describe, expect, it } from 'vitest';
import { buildDiagnosticsCsv } from './export-diagnostics';

describe('exportação de diagnósticos', () => {
  it('inclui falha, eventos e medições no CSV', () => {
    const csv = buildDiagnosticsCsv(
      [{ id: '1', timestamp: '12:00:01', message: 'Sobrecarga detectada' }],
      [{ timestamp: '2026-09-29T12:00:00.000Z', current: 28, power: 14.7, frequency: 60 }],
      { type: 'SOBRECARGA', message: 'Corrente acima do nominal', current: 28, timestamp: '2026-09-29T12:00:02.000Z' },
    );
    expect(csv).toContain('sep=;');
    expect(csv).toContain('SOBRECARGA');
    expect(csv).toContain('Sobrecarga detectada');
    expect(csv).toContain('28.00');
  });
});