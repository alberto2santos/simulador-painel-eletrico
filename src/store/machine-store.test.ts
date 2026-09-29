import { beforeEach, describe, expect, it } from 'vitest';
import { useMachineStore } from './machine-store';

describe('estado persistido do painel', () => {
  beforeEach(() => {
    useMachineStore.persist.clearStorage();
    useMachineStore.setState({ status: 'stopped', direction: 'forward', mode: 'direct', language: 'pt' });
  });

  it('persiste motor, perfil de carga, modo e idioma', () => {
    const store = useMachineStore.getState();
    store.setMotor('weg-w22-22');
    store.setLoad('high-inertia');
    store.setMode('vfd');
    store.setLanguage('en');

    const persisted = JSON.parse(localStorage.getItem('eletrica-lab-simulator-v3') ?? '{}').state;
    expect(persisted).toMatchObject({ motorId: 'weg-w22-22', loadId: 'high-inertia', mode: 'vfd', language: 'en' });
  });

  it('não permite trocar o sentido depois que a partida começou', () => {
    useMachineStore.getState().setDirection('reverse');
    useMachineStore.getState().start();
    useMachineStore.getState().setDirection('forward');
    expect(useMachineStore.getState().direction).toBe('reverse');
    useMachineStore.getState().emergencyStop();
  });
});