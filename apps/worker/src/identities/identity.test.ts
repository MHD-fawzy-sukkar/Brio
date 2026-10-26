import test from 'node:test';
import assert from 'node:assert/strict';
import { type IdentityRecordDto } from '@brio/contracts';
import { createQuizForCreator } from '../repositories/quiz.repository';
import { getIdentity } from '../repositories/identity.repository';
import { source, setup } from './testing-fixtures';
test('theme library keeps drafts private and only the owner can publish or unpublish', async () => {
  const { call, sqlite, input } = await setup();
  try {
    assert.equal((await call('/themes', 'GET', undefined, '')).status, 401);
    const theme = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    assert.equal(theme.visibility, 'private');
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    assert.equal(
      (
        await call(
          `/themes/${theme.id}/visibility`,
          'PATCH',
          { visibility: 'public', confirmed: true },
          'other',
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          `/themes/${theme.id}/visibility`,
          'PATCH',
          { visibility: 'public' },
          'owner',
          'https://attacker.invalid',
        )
      ).status,
      403,
    );
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Guessed private theme', identityId: theme.id }, 'other'))
        .status,
      400,
    );
    assert.equal(
      (await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'public' })).status,
      400,
    );
    assert.equal(
      (await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'public', confirmed: true }))
        .status,
      200,
    );
    const publicThemes = (await (await call('/themes', 'GET', undefined, 'other')).json()) as Array<
      Record<string, unknown>
    >;
    assert.equal(publicThemes.length, 1);
    assert.equal(publicThemes[0].owned, false);
    assert.equal(publicThemes[0].name, 'Team');
    assert.equal(publicThemes[0].input_json, undefined);
    assert.equal(publicThemes[0].creator_id, undefined);
    assert.equal(
      (await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'private' })).status,
      200,
    );
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Now private', identityId: theme.id }, 'other')).status,
      400,
    );
  } finally {
    sqlite.close();
  }
});

test('custom colors survive saving, library reuse and isolated quiz copies', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const response = await call('/identities', 'POST', {
      ...input,
      accent: '#Ab12EF',
      visibility: 'public',
      publishConfirmed: true,
    });
    assert.equal(response.status, 201);
    const original = (await response.json()) as IdentityRecordDto;
    assert.equal(original.accent, '#ab12ef');
    assert.equal((await getIdentity(db, original.id, 'owner'))?.identity.accent, '#ab12ef');
    const quizResponse = await call(
      '/quizzes',
      'POST',
      { title: 'Custom color', identityId: original.id },
      'other',
    );
    assert.equal(quizResponse.status, 201);
    const quiz = (await quizResponse.json()) as { identity_id: string };
    assert.equal((await getIdentity(db, quiz.identity_id, 'other'))?.identity.accent, '#ab12ef');
    assert.equal(
      (await call('/identities', 'POST', { ...input, accent: 'url(https://example.test)' })).status,
      400,
    );
  } finally {
    sqlite.close();
  }
});

test('public theme copies survive source changes but their design, visibility and asset reuse are locked', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const original = (await (
      await call('/identities', 'POST', {
        ...input,
        accent: 'forest',
        visibility: 'public',
        publishConfirmed: true,
      })
    ).json()) as IdentityRecordDto;
    const response = await call(
      '/quizzes',
      'POST',
      { title: 'Reusable theme', identityId: original.id },
      'other',
    );
    assert.equal(response.status, 201);
    const quiz = (await response.json()) as { id: string; identity_id: string };
    const copy = (await getIdentity(db, quiz.identity_id, 'other'))!;
    assert.notEqual(copy.id, original.id);
    assert.equal(copy.visibility, 'private');
    assert.equal(copy.designLocked, true);
    assert.equal(copy.identity.accent, 'forest');
    assert.notEqual(copy.images[0].mediaId, original.images[0].mediaId);
    assert.equal(copy.identity.logo?.src, original.identity.logo?.src);
    assert.equal(
      sqlite.prepare('SELECT creator_id FROM identity_assets WHERE id=?').get(copy.images[0].mediaId)!
        .creator_id,
      'other',
    );
    await call(`/identities/${original.id}`, 'DELETE');
    assert.equal((await getIdentity(db, quiz.identity_id, 'other'))?.identity.logo?.src, source);
    const edited = await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...copy, name: 'My copy' }, 'other');
    assert.equal(edited.status, 403);
    assert.equal(
      (await call(`/identities/${copy.id}`, 'PUT', { ...copy, name: 'Changed' }, 'other')).status,
      403,
    );
    assert.equal(
      (
        await call(
          `/themes/${copy.id}/visibility`,
          'PATCH',
          { visibility: 'public', confirmed: true },
          'other',
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          '/identities',
          'POST',
          { ...copy, visibility: 'private', name: 'Bypass via assets' },
          'other',
        )
      ).status,
      400,
    );
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Bypass via quiz', identity: copy }, 'other')).status,
      400,
    );
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    const assets = sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n;
    sqlite.exec(
      "CREATE TRIGGER fail_theme_copy BEFORE INSERT ON quizzes BEGIN SELECT RAISE(ABORT, 'copy failure'); END",
    );
    await assert.rejects(
      createQuizForCreator(db, 'other', 'Rollback', null, [], undefined, copy.id),
      /copy failure/,
    );
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n, assets);
  } finally {
    sqlite.close();
  }
});

test('publication needs explicit confirmation; editing an own theme inside a quiz stays private and isolated', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const publicInput = { ...input, visibility: 'public', publishConfirmed: false };
    assert.equal((await call('/identities', 'POST', publicInput)).status, 400);
    assert.equal(
      (await call('/quizzes', 'POST', { title: 'Unconfirmed', identity: publicInput })).status,
      400,
    );
    const original = (await (
      await call('/identities', 'POST', { ...publicInput, publishConfirmed: true })
    ).json()) as IdentityRecordDto;
    const first = await createQuizForCreator(db, 'owner', 'First', null, [], undefined, original.id);
    const second = await createQuizForCreator(db, 'owner', 'Second', null, [], undefined, original.id);
    const current = (await getIdentity(db, first.identity_id!, 'owner'))!;
    assert.equal(current.designLocked, false);
    const edited = await call(`/quizzes/${first.id}/identity`, 'POST', {
      ...current,
      name: 'Only first quiz',
      visibility: 'public',
      publishConfirmed: true,
    });
    assert.equal(edited.status, 201);
    const revision = (await edited.json()) as IdentityRecordDto;
    assert.equal(revision.visibility, 'private');
    assert.equal((await getIdentity(db, original.id, 'owner'))?.name, 'Team');
    assert.equal((await getIdentity(db, second.identity_id!, 'owner'))?.name, 'Team');
    assert.equal((await getIdentity(db, original.id, 'owner'))?.visibility, 'public');
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
