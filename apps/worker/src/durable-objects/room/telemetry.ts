import type { RoomSocket } from './runtime';
export interface RoomMetrics {
  totalSubmissions: number;
  totalReceiptsEmitted: number;
  duplicateSubmissions: number;
  rejectedSubmissions: number;
  ackLatenciesMs: number[];
  p50AckMs: number;
  p95AckMs: number;
}

export class RoomTelemetry {
  readonly timestamps = new Map<RoomSocket, number[]>();
  readonly metrics: RoomMetrics = {
    totalSubmissions: 0,
    totalReceiptsEmitted: 0,
    duplicateSubmissions: 0,
    rejectedSubmissions: 0,
    ackLatenciesMs: [],
    p50AckMs: 0,
    p95AckMs: 0,
  };
  calculatePercentiles(): void {
    const latencies = [...this.metrics.ackLatenciesMs].sort((a, b) => a - b);
    if (latencies.length === 0) {
      this.metrics.p50AckMs = 0;
      this.metrics.p95AckMs = 0;
      return;
    }

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);

    this.metrics.p50AckMs = latencies[p50Index] || latencies[0];
    this.metrics.p95AckMs = latencies[p95Index] || latencies[latencies.length - 1];
  }
}
