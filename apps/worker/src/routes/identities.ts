import { Hono, type MiddlewareHandler } from 'hono';
import {
  SaveIdentityRequestSchema,
  IdentityUploadRequestSchema,
  IdentityUploadCompleteSchema,
  IdentityIdSchema,
  IdentityAssignmentSchema,
} from '@brio/contracts';
import type { Env } from '../env';
import { getAuthCreator } from '../http/creator';
import { IdentityError, rfc7807Error } from '../http/problem';
import { validateOrigin } from '../auth/session';
import {
  listIdentities,
  getIdentity,
  saveIdentity,
  archiveIdentity,
  assignQuizIdentity,
} from '../repositories/identity.repository';
import { signIdentityUpload, completeIdentityUpload } from '../media/identity-upload';
import { getQuizIdentity, saveQuizIdentity } from '../repositories/quiz-identity.repository';
import { listThemes } from '../repositories/theme-library.repository';

type IdentityEnv = { Bindings: Env; Variables: { creatorId: string } };
export const identityRoutes = new Hono<IdentityEnv>();
const authorize: MiddlewareHandler<IdentityEnv> = async (c, next) => {
  const creator = await getAuthCreator(c);
  if (!creator) return rfc7807Error(c, 401, 'unauthorized', 'Authentication required');
  if (c.req.method !== 'GET' && !validateOrigin(c.req.raw))
    return rfc7807Error(c, 403, 'forbidden_origin', 'Cross-origin mutation denied');
  c.set('creatorId', creator.id);
  c.header('Cache-Control', 'no-store');
  await next();
};
// Keep identity authorization local; public health, join and auth routes stay public.
for (const path of [
  '/identities',
  '/identities/*',
  '/identity-assets/*',
  '/quizzes/:id/identity',
  '/themes',
  '/themes/*',
])
  identityRoutes.use(path, authorize);
identityRoutes.onError((error, c) => {
  if (error instanceof IdentityError) return rfc7807Error(c, error.status, 'identity_error', error.message);
  if (error.name === 'ZodError' || error instanceof SyntaxError)
    return rfc7807Error(
      c,
      400,
      'validation_failed',
      'تحقق من اسم الهوية والصور وأدوارها. يجب اختيار صورة واحدة على الأقل وشعار وشخصية واحدة كحد أقصى.',
    );
  if (
    /no such table: (?:competition_identities|identity_assets)|no such column: (?:\w+\.)?(?:identity_id|visibility|design_locked|library_hidden|source_theme_id)/i.test(
      error.message,
    )
  ) {
    return rfc7807Error(
      c,
      503,
      'identity_setup_required',
      'تخصيص الهوية يحتاج تحديث قاعدة بيانات الموقع. حاول مجدداً بعد اكتمال التحديث.',
    );
  }
  console.error('Identity operation failed', error);
  return rfc7807Error(
    c,
    500,
    'identity_failed',
    c.req.method === 'GET' ? 'تعذّر تحميل الهوية. حاول مجدداً.' : 'تعذّر حفظ الهوية. حاول مجدداً.',
  );
});
identityRoutes.get('/themes', async (c) => c.json(await listThemes(c.env.DB, c.get('creatorId'))));
identityRoutes.get('/identities', async (c) => c.json(await listIdentities(c.env.DB, c.get('creatorId'))));
identityRoutes.post('/identities', async (c) => {
  const input = SaveIdentityRequestSchema.parse(await c.req.json());
  return c.json(await saveIdentity(c.env.DB, c.get('creatorId'), input), 201);
});
identityRoutes.put('/identities/:id', async (c) => {
  const id = IdentityIdSchema.parse(c.req.param('id'));
  if (!(await getIdentity(c.env.DB, id, c.get('creatorId'))))
    throw new IdentityError('الهوية غير موجودة.', 404);
  const input = SaveIdentityRequestSchema.parse(await c.req.json());
  return c.json(await saveIdentity(c.env.DB, c.get('creatorId'), input, id));
});
identityRoutes.delete('/identities/:id', async (c) => {
  await archiveIdentity(c.env.DB, IdentityIdSchema.parse(c.req.param('id')), c.get('creatorId'));
  return c.json({ status: 'deleted' });
});
identityRoutes.post('/identity-assets/signature', async (c) => {
  IdentityUploadRequestSchema.parse(await c.req.json());
  return c.json(await signIdentityUpload(c.env, c.get('creatorId')));
});
identityRoutes.post('/identity-assets/complete', async (c) => {
  const input = IdentityUploadCompleteSchema.parse(await c.req.json());
  return c.json(await completeIdentityUpload(c.env.DB, c.env, c.get('creatorId'), input), 201);
});
identityRoutes.put('/quizzes/:id/identity', async (c) => {
  const input = IdentityAssignmentSchema.parse(await c.req.json());
  const identityId = await assignQuizIdentity(
    c.env.DB,
    IdentityIdSchema.parse(c.req.param('id')),
    c.get('creatorId'),
    input.identityId,
  );
  return c.json({ status: 'updated', identityId });
});
identityRoutes.get('/quizzes/:id/identity', async (c) => {
  const record = await getQuizIdentity(
    c.env.DB,
    IdentityIdSchema.parse(c.req.param('id')),
    c.get('creatorId'),
  );
  return c.json({ record });
});
identityRoutes.post('/quizzes/:id/identity', async (c) => {
  const input = SaveIdentityRequestSchema.parse(await c.req.json());
  // New and edited quiz identities always fly; old frozen snapshots remain compatible.
  input.motion = 'float';
  input.avatarMode = 'auto';
  const record = await saveQuizIdentity(
    c.env.DB,
    IdentityIdSchema.parse(c.req.param('id')),
    c.get('creatorId'),
    input,
  );
  return c.json(record, 201);
});
