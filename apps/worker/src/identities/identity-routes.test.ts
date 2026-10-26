import test from 'node:test';
import assert from 'node:assert/strict';
import { type IdentityRecordDto } from '@brio/contracts';
import {
  publishQuizVersion,
  createQuizForCreator,
  getLatestQuizVersion,
} from '../repositories/quiz.repository';
import { getIdentity } from '../repositories/identity.repository';
import { saveQuizIdentity } from '../repositories/quiz-identity.repository';
import { source, setup } from './testing-fixtures';
test('identity routes enforce auth, origin, asset ownership and creator isolation without capturing public routes', async () => {
  const { sqlite, call, input } = await setup();
  try {
    assert.equal((await call('/health', 'GET', undefined, '')).status, 200);
    assert.equal((await call('/identities', 'GET', undefined, '')).status, 401);
    assert.equal((await call('/identities', 'POST', input, 'owner', 'https://attacker.invalid')).status, 403);
    assert.equal((await call('/identities', 'POST', input, 'other')).status, 400);
    const response = await call('/identities', 'POST', input);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const record = (await response.json()) as IdentityRecordDto;
    assert.equal(record.identity.logo?.src, source);
    assert.deepEqual(await (await call('/identities', 'GET', undefined, 'other')).json(), []);
    assert.equal((await call(`/identities/${record.id}`, 'PUT', input, 'other')).status, 404);
    assert.equal((await call(`/identities/${record.id}`, 'DELETE', undefined, 'other')).status, 404);
    assert.equal((await call('/identities', 'POST', { ...input, images: [] })).status, 400);
    assert.equal(
      (await call('/identity-assets/signature', 'POST', { byteSize: 10, mimeType: 'image/svg+xml' })).status,
      400,
    );
    assert.equal(
      (await call('/identity-assets/signature', 'POST', { byteSize: 10, mimeType: 'image/png' })).status,
      409,
    );
  } finally {
    sqlite.close();
  }
});

test('quiz assignment is owner-scoped; published identities remain immutable after edit and archive', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const record = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    const quiz = await createQuizForCreator(db, 'owner', 'Quiz', undefined, [
      {
        type: 'Poll',
        text: 'Choose',
        durationMs: 10000,
        multiplier: 'Zero',
        options: [
          { text: 'A', isCorrect: false },
          { text: 'B', isCorrect: false },
        ],
        acceptedAlternatives: [],
      },
    ]);
    assert.equal(
      (await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: record.id }, 'other')).status,
      404,
    );
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: record.id })).status, 200);
    await publishQuizVersion(db, quiz.id, 'owner');
    const frozen = JSON.parse((await getLatestQuizVersion(db, quiz.id))!.private_snapshot_json);
    assert.equal(frozen.identity.name, 'Team');
    assert.equal((await call(`/identities/${record.id}`, 'PUT', { ...input, name: 'Changed' })).status, 200);
    assert.equal((await getIdentity(db, record.id, 'owner'))?.name, 'Changed');
    assert.equal(
      JSON.parse((await getLatestQuizVersion(db, quiz.id))!.private_snapshot_json).identity.name,
      'Team',
    );
    assert.equal((await call(`/identities/${record.id}`, 'DELETE')).status, 200);
    assert.equal(
      sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(quiz.id)?.identity_id,
      null,
    );
    assert.equal(
      JSON.parse((await getLatestQuizVersion(db, quiz.id))!.private_snapshot_json).identity.logo.src,
      source,
    );
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: record.id })).status, 404);
  } finally {
    sqlite.close();
  }
});

test('creating and editing inside a quiz saves and assigns atomically, always flies and leaves other quizzes unchanged', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const quiz = await createQuizForCreator(db, 'owner', 'Quiz');
    assert.deepEqual(await (await call(`/quizzes/${quiz.id}/identity`)).json(), { record: null });
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'POST', input, 'other')).status, 404);
    const firstResponse = await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...input, motion: 'still' });
    assert.equal(firstResponse.status, 201);
    const first = (await firstResponse.json()) as IdentityRecordDto;
    assert.equal(first.motion, 'float');
    assert.equal(first.identity.character.kind === 'image' && first.identity.character.motion, 'float');
    const otherQuiz = await createQuizForCreator(db, 'owner', 'Other quiz');
    await call(`/quizzes/${otherQuiz.id}/identity`, 'PUT', { identityId: first.id });
    const second = (await (
      await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...input, name: 'Changed' })
    ).json()) as IdentityRecordDto;
    assert.notEqual(second.id, first.id);
    assert.equal(
      ((await (await call(`/quizzes/${quiz.id}/identity`)).json()) as { record: IdentityRecordDto }).record
        .name,
      'Changed',
    );
    assert.equal(
      ((await (await call(`/quizzes/${otherQuiz.id}/identity`)).json()) as { record: IdentityRecordDto })
        .record.name,
      'Team',
    );
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n;
    sqlite.exec(
      "CREATE TRIGGER fail_identity_assignment BEFORE UPDATE OF identity_id ON quizzes BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    await assert.rejects(saveQuizIdentity(db, quiz.id, 'owner', input), /forced failure/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n, count);
    assert.equal(
      sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(quiz.id)!.identity_id,
      second.id,
    );
  } finally {
    sqlite.close();
  }
});

test('a missing identity migration returns a setup error instead of a save error or an empty list', async () => {
  const { sqlite, call } = await setup();
  try {
    sqlite.exec('DROP TABLE competition_identities');
    const response = await call('/identities');
    assert.equal(response.status, 503);
    assert.equal(((await response.json()) as { code: string }).code, 'identity_setup_required');
  } finally {
    sqlite.close();
  }
});
