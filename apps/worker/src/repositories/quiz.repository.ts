import type {
  AuthoringQuestion,
  AuthoringQuestionOption,
  QuestionType,
  PointsMultiplier,
  QuizSummaryDto
} from '@brio/contracts';
import { normalizeShortAnswer } from '@brio/game-core';

export interface QuizRecord {
  id: string;
  creator_id: string;
  title: string;
  revision: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  cover_image_url: string | null;
}

export interface QuestionRecord {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  text: string;
  duration_ms: number;
  multiplier: PointsMultiplier;
  media_id: string | null;
  media_url: string | null;
  essential: number;
  normalization_json: string | null;
}

export interface OptionRecord {
  id: string;
  question_id: string;
  position: number;
  text: string;
  is_correct: number;
}

export interface AlternativeRecord {
  id: string;
  question_id: string;
  normalized_value: string;
}

export interface QuizDetailRecord extends QuizRecord {
  questions: Array<
    QuestionRecord & {
      options: OptionRecord[];
      acceptedAlternatives: string[];
    }
  >;
}

export async function listQuizzesForCreator(db: D1Database, creatorId: string): Promise<QuizSummaryDto[]> {
  const { results } = await db
    .prepare(`
      SELECT q.id, q.title, q.cover_image_url as coverImageUrl, COUNT(qs.id) as questionCount, q.created_at as createdAt, q.updated_at as updatedAt
      FROM quizzes q
      LEFT JOIN questions qs ON q.id = qs.quiz_id
      WHERE q.creator_id = ? AND q.archived_at IS NULL
      GROUP BY q.id
      ORDER BY q.updated_at DESC
    `)
    .bind(creatorId)
    .all<QuizSummaryDto>();

  return results || [];
}

export async function getQuizForCreator(
  db: D1Database,
  quizId: string,
  creatorId: string
): Promise<QuizDetailRecord | null> {
  const quiz = await db
    .prepare('SELECT id, creator_id, title, revision, created_at, updated_at, archived_at, cover_image_url FROM quizzes WHERE id = ? AND creator_id = ? AND archived_at IS NULL')
    .bind(quizId, creatorId)
    .first<QuizRecord>();

  if (!quiz) {
    return null; // Enforces Creator Owner Isolation on READ!
  }

  const { results: rawQuestions } = await db
    .prepare(`SELECT q.id, q.quiz_id, q.position, q.type, q.text, q.duration_ms, q.multiplier,
      q.media_id, m.host_url AS media_url, q.essential, q.normalization_json
      FROM questions q LEFT JOIN media m ON m.id = q.media_id
      WHERE q.quiz_id = ? ORDER BY q.position ASC`)
    .bind(quizId)
    .all<QuestionRecord>();

  const questionsList: QuizDetailRecord['questions'] = [];

  for (const q of rawQuestions || []) {
    const { results: options } = await db
      .prepare('SELECT id, question_id, position, text, is_correct FROM question_options WHERE question_id = ? ORDER BY position ASC')
      .bind(q.id)
      .all<OptionRecord>();

    const { results: alts } = await db
      .prepare('SELECT normalized_value FROM short_answer_alternatives WHERE question_id = ?')
      .bind(q.id)
      .all<AlternativeRecord>();

    questionsList.push({
      ...q,
      options: options || [],
      acceptedAlternatives: (alts || []).map((a) => a.normalized_value)
    });
  }

  return {
    ...quiz,
    questions: questionsList
  };
}

