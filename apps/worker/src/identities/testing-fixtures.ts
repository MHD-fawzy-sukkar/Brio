import test from 'node:test';
import { createTestDatabase } from '../testing/d1';
import { hashSessionToken } from '../auth/session';
import { SaveIdentityRequestSchema } from '@brio/contracts';
import worker from '../index';
export const assetId = '00000000-0000-4000-8000-000000000001';
export const source = 'https://res.cloudinary.com/brio/image/upload/v1/team.webp';
export async function setup() {
  const { db, sqlite } = createTestDatabase();
  for (const id of ['owner', 'other']) {
    sqlite
      .prepare('INSERT INTO creators VALUES(?,?,?,?,?)')
      .run(id, id, id, `${id}@test.invalid`, new Date().toISOString());
    sqlite
      .prepare('INSERT INTO creator_sessions VALUES(?,?,?,?,?)')
      .run(await hashSessionToken(id), id, '2099-01-01T00:00:00Z', null, new Date().toISOString());
  }
  sqlite
    .prepare('INSERT INTO identity_assets(id,creator_id,source_url,created_at) VALUES(?,?,?,?)')
    .run(assetId, 'owner', source, new Date().toISOString());
  const call = (
    path: string,
    method = 'GET',
    body?: unknown,
    owner = 'owner',
    origin = 'https://brio.invalid',
  ) =>
    worker.fetch(
      new Request(`https://brio.invalid/api${path}`, {
        method,
        headers: {
          Cookie: `brio_creator_session=${owner}`,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      { DB: db } as never,
      {} as never,
    );
  const input = SaveIdentityRequestSchema.parse({
    name: 'Team',
    images: [{ mediaId: assetId, label: 'Team', roles: ['logo', 'character', 'avatar'] }],
    avatarMode: 'custom',
  });
  return { db, sqlite, call, input };
}
