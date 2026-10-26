import { quizIdentity } from '../identity.repository';
import { getQuizForCreator } from './queries';
import { validateQuestionTypeRules } from './question-validation';

export async function publishQuizVersion(
  db: D1Database,
  quizId: string,
  creatorId: string,
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
      acceptedAlternatives: q.acceptedAlternatives,
    });
  }

  const newRevision = quiz.revision + 1;
  const privateSnapshot = {
    id: quiz.id,
    title: quiz.title,
    coverImageUrl: quiz.cover_image_url,
    revision: newRevision,
    identity: await quizIdentity(db, quiz.identity_id, creatorId),
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
        isCorrect: o.is_correct === 1,
      })),
      acceptedAlternatives: q.acceptedAlternatives,
    })),
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
    .prepare(
      'INSERT INTO quiz_versions (id, quiz_id, revision, private_snapshot_json, content_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(versionId, quizId, newRevision, snapshotJson, contentHash, now)
    .run();

  await db
    .prepare('UPDATE quizzes SET revision = ?, updated_at = ? WHERE id = ?')
    .bind(newRevision, now, quizId)
    .run();

  return {
    versionId,
    revision: newRevision,
    contentHash,
  };
}
