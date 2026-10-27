import { DatabaseSync } from 'node:sqlite';
import { type PublishedQuizSnapshot } from '@brio/game-core';
export function createMockD1Database(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE room_directory (
      room_id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      creator_id TEXT NOT NULL,
      quiz_version_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reservation_expires_at TEXT NOT NULL,
      event_expires_at TEXT NOT NULL
    );
  `);

  return {
    prepare(query: string) {
      return {
        bind(...args: any[]) {
          return {
            async first<T = any>(): Promise<T | null> {
              const stmt = db.prepare(query);
              const result = stmt.get(...args) as any;
              return result || null;
            },
            async all<T = any>(): Promise<{ results: T[] }> {
              const stmt = db.prepare(query);
              const results = stmt.all(...args) as any[];
              return { results };
            },
            async run() {
              const stmt = db.prepare(query);
              const info = stmt.run(...args);
              return { success: true, meta: { changes: info.changes } };
            },
          };
        },
      } as any;
    },
  } as unknown as D1Database;
}

export function createMockDoStorage() {
  const db = new DatabaseSync(':memory:');
  let currentAlarm: number | null = null;

  return {
    sql: {
      exec(query: string, ...bindings: any[]) {
        if (bindings.length === 0) {
          if (query.trim().toUpperCase().startsWith('SELECT')) {
            return db.prepare(query).all();
          } else {
            db.exec(query);
            return [];
          }
        }
        const stmt = db.prepare(query);
        if (query.trim().toUpperCase().startsWith('SELECT')) {
          return stmt.all(...bindings);
        } else {
          stmt.run(...bindings);
          return [];
        }
      },
    },
    async setAlarm(scheduledTime: number) {
      currentAlarm = scheduledTime;
    },
    async getAlarm() {
      return currentAlarm;
    },
    async deleteAlarm() {
      currentAlarm = null;
    },
  };
}

export class MockWebSocket {
  constructor(public tags: string[] = ['role:host', 'host-session:test']) {}
  sentMessages: string[] = [];
  readyState = 1;

  send(data: string) {
    this.sentMessages.push(data);
  }
}

/** Isolated auth adapter for tests that exercise room rules after a verified handshake. */
export const hostTestEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({ first: async () => ({ id: 'test-creator' }), run: async () => ({ success: true }) }),
    }),
  },
};

export const mockQuizSnapshot: PublishedQuizSnapshot = {
  id: 'quiz_v1',
  title: 'P4 Test Quiz',
  revision: 1,
  questions: [
    {
      id: 'q1',
      type: 'MultipleChoice',
      text: 'What is 2 + 2?',
      durationMs: 30000,
      multiplier: 'Standard',
      options: [
        { id: 'opt_1', text: '3', isCorrect: false },
        { id: 'opt_2', text: '4', isCorrect: true },
        { id: 'opt_3', text: '5', isCorrect: false },
        { id: 'opt_4', text: '6', isCorrect: false },
      ],
      acceptedAlternatives: [],
    },
    {
      id: 'q2',
      type: 'ShortAnswer',
      text: 'Capital of France?',
      durationMs: 30000,
      multiplier: 'Standard',
      options: [],
      acceptedAlternatives: ['paris', 'باريس'],
    },
  ],
};
