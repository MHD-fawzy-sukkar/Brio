/**
 * Abstract Port Interfaces for Game Engine Core
 * Decouples domain game logic from Cloudflare Durable Objects, Node.js, D1, or WebSockets.
 */

export interface ClockPort {
  now(): number;
}

export interface SchedulerPort {
  scheduleAlarm(dueAt: number, actionName: string): Promise<void>;
  cancelAlarm(): Promise<void>;
}

export interface TransportPort {
  broadcast(roomId: string, message: unknown): void;
  sendToUser(connectionId: string, message: unknown): void;
}

export interface StoragePort<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}
