import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../testing/d1';
import { hashSessionToken } from '../auth/session';
import { SaveIdentityRequestSchema, type IdentityRecordDto } from '@brio/contracts';
import { publishQuizVersion, createQuizForCreator, getLatestQuizVersion } from '../repositories/quiz.repository';
import { getIdentity } from '../repositories/identity.repository';
import { saveQuizIdentity } from '../repositories/quiz-identity.repository';
import { signIdentityUpload, completeIdentityUpload } from '../media/identity-upload';
import worker from '../index';

const assetId = '00000000-0000-4000-8000-000000000001';
const source = 'https://res.cloudinary.com/brio/image/upload/v1/team.webp';
async function setup() {
  const { db, sqlite } = createTestDatabase();
  for (const id of ['owner', 'other']) {
    sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run(id, id, id, `${id}@test.invalid`, new Date().toISOString());
    sqlite.prepare('INSERT INTO creator_sessions VALUES(?,?,?,?,?)').run(await hashSessionToken(id), id, '2099-01-01T00:00:00Z', null, new Date().toISOString());
  }
  sqlite.prepare('INSERT INTO identity_assets(id,creator_id,source_url,created_at) VALUES(?,?,?,?)').run(assetId, 'owner', source, new Date().toISOString());
  const call = (path: string, method = 'GET', body?: unknown, owner = 'owner', origin = 'https://brio.invalid') => worker.fetch(new Request(`https://brio.invalid/api${path}`, {
    method, headers: { Cookie: `brio_creator_session=${owner}`, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }), { DB: db } as never, {} as never);
  const input = SaveIdentityRequestSchema.parse({ name: 'Team', images: [{ mediaId: assetId, label: 'Team', roles: ['logo', 'character', 'avatar'] }], avatarMode: 'custom' });
  return { db, sqlite, call, input };
}

test('theme library keeps drafts private and only the owner can publish or unpublish', async () => {
  const { call, sqlite, input } = await setup();
  try {
    assert.equal((await call('/themes', 'GET', undefined, '')).status, 401);
    const theme = await (await call('/identities', 'POST', input)).json() as IdentityRecordDto;
    assert.equal(theme.visibility, 'private');
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    assert.equal((await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'public', confirmed: true }, 'other')).status, 404);
    assert.equal((await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'public' }, 'owner', 'https://attacker.invalid')).status, 403);
    assert.equal((await call('/quizzes', 'POST', { title: 'Guessed private theme', identityId: theme.id }, 'other')).status, 400);
    assert.equal((await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'public' })).status, 400);
    assert.equal((await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'public', confirmed: true })).status, 200);
    const publicThemes = await (await call('/themes', 'GET', undefined, 'other')).json() as Array<Record<string, unknown>>;
    assert.equal(publicThemes.length, 1);
    assert.equal(publicThemes[0].owned, false);
    assert.equal(publicThemes[0].name, 'Team');
    assert.equal(publicThemes[0].input_json, undefined);
    assert.equal(publicThemes[0].creator_id, undefined);
    assert.equal((await call(`/themes/${theme.id}/visibility`, 'PATCH', { visibility: 'private' })).status, 200);
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    assert.equal((await call('/quizzes', 'POST', { title: 'Now private', identityId: theme.id }, 'other')).status, 400);
  } finally { sqlite.close(); }
});

test('custom colors survive saving, library reuse and isolated quiz copies', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const response = await call('/identities', 'POST', { ...input, accent: '#Ab12EF', visibility: 'public', publishConfirmed: true });
    assert.equal(response.status, 201);
    const original = await response.json() as IdentityRecordDto;
    assert.equal(original.accent, '#ab12ef');
    assert.equal((await getIdentity(db, original.id, 'owner'))?.identity.accent, '#ab12ef');
    const quizResponse = await call('/quizzes', 'POST', { title: 'Custom color', identityId: original.id }, 'other');
    assert.equal(quizResponse.status, 201);
    const quiz = await quizResponse.json() as { identity_id: string };
    assert.equal((await getIdentity(db, quiz.identity_id, 'other'))?.identity.accent, '#ab12ef');
    assert.equal((await call('/identities', 'POST', { ...input, accent: 'url(https://example.test)' })).status, 400);
  } finally { sqlite.close(); }
});

