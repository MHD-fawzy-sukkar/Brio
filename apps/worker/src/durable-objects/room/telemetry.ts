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
  readonly blockedSockets = new WeakSet<RoomSocket>();
  readonly participantTimestamps = new Map<string, number[]>();
  allowParticipant(key: string, now: number): boolean {
    if (!this.participantTimestamps.has(key) && this.participantTimestamps.size >= 256) {
      for (const [id, times] of this.participantTimestamps)
        if (now - times[times.length - 1] >= 10000) this.participantTimestamps.delete(id);
      if (this.participantTimestamps.size >= 256) return false;
    }
    const recent = (this.participantTimestamps.get(key) || []).filter((time) => now - time < 10000);
    if (recent.length >= 30) return false;
    recent.push(now);
    this.participantTimestamps.set(key, recent);
    return true;
  }
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
