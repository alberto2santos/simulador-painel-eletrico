import type { TelemetryPacket } from '../types/simulator';

type MessageListener = (payload: string) => void;

export class VirtualWebSocketBroker {
  private readonly listeners = new Set<MessageListener>();

  subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(packet: TelemetryPacket): string {
    const payload = JSON.stringify(packet);
    queueMicrotask(() => this.listeners.forEach((listener) => listener(payload)));
    return payload;
  }
}

export const virtualBroker = new VirtualWebSocketBroker();