test('public theme copies survive source changes but their design, visibility and asset reuse are locked', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const original = await (await call('/identities', 'POST', { ...input, accent: 'forest', visibility: 'public', publishConfirmed: true })).json() as IdentityRecordDto;
    const response = await call('/quizzes', 'POST', { title: 'Reusable theme', identityId: original.id }, 'other');
    assert.equal(response.status, 201);
    const quiz = await response.json() as { id: string; identity_id: string };
    const copy = (await getIdentity(db, quiz.identity_id, 'other'))!;
    assert.notEqual(copy.id, original.id);
    assert.equal(copy.visibility, 'private');
    assert.equal(copy.designLocked, true);
    assert.equal(copy.identity.accent, 'forest');
    assert.notEqual(copy.images[0].mediaId, original.images[0].mediaId);
    assert.equal(copy.identity.logo?.src, original.identity.logo?.src);
    assert.equal(sqlite.prepare('SELECT creator_id FROM identity_assets WHERE id=?').get(copy.images[0].mediaId)!.creator_id, 'other');
    await call(`/identities/${original.id}`, 'DELETE');
    assert.equal((await getIdentity(db, quiz.identity_id, 'other'))?.identity.logo?.src, source);
    const edited = await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...copy, name: 'My copy' }, 'other');
    assert.equal(edited.status, 403);
    assert.equal((await call(`/identities/${copy.id}`, 'PUT', { ...copy, name: 'Changed' }, 'other')).status, 403);
    assert.equal((await call(`/themes/${copy.id}/visibility`, 'PATCH', { visibility: 'public', confirmed: true }, 'other')).status, 404);
    assert.equal((await call('/identities', 'POST', { ...copy, visibility: 'private', name: 'Bypass via assets' }, 'other')).status, 400);
    assert.equal((await call('/quizzes', 'POST', { title: 'Bypass via quiz', identity: copy }, 'other')).status, 400);
    assert.deepEqual(await (await call('/themes', 'GET', undefined, 'other')).json(), []);
    const assets = sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n;
    sqlite.exec("CREATE TRIGGER fail_theme_copy BEFORE INSERT ON quizzes BEGIN SELECT RAISE(ABORT, 'copy failure'); END");
    await assert.rejects(createQuizForCreator(db, 'other', 'Rollback', null, [], undefined, copy.id), /copy failure/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n, assets);
  } finally { sqlite.close(); }
});

test('publication needs explicit confirmation; editing an own theme inside a quiz stays private and isolated', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const publicInput = { ...input, visibility: 'public', publishConfirmed: false };
    assert.equal((await call('/identities', 'POST', publicInput)).status, 400);
    assert.equal((await call('/quizzes', 'POST', { title: 'Unconfirmed', identity: publicInput })).status, 400);
    const original = await (await call('/identities', 'POST', { ...publicInput, publishConfirmed: true })).json() as IdentityRecordDto;
    const first = await createQuizForCreator(db, 'owner', 'First', null, [], undefined, original.id);
    const second = await createQuizForCreator(db, 'owner', 'Second', null, [], undefined, original.id);
    const current = (await getIdentity(db, first.identity_id!, 'owner'))!;
    assert.equal(current.designLocked, false);
    const edited = await call(`/quizzes/${first.id}/identity`, 'POST', { ...current, name: 'Only first quiz', visibility: 'public', publishConfirmed: true });
    assert.equal(edited.status, 201);
    const revision = await edited.json() as IdentityRecordDto;
    assert.equal(revision.visibility, 'private');
    assert.equal((await getIdentity(db, original.id, 'owner'))?.name, 'Team');
    assert.equal((await getIdentity(db, second.identity_id!, 'owner'))?.name, 'Team');
    assert.equal((await getIdentity(db, original.id, 'owner'))?.visibility, 'public');
  } finally { sqlite.close(); }
});

test('quiz creation saves its theme immediately, validates ownership and rolls back a failed insert', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const response = await call('/quizzes', 'POST', { title: 'Themed quiz', identity: input });
    assert.equal(response.status, 201);
    const quiz = await response.json() as { id: string; identity_id: string };
    assert.ok(quiz.identity_id);
    const saved = await getIdentity(db, quiz.identity_id, 'owner');
    assert.equal(saved?.avatarMode, 'auto');
    assert.equal(saved?.motion, 'float');
    assert.equal(saved?.identity.logo?.src, source);
    assert.equal((await call('/quizzes', 'POST', { title: 'Invalid ownership', identity: input }, 'other')).status, 400);
    assert.equal((await call('/quizzes', 'POST', { title: 'Empty theme', identity: { ...input, images: [] } })).status, 400);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM quizzes').get()!.n, 1);
    const identities = sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n;
    sqlite.exec("CREATE TRIGGER fail_quiz_creation BEFORE INSERT ON quizzes BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
    await assert.rejects(createQuizForCreator(db, 'owner', 'Rollback', null, [], input), /forced failure/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n, identities);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM quizzes').get()!.n, 1);
  } finally { sqlite.close(); }
});

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
    const record = await response.json() as IdentityRecordDto;
    assert.equal(record.identity.logo?.src, source);
    assert.deepEqual(await (await call('/identities', 'GET', undefined, 'other')).json(), []);
    assert.equal((await call(`/identities/${record.id}`, 'PUT', input, 'other')).status, 404);
    assert.equal((await call(`/identities/${record.id}`, 'DELETE', undefined, 'other')).status, 404);
    assert.equal((await call('/identities', 'POST', { ...input, images: [] })).status, 400);
    assert.equal((await call('/identity-assets/signature', 'POST', { byteSize: 10, mimeType: 'image/svg+xml' })).status, 400);
    assert.equal((await call('/identity-assets/signature', 'POST', { byteSize: 10, mimeType: 'image/png' })).status, 409);
  } finally { sqlite.close(); }
});

