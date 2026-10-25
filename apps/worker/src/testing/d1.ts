import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';

/** Real SQLite and real migrations; only the D1 transport is adapted for integration tests. */
export function createTestDatabase(migrationCount = Infinity) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0001_initial_schema.sql', '0002_quiz_covers_and_media_columns.sql', '0003_room_lifecycle_indexes.sql', '0004_competition_identities.sql', '0005_theme_library.sql', '0006_theme_design_lock.sql'].slice(0, migrationCount)) {
    sqlite.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'));
  }
  class Statement {
    constructor(readonly sql: string, readonly args: SQLInputValue[] = []) {}
    bind(...args: SQLInputValue[]) { return new Statement(this.sql, args); }
    async first<T>(column?: string): Promise<T | null> {
      const row = sqlite.prepare(this.sql).get(...this.args);
      return (row ? column ? row[column] : row : null) as T | null;
    }
    async all<T>() { return { results: sqlite.prepare(this.sql).all(...this.args) as T[] }; }
    async run() { const info = sqlite.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(info.changes) } }; }
  }
  const db = {
    prepare(sql: string) { return new Statement(sql); },
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  } as unknown as D1Database;
  return { db, sqlite };
}
