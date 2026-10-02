import type {
  GameState,
  PublishedQuizSnapshot,
  PlayerState,
  ActiveRoundState,
  AnswerRecord
} from '@brio/game-core';

export interface SqlStorageLike {
  exec(query: string, ...bindings: any[]): any;
}

export function initRoomDbSchema(sql: SqlStorageLike): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS room_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS quiz_snapshot (
      id TEXT PRIMARY KEY,
      json_data TEXT NOT NULL
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      session_hash TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      connection_generation INTEGER NOT NULL DEFAULT 1
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      round_id TEXT PRIMARY KEY,
      question_index INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      type TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      stats_ends_at INTEGER NOT NULL,
      ranking_ends_at INTEGER NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0,
      scored INTEGER NOT NULL DEFAULT 0
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      round_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      option_id TEXT,
      text_answer TEXT,
      received_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      is_correct INTEGER,
      points_awarded INTEGER,
      PRIMARY KEY (round_id, player_id)
    );
  `);

  sql.exec(`
    CREATE TABLE IF NOT EXISTS outbox (
      job_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      next_attempt_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export function saveQuizSnapshotToDb(sql: SqlStorageLike, quiz: PublishedQuizSnapshot): void {
  sql.exec(
    'INSERT OR REPLACE INTO quiz_snapshot (id, json_data) VALUES (?, ?)',
    quiz.id,
    JSON.stringify(quiz)
  );
}

export function loadQuizSnapshotFromDb(sql: SqlStorageLike): PublishedQuizSnapshot | null {
  const cursor = sql.exec('SELECT json_data FROM quiz_snapshot LIMIT 1');
  const rows = Array.from(cursor);
  if (rows.length === 0) return null;
  const row = rows[0] as any;
  return JSON.parse(row.json_data || row[0]);
}

export function savePlayerToDb(sql: SqlStorageLike, player: PlayerState, sessionHash: string): void {
  sql.exec(
    `INSERT OR REPLACE INTO players (player_id, session_hash, nickname, avatar, joined_at, score, connection_generation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    player.id,
    sessionHash,
    player.nickname,
    player.avatarId,
    player.joinedAt,
    player.score,
    player.connectionGeneration
  );
}

export function savePlayerScoreToDb(sql: SqlStorageLike, player: PlayerState): void {
  sql.exec('UPDATE players SET score = ?, connection_generation = ? WHERE player_id = ?', player.score, player.connectionGeneration, player.id);
}

export function saveRoundToDb(sql: SqlStorageLike, round: ActiveRoundState): void {
  sql.exec(
    `INSERT OR REPLACE INTO rounds (round_id, question_index, question_id, type, starts_at, ends_at, stats_ends_at, ranking_ends_at, closed, scored)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    round.roundId,
    round.questionIndex,
    round.questionId,
    round.type,
    round.startsAt,
    round.endsAt,
    round.statsEndsAt,
    round.rankingEndsAt,
    round.closed ? 1 : 0,
    round.scored ? 1 : 0
  );
}

export function saveAnswerToDb(sql: SqlStorageLike, answer: AnswerRecord): void {
  sql.exec(
    `INSERT OR REPLACE INTO answers (round_id, player_id, submission_id, payload_digest, option_id, text_answer, received_at, status, is_correct, points_awarded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    answer.roundId,
    answer.playerId,
    answer.submissionId,
    answer.payloadDigest,
    answer.optionId || null,
    answer.textAnswer || null,
    answer.receivedAt,
    answer.status,
    answer.isCorrect !== undefined ? (answer.isCorrect ? 1 : 0) : null,
    answer.pointsAwarded !== undefined ? answer.pointsAwarded : null
  );
}

export function loadGameStateFromDb(sql: SqlStorageLike, roomId: string, quizVersionId: string): GameState {
  initRoomDbSchema(sql);

  // Load Meta
  const metaRows = Array.from(sql.exec('SELECT key, value FROM room_meta'));
  const metaMap = new Map<string, string>();
  for (const r of metaRows as any[]) {
    metaMap.set(r.key || r[0], r.value || r[1]);
  }

  const phase = (metaMap.get('phase') || 'LOBBY') as any;
  const stateVersion = parseInt(metaMap.get('stateVersion') || '1', 10);
  const currentQuestionIndex = parseInt(metaMap.get('currentQuestionIndex') || '-1', 10);
  const pausedQueued = metaMap.get('pausedQueued') === 'true';

  // Load Players
  const playerRows = Array.from(sql.exec('SELECT player_id, nickname, avatar, joined_at, score, connection_generation FROM players'));
  const players = new Map<string, PlayerState>();
  for (const r of playerRows as any[]) {
    const p: PlayerState = {
      id: r.player_id || r[0],
      nickname: r.nickname || r[1],
      avatarId: r.avatar || r[2],
      joinedAt: typeof r.joined_at === 'number' ? r.joined_at : parseInt(r[3], 10),
      score: typeof r.score === 'number' ? r.score : parseInt(r[4], 10),
      connectionGeneration: typeof r.connection_generation === 'number' ? r.connection_generation : parseInt(r[5], 10)
    };
    players.set(p.id, p);
  }

  // Load Active Round
  const roundRows = Array.from(sql.exec('SELECT round_id, question_index, question_id, type, starts_at, ends_at, stats_ends_at, ranking_ends_at, closed, scored FROM rounds ORDER BY starts_at DESC LIMIT 1'));
  let activeRound: ActiveRoundState | null = null;
  if (roundRows.length > 0) {
    const r = roundRows[0] as any;
    activeRound = {
      roundId: r.round_id || r[0],
      questionIndex: typeof r.question_index === 'number' ? r.question_index : parseInt(r[1], 10),
      questionId: r.question_id || r[2],
      type: r.type || r[3],
      startsAt: typeof r.starts_at === 'number' ? r.starts_at : parseInt(r[4], 10),
      endsAt: typeof r.ends_at === 'number' ? r.ends_at : parseInt(r[5], 10),
      statsEndsAt: typeof r.stats_ends_at === 'number' ? r.stats_ends_at : parseInt(r[6], 10),
      rankingEndsAt: typeof r.ranking_ends_at === 'number' ? r.ranking_ends_at : parseInt(r[7], 10),
      closed: (r.closed || r[8]) === 1,
      scored: (r.scored || r[9]) === 1
    };
  }

  // Load Answers
  const answerRows = Array.from(sql.exec('SELECT round_id, player_id, submission_id, payload_digest, option_id, text_answer, received_at, status, is_correct, points_awarded FROM answers'));
  const answers = new Map<string, AnswerRecord>();
  const submissionIds = new Set<string>();

  for (const r of answerRows as any[]) {
    const ans: AnswerRecord = {
      roundId: r.round_id || r[0],
      playerId: r.player_id || r[1],
      submissionId: r.submission_id || r[2],
      payloadDigest: r.payload_digest || r[3],
      optionId: r.option_id || r[4] || undefined,
      textAnswer: r.text_answer || r[5] || undefined,
      receivedAt: typeof r.received_at === 'number' ? r.received_at : parseInt(r[6], 10),
      status: r.status || r[7],
      isCorrect: (r.is_correct || r[8]) !== null ? (r.is_correct || r[8]) === 1 : undefined,
      pointsAwarded: (r.points_awarded || r[9]) !== null ? (r.points_awarded || r[9]) : undefined
    };
    answers.set(`${ans.roundId}:${ans.playerId}`, ans);
    submissionIds.add(ans.submissionId);
  }

  return {
    roomId,
    quizVersionId,
    phase,
    stateVersion,
    currentQuestionIndex,
    activeRound,
    players,
    answers,
    submissionIds,
    pausedQueued,
    interruptedRoundId: null
  };
}

export function saveRoomMetaToDb(sql: SqlStorageLike, state: GameState): void {
  sql.exec('INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)', 'phase', state.phase);
  sql.exec('INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)', 'stateVersion', state.stateVersion.toString());
  sql.exec('INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)', 'currentQuestionIndex', state.currentQuestionIndex.toString());
  sql.exec('INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)', 'pausedQueued', state.pausedQueued ? 'true' : 'false');
}