test('quiz assignment is owner-scoped; published identities remain immutable after edit and archive', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const record = await (await call('/identities', 'POST', input)).json() as IdentityRecordDto;
    const quiz = await createQuizForCreator(db, 'owner', 'Quiz', undefined, [{ type: 'Poll', text: 'Choose', durationMs: 10000, multiplier: 'Zero', options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: false }], acceptedAlternatives: [] }]);
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: record.id }, 'other')).status, 404);
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: record.id })).status, 200);
    await publishQuizVersion(db, quiz.id, 'owner');
    const frozen = JSON.parse((await getLatestQuizVersion(db, quiz.id))!.private_snapshot_json);
    assert.equal(frozen.identity.name, 'Team');
    assert.equal((await call(`/identities/${record.id}`, 'PUT', { ...input, name: 'Changed' })).status, 200);
    assert.equal((await getIdentity(db, record.id, 'owner'))?.name, 'Changed');
    assert.equal(JSON.parse((await getLatestQuizVersion(db, quiz.id))!.private_snapshot_json).identity.name, 'Team');
    assert.equal((await call(`/identities/${record.id}`, 'DELETE')).status, 200);
    assert.equal(sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(quiz.id)?.identity_id, null);
    assert.equal(JSON.parse((await getLatestQuizVersion(db, quiz.id))!.private_snapshot_json).identity.logo.src, source);
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: record.id })).status, 404);
  } finally { sqlite.close(); }
});

test('creating and editing inside a quiz saves and assigns atomically, always flies and leaves other quizzes unchanged', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const quiz = await createQuizForCreator(db, 'owner', 'Quiz');
    assert.deepEqual(await (await call(`/quizzes/${quiz.id}/identity`)).json(), { record: null });
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'POST', input, 'other')).status, 404);
    const firstResponse = await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...input, motion: 'still' });
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json() as IdentityRecordDto;
    assert.equal(first.motion, 'float');
    assert.equal(first.identity.character.kind === 'image' && first.identity.character.motion, 'float');
    const otherQuiz = await createQuizForCreator(db, 'owner', 'Other quiz');
    await call(`/quizzes/${otherQuiz.id}/identity`, 'PUT', { identityId: first.id });
    const second = await (await call(`/quizzes/${quiz.id}/identity`, 'POST', { ...input, name: 'Changed' })).json() as IdentityRecordDto;
    assert.notEqual(second.id, first.id);
    assert.equal((await (await call(`/quizzes/${quiz.id}/identity`)).json() as { record: IdentityRecordDto }).record.name, 'Changed');
    assert.equal((await (await call(`/quizzes/${otherQuiz.id}/identity`)).json() as { record: IdentityRecordDto }).record.name, 'Team');
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n;
    sqlite.exec("CREATE TRIGGER fail_identity_assignment BEFORE UPDATE OF identity_id ON quizzes BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
    await assert.rejects(saveQuizIdentity(db, quiz.id, 'owner', input), /forced failure/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM competition_identities').get()!.n, count);
    assert.equal(sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(quiz.id)!.identity_id, second.id);
  } finally { sqlite.close(); }
});

test('a missing identity migration returns a setup error instead of a save error or an empty list', async () => {
  const { sqlite, call } = await setup();
  try {
    sqlite.exec('DROP TABLE competition_identities');
    const response = await call('/identities');
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, 'identity_setup_required');
  } finally { sqlite.close(); }
});

test('new identity uploads are immutable and completion verifies Cloudinary response and owner namespace', async () => {
  const { db, sqlite } = createTestDatabase();
  try {
    sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run('owner', 'owner', 'owner', 'owner@test.invalid', 'now');
    const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' };
    const signed = await signIdentityUpload(env, 'owner');
    const again = await signIdentityUpload(env, 'owner');
    assert.notEqual(signed.assetId, again.assetId);
    assert.equal(signed.params.overwrite, 'false');
    const publicId = signed.params.public_id, version = 123;
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`public_id=${publicId}&version=${version}${env.CLOUDINARY_API_SECRET}`));
    const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const input = { assetId: signed.assetId, publicId, version, signature };
    await assert.rejects(completeIdentityUpload(db, env, 'other', input));
    await assert.rejects(completeIdentityUpload(db, env, 'owner', { ...input, signature: '0'.repeat(40) }));
    const saved = await completeIdentityUpload(db, env, 'owner', input);
    assert.match(saved.src, /c_pad,w_640,h_640,b_transparent,f_webp,q_auto\/v123\//);
    assert.equal((await completeIdentityUpload(db, env, 'owner', input)).mediaId, saved.mediaId);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()?.n, 1);
  } finally { sqlite.close(); }
});


