import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { CompetitionIdentity } from '@brio/contracts';
import type { TestContext } from 'node:test';
import type { createLanServer } from '../server';
import { png, fixtureBundle } from './fixtures';
export async function runAdditionalRoomChecks(
  t: TestContext,
  {
    request,
    hostCookie,
    app,
    manifest,
  }: {
    request: (path: string, cookie?: string, input?: unknown, method?: string) => Promise<Response>;
    hostCookie: string;
    app: ReturnType<typeof createLanServer>;
    manifest: { url: string }[];
  },
) {
  await t.test(
    'custom identity joins use the frozen catalog and expose only presentation data before joining',
    async () => {
      const bundle = fixtureBundle();
      const src = 'https://res.cloudinary.com/brio/image/upload/v1/team.png';
      const avatarId = 'identity:00000000-0000-4000-8000-000000000001';
      const identity: CompetitionIdentity = {
        name: 'فريق الاختبار',
        logo: { src, label: 'Team' },
        character: { kind: 'image', src, label: 'Team', motion: 'still' },
        avatars: [{ id: avatarId, src, label: 'Team' }],
        avatarMode: 'custom',
      };
      const themed = {
        ...bundle,
        quiz: { ...bundle.quiz, id: 'themed', identity },
        media: [bundle.media[0], { ...bundle.media[0], sourceUrl: src }],
      };
      assert.equal((await request('/api/local/import', hostCookie, themed)).status, 201);
      const room = (await (await request('/api/rooms', hostCookie, { quizId: 'themed' })).json()) as {
        roomId: string;
      };
      const metadata = await request(`/api/rooms/${room.roomId}/identity`);
      const presentation = (await metadata.json()) as { identity: CompetitionIdentity };
      assert.deepEqual(Object.keys(presentation), ['identity']);
      assert.equal(presentation.identity.name, 'فريق الاختبار');
      assert.match(presentation.identity.logo!.src, /^\/media\//);
      assert.equal(
        (await request(`/api/rooms/${room.roomId}/join`, '', { nickname: 'wrong', avatarId: 'avatar_1' }))
          .status,
        400,
      );
      const joined = await request(`/api/rooms/${room.roomId}/join`, '', { nickname: 'right', avatarId });
      assert.equal(joined.status, 201);
      const player = (await joined.json()) as { playerId: string; avatarId: string };
      const cookie = joined.headers.get('set-cookie')!.split(';')[0];
      const snapshot = (await (await request(`/api/rooms/${room.roomId}/snapshot`, cookie)).json()) as {
        identity: CompetitionIdentity;
      };
      assert.equal(snapshot.identity.name, identity.name);
      assert.equal(
        (await request(`/api/rooms/${room.roomId}/join`, cookie, { nickname: 'resumed' })).status,
        201,
      );
      assert.equal(player.avatarId, avatarId);
      await request(`/api/rooms/${room.roomId}`, hostCookie, undefined, 'DELETE');
      assert.equal((await request(`/api/rooms/${room.roomId}/identity`)).status, 404);
    },
  );

  await t.test(
    'deleting an imported quiz preserves session results and media until the last reference is removed',
    async () => {
      const bundle = fixtureBundle();
      bundle.quiz.id = 'removable';
      const image = Buffer.concat([png, Buffer.from('retention')]);
      bundle.media[0].base64 = image.toString('base64');
      bundle.media[0].sha256 = createHash('sha256').update(image).digest('hex');
      const mediaUrl = `/media/${bundle.media[0].sha256}`;
      assert.equal((await request('/api/local/import', hostCookie, bundle)).status, 201);
      const room = (await (
        await request('/api/rooms', hostCookie, { quizId: bundle.quiz.id })
      ).json()) as any;
      const quizPath = `/api/local/quizzes/${bundle.quiz.id}`;
      const sessionPath = `/api/local/rooms/${room.roomId}`;
      assert.equal((await request(quizPath, '', undefined, 'DELETE')).status, 401);
      assert.equal((await request(sessionPath, '', undefined, 'DELETE')).status, 401);
      const activeDeletion = await request(quizPath, hostCookie, undefined, 'DELETE');
      assert.equal(activeDeletion.status, 409);
      assert.match(((await activeDeletion.json()) as any).detail, /أنهِ الغرفة/);
      assert.equal((await request(sessionPath, hostCookie, undefined, 'DELETE')).status, 409);
      await request(`/api/rooms/${room.roomId}`, hostCookie, undefined, 'DELETE');
      assert.equal((await request(quizPath, hostCookie, undefined, 'DELETE')).status, 200);
      assert.equal(
        app.store.listQuizzes().some((q) => q.id === bundle.quiz.id),
        false,
      );
      assert.equal((await request(`/api/rooms/${room.roomId}/results`, hostCookie)).status, 200);
      assert.equal((await request(mediaUrl)).status, 200);
      assert.equal((await request(quizPath, hostCookie, undefined, 'DELETE')).status, 404);
      assert.equal((await request(sessionPath, hostCookie, undefined, 'DELETE')).status, 200);
      assert.equal((await request(sessionPath, hostCookie, undefined, 'DELETE')).status, 404);
      assert.equal((await request(mediaUrl)).status, 404);
      // An image still referenced by the original imported quiz remains intact.
      assert.equal((await request(manifest[0].url)).status, 200);
    },
  );
}
