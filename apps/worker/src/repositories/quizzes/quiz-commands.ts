import { resolveOwnedIdentity, requirePrivateIdentity } from '../identity.repository';
import { prepareThemeCopy } from '../theme-library.repository';
import type { AuthoringQuestion } from '@brio/contracts';
import type { SaveIdentityRequest } from '@brio/contracts';
import type { QuizDetailRecord } from './records';
import { getQuizForCreator } from './queries';
import { addQuestionToQuizInternal } from './question-commands';

export async function createQuizForCreator(
  db: D1Database,
  creatorId: string,
  title: string,
  coverImageUrl?: string | null,
  initialQuestions?: AuthoringQuestion[],
  initialIdentity?: SaveIdentityRequest,
  themeId?: string,
): Promise<QuizDetailRecord> {
  const now = new Date().toISOString();
  const quizId = crypto.randomUUID();

  if (initialIdentity && themeId) throw new Error('اختر هوية محفوظة أو أنشئ هوية جديدة.');
  if (initialIdentity || themeId) {
    const copy = themeId ? await prepareThemeCopy(db, themeId, creatorId) : null;
    const input = copy?.input ?? {
      ...initialIdentity!,
      avatarMode: 'auto' as const,
      motion: 'float' as const,
    };
    requirePrivateIdentity(input);
    const identity = copy?.identity ?? (await resolveOwnedIdentity(db, creatorId, input));
    const identityId = crypto.randomUUID();
    // D1 rolls back both inserts if either fails; no half-created quiz or identity.
    await db.batch([
      ...(copy?.statements ?? []),
      db
        .prepare(
          'INSERT INTO competition_identities(id,creator_id,name,input_json,identity_json,updated_at,visibility,design_locked,library_hidden,source_theme_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          identityId,
          creatorId,
          input.name,
          JSON.stringify(input),
          JSON.stringify(identity),
          now,
          input.visibility,
          copy?.designLocked ? 1 : 0,
          copy ? 1 : 0,
          copy && !copy.designLocked ? themeId! : null,
        ),
      db
        .prepare(
          'INSERT INTO quizzes (id,creator_id,title,cover_image_url,revision,created_at,updated_at,identity_id) VALUES(?,?,?,?,1,?,?,?)',
        )
        .bind(quizId, creatorId, title, coverImageUrl || null, now, now, identityId),
    ]);
  } else {
    await db
      .prepare(
        'INSERT INTO quizzes (id, creator_id, title, cover_image_url, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      )
      .bind(quizId, creatorId, title, coverImageUrl || null, now, now)
      .run();
  }

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
  newTitle: string,
): Promise<void> {
  const now = new Date().toISOString();
  const res = await db
    .prepare(
      'UPDATE quizzes SET title = ?, updated_at = ? WHERE id = ? AND creator_id = ? AND archived_at IS NULL',
    )
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
  coverImageUrl?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const res = await db
    .prepare(
      'UPDATE quizzes SET title = ?, cover_image_url = ?, updated_at = ? WHERE id = ? AND creator_id = ? AND archived_at IS NULL',
    )
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