test('studio can apply public or owned themes as independent copies and reset to Bolt', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const original = await (await call('/identities', 'POST', { ...input, visibility: 'public', publishConfirmed: true })).json() as IdentityRecordDto;
    const quiz = await createQuizForCreator(db, 'other', 'Studio');
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: original.id }, 'other')).status, 200);
    const { record } = await (await call(`/quizzes/${quiz.id}/identity`, 'GET', undefined, 'other')).json() as { record: IdentityRecordDto };
    assert.notEqual(record.id, original.id);
    assert.equal(record.designLocked, true);
    await call(`/identities/${original.id}`, 'DELETE');
    assert.equal((await getIdentity(db, record.id, 'other'))?.identity.logo?.src, source);
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: null }, 'other')).status, 200);
    assert.deepEqual(await (await call(`/quizzes/${quiz.id}/identity`, 'GET', undefined, 'other')).json(), { record: null });
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: original.id }, 'other')).status, 404);
  } finally { sqlite.close(); }
});

test('deleting a library theme resets attached quizzes to Bolt without returning a duplicate library card', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const quiz = await createQuizForCreator(db, 'owner', 'Attached theme', undefined, [], input);
    assert.equal((await call(`/identities/${quiz.identity_id}`, 'DELETE')).status, 200);
    const { record } = await (await call(`/quizzes/${quiz.id}/identity`)).json() as { record: IdentityRecordDto };
    assert.equal(record, null);
    assert.deepEqual(await (await call('/themes')).json(), []);
    assert.deepEqual(await (await call('/identities')).json(), []);
    await saveQuizIdentity(db, quiz.id, 'owner', { ...input, name: 'Edited after deletion' });
    assert.equal((await (await call('/themes')).json() as unknown[]).length, 1);
  } finally { sqlite.close(); }
});

test('studio theme replacement rolls back copied assets when assignment fails', async () => {
  const { sqlite, call, input } = await setup();
  try {
    const theme = await (await call('/identities', 'POST', { ...input, visibility: 'public', publishConfirmed: true })).json() as IdentityRecordDto;
    const quiz = await (await call('/quizzes', 'POST', { title: 'Rollback' }, 'other')).json() as { id: string };
    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n;
    sqlite.exec("CREATE TRIGGER fail_studio_assignment BEFORE UPDATE OF identity_id ON quizzes BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
    assert.equal((await call(`/quizzes/${quiz.id}/identity`, 'PUT', { identityId: theme.id }, 'other')).status, 500);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM identity_assets').get()!.n, count);
    assert.equal(sqlite.prepare('SELECT identity_id FROM quizzes WHERE id=?').get(quiz.id)!.identity_id, null);
  } finally { sqlite.close(); }
});


test('library edits propagate to linked owned quizzes, custom revisions detach, and deletion resets linked drafts', async () => {
  const { db, sqlite, call, input } = await setup();
  try {
    const theme = await (await call('/identities', 'POST', input)).json() as IdentityRecordDto;
    const first = await createQuizForCreator(db, 'owner', 'First', null, [], undefined, theme.id);
    const second = await createQuizForCreator(db, 'owner', 'Second', null, [], undefined, theme.id);
    const unrelated = await createQuizForCreator(db, 'owner', 'Unrelated', null, [], { ...input, name: 'Another theme' });
    await saveQuizIdentity(db, second.id, 'owner', { ...input, name: 'Independent customization' });
    assert.equal((await call(`/identities/${theme.id}`, 'PUT', { ...input, name: 'Updated everywhere', accent: 'forest' })).status, 200);
    const firstIdentity = (await getIdentity(db, first.identity_id!, 'owner'))!;
    assert.equal(firstIdentity.name, 'Updated everywhere');
    assert.equal(firstIdentity.identity.accent, 'forest');
    const secondIdentity = await (await call(`/quizzes/${second.id}/identity`)).json() as { record: IdentityRecordDto };
    assert.equal(secondIdentity.record.name, 'Independent customization');
    await call(`/identities/${theme.id}`, 'DELETE');
    assert.deepEqual(await (await call(`/quizzes/${first.id}/identity`)).json(), { record: null });
    assert.equal((await (await call(`/quizzes/${second.id}/identity`)).json() as { record: IdentityRecordDto }).record.name, 'Independent customization');
    assert.equal((await getIdentity(db, unrelated.identity_id!, 'owner'))?.name, 'Another theme');
  } finally { sqlite.close(); }
});
