import type { QuizSummaryDto } from '@brio/contracts';
import type { QuizRecord } from './records';
import type { QuestionRecord } from './records';
import type { OptionRecord } from './records';
import type { AlternativeRecord } from './records';
import type { QuizDetailRecord } from './records';

export async function listQuizzesForCreator(db: D1Database, creatorId: string): Promise<QuizSummaryDto[]> {
  const { results } = await db
    .prepare(
      `
      SELECT q.id, q.title, q.cover_image_url as coverImageUrl, COUNT(qs.id) as questionCount, q.created_at as createdAt, q.updated_at as updatedAt
      FROM quizzes q
      LEFT JOIN questions qs ON q.id = qs.quiz_id
      WHERE q.creator_id = ? AND q.archived_at IS NULL
      GROUP BY q.id
      ORDER BY q.updated_at DESC
    `,
    )
    .bind(creatorId)
    .all<QuizSummaryDto>();

  return results || [];
}

export async function getQuizForCreator(
  db: D1Database,
  quizId: string,
  creatorId: string,
): Promise<QuizDetailRecord | null> {
  const quiz = await db
    .prepare(
      'SELECT id, creator_id, title, revision, created_at, updated_at, archived_at, cover_image_url, identity_id FROM quizzes WHERE id = ? AND creator_id = ? AND archived_at IS NULL',
    )
    .bind(quizId, creatorId)
    .first<QuizRecord>();

  if (!quiz) {
    return null; // Enforces Creator Owner Isolation on READ!
  }

  const { results: rawQuestions } = await db
    .prepare(
      `SELECT q.id, q.quiz_id, q.position, q.type, q.text, q.duration_ms, q.multiplier,
      q.media_id, m.host_url AS media_url, q.essential, q.normalization_json
      FROM questions q LEFT JOIN media m ON m.id = q.media_id
      WHERE q.quiz_id = ? ORDER BY q.position ASC`,
    )
    .bind(quizId)
    .all<QuestionRecord>();

  // Keep D1 query count constant (four reads total) regardless of question count.
  const [{ results: allOptions }, { results: allAlternatives }] = await Promise.all([
    db
      .prepare(
        `SELECT qo.id, qo.question_id, qo.position, qo.text, qo.is_correct
      FROM question_options qo JOIN questions q ON q.id = qo.question_id
      WHERE q.quiz_id = ? ORDER BY qo.question_id, qo.position`,
      )
      .bind(quizId)
      .all<OptionRecord>(),
    db
      .prepare(
        `SELECT sa.id, sa.question_id, sa.normalized_value
      FROM short_answer_alternatives sa JOIN questions q ON q.id = sa.question_id
      WHERE q.quiz_id = ? ORDER BY sa.question_id`,
      )
      .bind(quizId)
      .all<AlternativeRecord>(),
  ]);
  const optionsByQuestion = new Map<string, OptionRecord[]>();
  for (const option of allOptions || []) {
    const group = optionsByQuestion.get(option.question_id);
    if (group) group.push(option);
    else optionsByQuestion.set(option.question_id, [option]);
  }
  const alternativesByQuestion = new Map<string, string[]>();
  for (const alternative of allAlternatives || []) {
    const group = alternativesByQuestion.get(alternative.question_id);
    if (group) group.push(alternative.normalized_value);
    else alternativesByQuestion.set(alternative.question_id, [alternative.normalized_value]);
  }
  const questionsList: QuizDetailRecord['questions'] = (rawQuestions || []).map((q) => ({
    ...q,
    options: optionsByQuestion.get(q.id) || [],
    acceptedAlternatives: alternativesByQuestion.get(q.id) || [],
  }));

  return {
    ...quiz,
    questions: questionsList,
  };
}

export async function getLatestQuizVersion(
  db: D1Database,
  quizId: string,
): Promise<{ id: string; quiz_id: string; revision: number; private_snapshot_json: string } | null> {
  const row = await db
    .prepare(
      'SELECT id, quiz_id, revision, private_snapshot_json FROM quiz_versions WHERE quiz_id = ? ORDER BY revision DESC LIMIT 1',
    )
    .bind(quizId)
    .first<{ id: string; quiz_id: string; revision: number; private_snapshot_json: string }>();

  return row || null;
}
