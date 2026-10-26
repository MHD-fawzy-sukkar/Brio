import type { AuthoringQuestion } from '@brio/contracts';
import { normalizeShortAnswer } from '@brio/game-core';
import { getQuizForCreator } from './queries';
import { validateQuestionTypeRules } from './question-validation';

export async function addQuestionToQuizInternal(
  db: D1Database,
  quizId: string,
  position: number,
  q: AuthoringQuestion,
): Promise<string> {
  validateQuestionTypeRules(q);

  const questionId = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO questions (id, quiz_id, position, type, text, duration_ms, multiplier, media_id, essential, normalization_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(questionId, quizId, position, q.type, q.text, q.durationMs, q.multiplier, null, 0, null)
    .run();

  if (q.options && q.options.length > 0) {
    let optPos = 1;
    for (const opt of q.options) {
      const optId = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO question_options (id, question_id, position, text, is_correct) VALUES (?, ?, ?, ?, ?)',
        )
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
  q: AuthoringQuestion,
): Promise<string> {
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz) throw new Error('Quiz not found or unauthorized');

  const position = quiz.questions.reduce((last, question) => Math.max(last, question.position), 0) + 1;
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
  q: AuthoringQuestion,
): Promise<void> {
  validateQuestionTypeRules(q);
  const quiz = await getQuizForCreator(db, quizId, creatorId);
  if (!quiz || !quiz.questions.some((question) => question.id === questionId)) {
    throw new Error('Question not found or unauthorized');
  }

  await db
    .prepare(
      `
    UPDATE questions
    SET type = ?, text = ?, duration_ms = ?, multiplier = ?
    WHERE id = ? AND quiz_id = ?
  `,
    )
    .bind(q.type, q.text, q.durationMs, q.multiplier, questionId, quizId)
    .run();

  await db.prepare('DELETE FROM question_options WHERE question_id = ?').bind(questionId).run();
  await db.prepare('DELETE FROM short_answer_alternatives WHERE question_id = ?').bind(questionId).run();

  for (let index = 0; index < q.options.length; index++) {
    const option = q.options[index];
    await db
      .prepare(
        'INSERT INTO question_options (id, question_id, position, text, is_correct) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), questionId, index + 1, option.text, option.isCorrect ? 1 : 0)
      .run();
  }
  for (const alternative of q.acceptedAlternatives) {
    await db
      .prepare('INSERT INTO short_answer_alternatives (id, question_id, normalized_value) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), questionId, normalizeShortAnswer(alternative))
      .run();
  }

  await db
    .prepare('UPDATE quizzes SET updated_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), quizId)
    .run();
}

export async function deleteQuestionFromQuiz(
  db: D1Database,
  quizId: string,
  questionId: string,
  creatorId: string,
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
  orderedQuestionIds: string[],
): Promise<void> {
  const quiz = await db
    .prepare('SELECT id FROM quizzes WHERE id=? AND creator_id=? AND archived_at IS NULL')
    .bind(quizId, creatorId)
    .first();
  if (!quiz) throw new Error('Quiz not found or unauthorized');
  const { results } = await db
    .prepare('SELECT id FROM questions WHERE quiz_id=?')
    .bind(quizId)
    .all<{ id: string }>();
  const existing = new Set((results ?? []).map((question) => question.id));
  if (
    existing.size !== orderedQuestionIds.length ||
    new Set(orderedQuestionIds).size !== orderedQuestionIds.length ||
    orderedQuestionIds.some((id) => typeof id !== 'string' || !existing.has(id))
  )
    throw new Error('أرسل ترتيباً يحتوي كل الأسئلة مرة واحدة. حدّث الصفحة وحاول مجدداً.');
  await db.batch([
    ...orderedQuestionIds.map((id, index) =>
      db.prepare('UPDATE questions SET position=? WHERE id=? AND quiz_id=?').bind(index + 1, id, quizId),
    ),
    db
      .prepare('UPDATE quizzes SET updated_at=? WHERE id=? AND creator_id=? AND archived_at IS NULL')
      .bind(new Date().toISOString(), quizId, creatorId),
  ]);
}
