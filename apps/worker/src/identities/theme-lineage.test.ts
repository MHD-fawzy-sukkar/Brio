import test from 'node:test';
import assert from 'node:assert/strict';
import { type IdentityRecordDto } from '@brio/contracts';
import { createQuizForCreator } from '../repositories/quiz.repository';
import { getIdentity } from '../repositories/identity.repository';
import { saveQuizIdentity } from '../repositories/quiz-identity.repository';
import { source, setup } from './testing-fixtures';
test('studio applies owned themes as linked copies and resets to Bolt', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const original = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    const quiz = await createQuizForCreator(db, 'owner', 'Studio');
    assert.equal(
      (await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: original.id }, 'owner')).status,
      200,
    );
    const { record } = (await (
      await call(`/quizzes/${quiz.id}/identity`, 'GET', undefined, 'owner')
    ).json()) as { record: IdentityRecordDto };
    assert.notEqual(record.id, original.id);
    assert.equal(record.designLocked, false);
    assert.equal((await getIdentity(db, record.id, 'owner'))?.identity.logo?.src, source);
    assert.equal(
      (await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: null }, 'owner')).status,
      200,
    );
    assert.deepEqual(await (await call(`/quizzes/${quiz.id}/identity`, 'GET', undefined, 'owner')).json(), {
      record: null,
    });
    await call(`/identities/${original.id}`, 'DELETE');
    assert.equal(
      (await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: original.id }, 'owner')).status,
      404,
    );
  } finally {
    sqlite.close();
  }
});

test('deleting a library theme resets attached quizzes to Bolt without returning a duplicate library card', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const quiz = await createQuizForCreator(db, 'owner', 'Attached theme', undefined, [], input);
    assert.equal((await call(`/identities/${quiz.identity_id}`, 'DELETE')).status, 200);
    const { record } = (await (await call(`/quizzes/${quiz.id}/identity`)).json()) as {
      record: IdentityRecordDto;
    };
    assert.equal(record, null);
    assert.deepEqual(await (await call('/themes')).json(), []);
    assert.deepEqual(await (await call('/identities')).json(), []);
    await saveQuizIdentity(db, quiz.id, 'owner', { ...input, name: 'Edited after deletion' });
    assert.equal(((await (await call('/themes')).json()) as unknown[]).length, 1);
  } finally {
    sqlite.close();
  }
});

test('studio theme replacement rolls back copied assets when assignment fails', async () => {
  const { sqlite, call, input } = await setup();
  try {
    const theme = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    const quiz = (await (await call('/quizzes', 'POST', { title: 'Rollback' }, 'owner')).json()) as {
      id: string;
    };
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n;
    sqlite.exec(
      "CREATE TRIGGER fail_studio_assignment BEFORE UPDATE OF identity_id ON quizzes BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    assert.equal(
      (await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: theme.id }, 'owner')).status,
      500,
    );
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n, count);
    assert.equal(
      sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(quiz.id)!.identity_id,
      null,
    );
  } finally {
    sqlite.close();
  }
});

test('library edits propagate to linked owned quizzes, custom revisions detach, and deletion resets linked drafts', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const theme = (await (await call('/identities', 'POST', input)).json()) as IdentityRecordDto;
    const first = await createQuizForCreator(db, 'owner', 'First', null, [], undefined, theme.id);
    const second = await createQuizForCreator(db, 'owner', 'Second', null, [], undefined, theme.id);
    const unrelated = await createQuizForCreator(db, 'owner', 'Unrelated', null, [], {
      ...input,
      name: 'Another theme',
    });
    await saveQuizIdentity(db, second.id, 'owner', { ...input, name: 'Independent customization' });
    assert.equal(
      (
        await call(`/identities/${theme.id}`, 'PUT', {
          ...input,
          name: 'Updated everywhere',
          accent: 'forest',
        })
      ).status,
      200,
    );
    const firstIdentity = (await getIdentity(db, first.identity_id!, 'owner'))!;
    assert.equal(firstIdentity.name, 'Updated everywhere');
    assert.equal(firstIdentity.identity.accent, 'forest');
    const secondIdentity = (await (await call(`/quizzes/${second.id}/identity`)).json()) as {
      record: IdentityRecordDto;
    };
    assert.equal(secondIdentity.record.name, 'Independent customization');
    await call(`/identities/${theme.id}`, 'DELETE');
    assert.deepEqual(await (await call(`/quizzes/${first.id}/identity`)).json(), { record: null });
    assert.equal(
      ((await (await call(`/quizzes/${second.id}/identity`)).json()) as { record: IdentityRecordDto }).record
        .name,
      'Independent customization',
    );
    assert.equal((await getIdentity(db, unrelated.identity_id!, 'owner'))?.name, 'Another theme');
  } finally {
    sqlite.close();
  }
});
