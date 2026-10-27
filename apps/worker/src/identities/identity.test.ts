import test from 'node:test';
import assert from 'node:assert/strict';
import { type IdentityRecordDto } from '@brio/contracts';
import { createQuizForCreator } from '../repositories/quiz.repository';
import { getIdentity } from '../repositories/identity.repository';
import { source, setup } from './testing-fixtures';

test('library is owner-only even for legacy public rows and publication endpoint is removed', async () => {
  const { call, sqlite, input } = await setup();
  try {
    assert.equal((await call('/themes', 'GET', undefined, '')).status, 401);
    const theme = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    // Existing public rows must stop being discoverable without changing saved competitions.
    sqlite.prepare("UPDATE competition_identities SET visibility='public' WHERE id=?").run(theme.id);
    const own = (await (await call('/themes')).json()) as Array<{
      id: string;
      owned: boolean;
      visibility: string;
    }>;
    assert.deepEqual(
      own.map(({ id, owned, visibility }) => ({ id, owned, visibility })),
      [{ id: theme.id, owned: true, visibility: 'private' }],
    );
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    assert.deepEqual(await (await call('/identities', 'GET', undefined, 'other')).json(), []);
    for (const visibility of ['public', 'private']) {
      assert.equal(
        (await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility, confirmed: true })).status,
        404,
      );
    }
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Foreign theme', identityId: theme.id }, 'other')).status,
      400,
    );
    const foreignQuiz = (await (
      await call('/quizzes', 'POST', { title: 'Foreign studio' }, 'other')
    ).json()) as { id: string };
    assert.equal(
      (await call(`/quizzes/${foreignQuiz.id}/identity`, 'PUT', { identityId: theme.id }, 'other')).status,
      404,
    );
    assert.equal(
      sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(foreignQuiz.id)!.identity_id,
      null,
    );
  } finally {
    sqlite.close();
  }
});

test('public publication is rejected even with prior confirmation and owned legacy edits save privately', async () => {
  const { call, sqlite, input, db } = await setup();
  try {
    for (const publishConfirmed of [false, true]) {
      const publicInput = { ...input, visibility: 'public', publishConfirmed };
      assert.equal((await call('/identities', 'POST', publicInput)).status, 400);
      assert.equal(
        (await call('/quizzes', 'POST', { title: 'Publishing', identity: publicInput })).status,
        400,
      );
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n, 0);
    const theme = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    sqlite.prepare("UPDATE competition_identities SET visibility='public' WHERE id=?").run(theme.id);
    const restored = (await getIdentity(db, theme.id, 'owner'))!;
    assert.equal(restored.visibility, 'private');
    assert.equal(restored.publishConfirmed, false);
    assert.equal(
      (
        await call(`/identities/${theme.id}`, 'PUT', {
          ...input,
          visibility: 'public',
          publishConfirmed: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (await call(`/identities/${theme.id}`, 'PUT', { ...restored, name: 'Updated privately' })).status,
      200,
    );
    assert.equal(
      sqlite.prepare('SELECT visibility FROM competition_identities WHERE id=?').get(theme.id)!.visibility,
      'private',
    );
  } finally {
    sqlite.close();
  }
});

test('owned library reuse preserves colors and independent asset references with atomic rollback', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const original = (await (
      await call('/identities', 'POST', { ...input, accent: '#Ab12EF' })
    ).json()) as IdentityRecordDto;
    assert.equal(original.accent, '#ab12ef');
    const quiz = await createQuizForCreator(db, 'owner', 'Custom color', null, [], undefined, original.id);
    const copy = (await getIdentity(db, quiz.identity_id!, 'owner'))!;
    assert.equal(copy.identity.accent, '#ab12ef');
    assert.equal(copy.designLocked, false);
    assert.notEqual(copy.images[0].mediaId, original.images[0].mediaId);
    assert.equal(copy.identity.logo?.src, source);
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n;
    sqlite.exec(
      "CREATE TRIGGER fail_theme_copy BEFORE INSERT ON quizzes BEGIN SELECT RAISE(ABORT, 'copy failure'); END",
    );
    await assert.rejects(
      createQuizForCreator(db, 'owner', 'Rollback', null, [], undefined, original.id),
      /copy failure/,
    );
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n, count);
    assert.equal(
      (await call('/identities', 'POST', { ...input, accent: 'url(https://example.test)' })).status,
      400,
    );
  } finally {
    sqlite.close();
  }
});

test('existing locked competition snapshots remain readable and retain design protection', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const quiz = await createQuizForCreator(db, 'owner', 'Existing copy', null, [], input);
    sqlite
      .prepare('UPDATE competition_identities SET design_locked=1,library_hidden=1 WHERE id=?')
      .run(quiz.identity_id);
    sqlite.prepare('UPDATE identity_assets SET design_locked=1').run();
    const existing = (await getIdentity(db, quiz.identity_id!, 'owner'))!;
    assert.equal(existing.identity.logo?.src, source);
    assert.equal(existing.designLocked, true);
    assert.equal(
      (await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...input, name: 'Changed' })).status,
      403,
    );
    assert.equal((await call(`/identities/${existing.id}`, 'PUT', input)).status, 403);
    assert.equal((await call('/identities', 'POST', input)).status, 400);
    assert.deepEqual(await (await call('/themes')).json(), []);
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: null })).status, 200);
    assert.deepEqual(await (await call(`/quizzes/${quiz.id}/identity`)).json(), { record: null });
  } finally {
    sqlite.close();
  }
});

test('quiz creation saves its theme immediately, validates ownership and rolls back a failed insert', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const response = await call('/quizzes', 'POST', { title: 'Themed quiz', identity: input });
    assert.equal(response.status, 201);
    const quiz = (await response.json()) as { id: string; identity_id: string };
    assert.ok(quiz.identity_id);
    const saved = await getIdentity(db, quiz.identity_id, 'owner');
    assert.equal(saved?.avatarMode, 'auto');
    assert.equal(saved?.motion, 'float');
    assert.equal(saved?.identity.logo?.src, source);
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Invalid ownership', identity: input }, 'other')).status,
      400,
    );
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Empty theme', identity: { ...input, images: [] } })).status,
      400,
    );
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM quizzes').get()!.n, 1);
    const identities = sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n;
    sqlite.exec(
      "CREATE TRIGGER fail_quiz_creation BEFORE INSERT ON quizzes BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    await assert.rejects(createQuizForCreator(db, 'owner', 'Rollback', null, [], input), /forced failure/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n, identities);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM quizzes').get()!.n, 1);
  } finally {
    sqlite.close();
  }
});
