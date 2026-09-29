import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useMachineStore } from './store/machine-store';

vi.mock('chart.js/auto', () => ({
  default: class MockChart {
    data: Record<string, unknown>;
    options: Record<string, unknown>;
    constructor(_context: unknown, config: { data: Record<string, unknown>; options: Record<string, unknown> }) {
      this.data = config.data;
      this.options = config.options;
    }
    update(): void {}
    destroy(): void {}
  },
}));

describe('bancada de acionamento', () => {
  beforeEach(() => {
    localStorage.clear();
    useMachineStore.setState({
      status: 'stopped', phase: 'idle', mode: 'direct', motorId: 'weg-w22-11', loadId: 'pump', direction: 'forward',
      faultTest: 'none', current: 0, power: 0, frequencyHz: 0, speedRatio: 0, elapsed: 0,
      fault: null, explanation: 'Motor desenergizado.', samples: [], chartPoints: Array(60).fill(0),
      starTransitionSeconds: 3, language: 'pt', tutorialIndex: -1, showComparison: false,
    });
  });

  it('troca os rótulos para inglês pelo controle de idioma', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { name: 'Control panel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'START' })).toBeEnabled();
  });

  it('dispara e reseta uma proteção elétrica acessível', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Teste de proteção|Protection test/), { target: { value: 'phase-loss' } });
    fireEvent.click(screen.getByRole('button', { name: 'LIGAR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('FALTA DE FASE');
    fireEvent.click(screen.getByRole('button', { name: 'RESETAR PAINEL' }));
    await waitFor(() => expect(useMachineStore.getState().status).toBe('stopped'));
  });
});