export async function createQuizForCreator(
  db: D1Database,
  creatorId: string,
  title: string,
  coverImageUrl?: string | null,
  initialQuestions?: AuthoringQuestion[]
): Promise<QuizDetailRecord> {
  const now = new Date().toISOString();
  const quizId = crypto.randomUUID();

  await db
    .prepare('INSERT INTO quizzes (id, creator_id, title, cover_image_url, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
    .bind(quizId, creatorId, title, coverImageUrl || null, now, now)
    .run();

  if (initialQuestions && initialQuestions.length > 0) {
    let pos = 1;
    for (const q of initialQuestions) {
      await addQuestionToQuizInternal(db, quizId, pos++, q);
    }
  }

  const created = await getQuizForCreator(db, quizId, creatorId);
  if (!created) throw new Error('Failed to retrieve newly created quiz');
  return created;
}

export async function updateQuizTitle(
  db: D1Database,
  quizId: string,
  creatorId: string,
  newTitle: string
): Promise<void> {
  const now = new Date().toISOString();
  const res = await db
    .prepare('UPDATE quizzes SET title = ?, updated_at = ? WHERE id = ? AND creator_id = ? AND archived_at IS NULL')
    .bind(newTitle, now, quizId, creatorId)
    .run();

  if (res.meta.changes === 0) {
    throw new Error('Quiz not found or unauthorized');
  }
}

export async function updateQuizDetails(
  db: D1Database,
  quizId: string,
  creatorId: string,
  title: string,
  coverImageUrl?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const res = await db
    .prepare('UPDATE quizzes SET title = ?, cover_image_url = ?, updated_at = ? WHERE id = ? AND creator_id = ? AND archived_at IS NULL')
    .bind(title, coverImageUrl || null, now, quizId, creatorId)
    .run();
  if (res.meta.changes === 0) throw new Error('Quiz not found or unauthorized');
}

export async function deleteQuizForCreator(db: D1Database, quizId: string, creatorId: string): Promise<void> {
  const now = new Date().toISOString();
  const res = await db
    .prepare('UPDATE quizzes SET archived_at = ? WHERE id = ? AND creator_id = ?')
    .bind(now, quizId, creatorId)
    .run();

  if (res.meta.changes === 0) {
    throw new Error('Quiz not found or unauthorized');
  }
}

/**
 * Validates question specifications according to domain rules for all 4 question types
 */
export function validateQuestionTypeRules(q: AuthoringQuestion): void {
  if (q.durationMs < 10000 || q.durationMs > 120000) {
    throw new Error('Question duration must be between 10 and 120 seconds (10,000ms - 120,000ms)');
  }

  switch (q.type) {
    case 'MultipleChoice': {
      if (!q.options || q.options.length < 2) {
        throw new Error('MultipleChoice questions must have at least 2 options');
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new Error('MultipleChoice questions must have exactly 1 correct option');
      }
      break;
    }
    case 'TrueFalse': {
      if (!q.options || q.options.length !== 2) {
        throw new Error('TrueFalse questions must have exactly 2 options');
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new Error('TrueFalse questions must have exactly 1 correct option');
      }
      break;
    }
    case 'Poll': {
      if (!q.options || q.options.length < 2) {
        throw new Error('Poll questions must have at least 2 options');
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 0) {
        throw new Error('Poll questions must not have any correct options marked');
      }
      break;
    }
    case 'ShortAnswer': {
      if (!q.acceptedAlternatives || q.acceptedAlternatives.length < 1) {
        throw new Error('ShortAnswer questions must have at least 1 explicit accepted alternative');
      }
      break;
    }
    default:
      throw new Error(`Unsupported question type: ${q.type}`);
  }
}

async function addQuestionToQuizInternal(
  db: D1Database,
  quizId: string,
  position: number,
  q: AuthoringQuestion
): Promise<string> {
  validateQuestionTypeRules(q);

  const questionId = crypto.randomUUID();
  await db
    .prepare(`
      INSERT INTO questions (id, quiz_id, position, type, text, duration_ms, multiplier, media_id, essential, normalization_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      questionId,
      quizId,
      position,
      q.type,
      q.text,
      q.durationMs,
      q.multiplier,
      null,
      0,
      null
    )
    .run();

  if (q.options && q.options.length > 0) {
    let optPos = 1;
    for (const opt of q.options) {
      const optId = crypto.randomUUID();
      await db
        .prepare('INSERT INTO question_options (id, question_id, position, text, is_correct) VALUES (?, ?, ?, ?, ?)')
        .bind(optId, questionId, optPos++, opt.text, opt.isCorrect ? 1 : 0)
        .run();
    }
  }

  if (q.acceptedAlternatives && q.acceptedAlternatives.length > 0) {
    for (const altText of q.acceptedAlternatives) {
      const altId = crypto.randomUUID();
      const normVal = normalizeShortAnswer(altText);
      await db
        .prepare('INSERT INTO short_answer_alternatives (id, question_id, normalized_value) VALUES (?, ?, ?)')
        .bind(altId, questionId, normVal)
        .run();
    }
  }

  return questionId;
}

export async function addQuestionToQuiz(
  db: D1Database,
  quizId: string,
  creatorId: string,
  q: AuthoringQuestion
): Promise<string> {
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz) throw new Error('Quiz not found or unauthorized');

  const position = quiz.questions.length + 1;
  const questionId = await addQuestionToQuizInternal(db, quizId, position, q);

  const now = new Date().toISOString();
  await db.prepare('UPDATE quizzes SET updated_at = ? WHERE id = ?').bind(now, quizId).run();

  return questionId;
}

export async function updateQuestionInQuiz(
  db: D1Database,
  quizId: string,
  questionId: string,
  creatorId: string,
  q: AuthoringQuestion
): Promise<void> {
  validateQuestionTypeRules(q);
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz || !quiz.questions.some((question) => question.id === questionId)) {
    throw new Error('Question not found or unauthorized');
  }

  await db.prepare(`
    UPDATE questions
    SET type = ?, text = ?, duration_ms = ?, multiplier = ?
    WHERE id = ? AND quiz_id = ?
  `).bind(q.type, q.text, q.durationMs, q.multiplier, questionId, quizId).run();

  await db.prepare('DELETE FROM question_options WHERE question_id = ?').bind(questionId).run();
  await db.prepare('DELETE FROM short_answer_alternatives WHERE question_id = ?').bind(questionId).run();

  for (let index = 0; index < q.options.length; index++) {
    const option = q.options[index];
    await db.prepare('INSERT INTO question_options (id, question_id, position, text, is_correct) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), questionId, index + 1, option.text, option.isCorrect ? 1 : 0).run();
  }
  for (const alternative of q.acceptedAlternatives) {
    await db.prepare('INSERT INTO short_answer_alternatives (id, question_id, normalized_value) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), questionId, normalizeShortAnswer(alternative)).run();
  }

  await db.prepare('UPDATE quizzes SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), quizId).run();
}

export async function deleteQuestionFromQuiz(
  db: D1Database,
  quizId: string,
  questionId: string,
  creatorId: string
): Promise<void> {
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz) throw new Error('Quiz not found or unauthorized');

  await db.prepare('DELETE FROM questions WHERE id = ? AND quiz_id = ?').bind(questionId, quizId).run();

  const now = new Date().toISOString();
  await db.prepare('UPDATE quizzes SET updated_at = ? WHERE id = ?').bind(now, quizId).run();
}

export async function reorderQuizQuestions(
  db: D1Database,
  quizId: string,
  creatorId: string,
  orderedQuestionIds: string[]
): Promise<void> {
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz) throw new Error('Quiz not found or unauthorized');

  const existingIds = quiz.questions.map((q) => q.id);
  if (existingIds.length !== orderedQuestionIds.length) {
    throw new Error('Reorder list must contain all existing question IDs');
  }

  const existingSet = new Set(existingIds);
  for (const id of orderedQuestionIds) {
    if (!existingSet.has(id)) {
      throw new Error(`Invalid or missing question ID: ${id}`);
    }
  }

  let pos = 1;
  for (const id of orderedQuestionIds) {
    await db.prepare('UPDATE questions SET position = ? WHERE id = ? AND quiz_id = ?').bind(pos++, id, quizId).run();
  }

  const now = new Date().toISOString();
  await db.prepare('UPDATE quizzes SET updated_at = ? WHERE id = ?').bind(now, quizId).run();
}

export async function publishQuizVersion(
  db: D1Database,
  quizId: string,
  creatorId: string
): Promise<{ versionId: string; revision: number; contentHash: string }> {
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz) throw new Error('Quiz not found or unauthorized');

  if (quiz.questions.length === 0) {
    throw new Error('Cannot publish an empty quiz with 0 questions');
  }

  for (const q of quiz.questions) {
    validateQuestionTypeRules({
      type: q.type,
      text: q.text,
      durationMs: q.duration_ms,
      multiplier: q.multiplier,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.is_correct === 1 })),
      acceptedAlternatives: q.acceptedAlternatives
    });
  }

  const newRevision = quiz.revision + 1;
  const privateSnapshot = {
    id: quiz.id,
    title: quiz.title,
    coverImageUrl: quiz.cover_image_url,
    revision: newRevision,
    publishedAt: new Date().toISOString(),
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      durationMs: q.duration_ms,
      multiplier: q.multiplier,
      essentialImage: q.media_url,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.is_correct === 1
      })),
      acceptedAlternatives: q.acceptedAlternatives
    }))
  };

  const snapshotJson = JSON.stringify(privateSnapshot);

  // Compute Content SHA-256 Hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshotJson));
  const contentHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const versionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare('INSERT INTO quiz_versions (id, quiz_id, revision, private_snapshot_json, content_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(versionId, quizId, newRevision, snapshotJson, contentHash, now)
    .run();

  await db
    .prepare('UPDATE quizzes SET revision = ?, updated_at = ? WHERE id = ?')
    .bind(newRevision, now, quizId)
    .run();

  return {
    versionId,
    revision: newRevision,
    contentHash
  };
}

export async function getLatestQuizVersion(
  db: D1Database,
  quizId: string
): Promise<{ id: string; quiz_id: string; revision: number; private_snapshot_json: string } | null> {
  const row = await db
    .prepare('SELECT id, quiz_id, revision, private_snapshot_json FROM quiz_versions WHERE quiz_id = ? ORDER BY revision DESC LIMIT 1')
    .bind(quizId)
    .first<{ id: string; quiz_id: string; revision: number; private_snapshot_json: string }>();

  return row || null;
}
