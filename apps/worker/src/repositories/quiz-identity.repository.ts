import type { IdentityRecordDto, SaveIdentityRequest } from '@brio/contracts';
import { IdentityError } from '../identities/identity-error';
import { getIdentity, resolveOwnedIdentity } from './identity.repository';

async function ownedQuiz(db: D1Database, quizId: string, creatorId: string) {
  const quiz = await db
    .prepare('SELECT identity_id FROM quizzes WHERE id=? AND creator_id=? AND archived_at IS NULL')
    .bind(quizId, creatorId)
    .first<{ identity_id: string | null }>();
  if (!quiz) throw new IdentityError('المسابقة غير موجودة أو لا تخص حسابك.', 404);
  return quiz;
}

export async function getQuizIdentity(
  db: D1Database,
  quizId: string,
  creatorId: string,
): Promise<IdentityRecordDto | null> {
  const quiz = await ownedQuiz(db, quizId, creatorId);
  return quiz.identity_id ? getIdentity(db, quiz.identity_id, creatorId) : null;
}

/** Save a fresh revision and attach it atomically. Other quizzes and running rooms keep their copy. */
export async function saveQuizIdentity(
  db: D1Database,
  quizId: string,
  creatorId: string,
  input: SaveIdentityRequest,
): Promise<IdentityRecordDto> {
  if ((await getQuizIdentity(db, quizId, creatorId))?.designLocked)
    throw new IdentityError('الهوية العامة للاستخدام فقط. يمكنك اختيار هوية أخرى دون تعديل تصميمها.', 403);
  // Competition edits always produce a private revision, never a library publication.
  input = { ...input, visibility: 'private', publishConfirmed: false };
  const identity = await resolveOwnedIdentity(db, creatorId, input);
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM quizzes WHERE id=? AND creator_id=? AND archived_at IS NULL)`,
      )
      .bind(
        id,
        creatorId,
        input.name,
        JSON.stringify(input),
        JSON.stringify(identity),
        now,
        input.visibility,
        quizId,
        creatorId,
      ),
    db
      .prepare(
        'UPDATE quizzes SET identity_id=?,updated_at=? WHERE id=? AND creator_id=? AND archived_at IS NULL',
      )
      .bind(id, now, quizId, creatorId),
  ]);
  if (!results[1].meta.changes) throw new IdentityError('المسابقة لم تعد متاحة.', 404);
  return { ...input, id, identity };
}
