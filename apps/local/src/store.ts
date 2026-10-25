import { identityImageSources } from '@brio/contracts';
import { DatabaseSync } from 'node:sqlite';
import { createInitialGameState, type GameState, type PublishedQuizSnapshot } from '@brio/game-core';
import { randomInt, randomUUID } from 'node:crypto';
import { validateBundle } from './bundle';

export interface Room { id: string; code: string; quiz: PublishedQuizSnapshot; state: GameState; sessions: Map<string, string> }
export function encodeRoom(room: Room): string {
  return JSON.stringify({ ...room, sessions: [...room.sessions], state: { ...room.state,
    players: [...room.state.players], answers: [...room.state.answers], submissionIds: [...room.state.submissionIds] } });
}
export function decodeRoom(json: string): Room {
  const room = JSON.parse(json);
  room.sessions = new Map(room.sessions);
  room.state.players = new Map(room.state.players);
  room.state.answers = new Map(room.state.answers);
  room.state.submissionIds = new Set(room.state.submissionIds);
  return room;
}

export class LocalStore {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS local_schema(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO local_schema VALUES(1);
      CREATE TABLE IF NOT EXISTS quizzes(id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media(hash TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, json TEXT NOT NULL);`);
  }
  importBundle(input: unknown) {
    const { quiz, media } = validateBundle(input);
    this.transaction(() => {
      for (const image of media) this.db.prepare('INSERT OR IGNORE INTO media VALUES(?,?,?)').run(image.sha256, image.contentType, image.bytes);
      this.db.prepare('INSERT OR REPLACE INTO quizzes VALUES(?,?)').run(quiz.id, JSON.stringify(quiz));
    });
    return { id: quiz.id, title: quiz.title, questionCount: quiz.questions.length, imageCount: media.length };
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = action(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  listQuizzes() {
    return this.db.prepare('SELECT json FROM quizzes').all().map(row => {
      const q = JSON.parse(row.json as string) as PublishedQuizSnapshot;
      return { id: q.id, title: q.title, questionCount: q.questions.length };
    });
  }
  deleteQuiz(id: string): boolean {
    return this.transaction(() => {
      const removed = this.db.prepare('DELETE FROM quizzes WHERE id=?').run(id).changes > 0;
      if (removed) this.pruneMedia();
      return removed;
    });
  }
  deleteRoom(id: string): boolean {
    return this.transaction(() => {
      const removed = this.db.prepare('DELETE FROM rooms WHERE id=?').run(id).changes > 0;
      if (removed) this.pruneMedia();
      return removed;
    });
  }
  private pruneMedia() {
    // Completed rooms keep their frozen quiz and images even after removing the imported quiz.
    const used = new Set<string>();
    const retain = (quiz: PublishedQuizSnapshot) => {
      for (const src of [...quiz.questions.map(question => question.essentialImage), ...identityImageSources(quiz.identity)]) {
        const match = src?.match(/^\/media\/([a-f0-9]{64})$/);
        if (match) used.add(match[1]);
      }
    };
    for (const row of this.db.prepare('SELECT json FROM quizzes').all()) retain(JSON.parse(row.json as string));
    for (const room of this.listRooms()) retain(room.quiz);
    const remove = this.db.prepare('DELETE FROM media WHERE hash=?');
    for (const row of this.db.prepare('SELECT hash FROM media').all()) {
      if (!used.has(row.hash as string)) remove.run(row.hash as string);
    }
  }
  createRoom(quizId: string): Room {
    const row = this.db.prepare('SELECT json FROM quizzes WHERE id=?').get(quizId);
    if (!row) throw new Error('Quiz not found');
    const quiz: PublishedQuizSnapshot = JSON.parse(row.json as string);
    let code: string;
    do { code = String(randomInt(100000, 1000000)); } while (this.db.prepare('SELECT 1 FROM rooms WHERE code=?').get(code));
    const id = randomUUID();
    const room = { id, code, quiz: { ...quiz, roomCode: code }, state: createInitialGameState(id, quiz.id), sessions: new Map<string, string>() };
    this.save(room);
    return room;
  }
  save(room: Room) { this.db.prepare('INSERT OR REPLACE INTO rooms VALUES(?,?,?)').run(room.id, room.code, encodeRoom(room)); }
  load(id: string): Room | null {
    const row = this.db.prepare('SELECT json FROM rooms WHERE id=?').get(id);
    return row ? decodeRoom(row.json as string) : null;
  }
  listRooms(): Room[] { return this.db.prepare('SELECT json FROM rooms').all().map(row => decodeRoom(row.json as string)); }
  close() { this.db.close(); }
}
