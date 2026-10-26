import { z } from 'zod';

// Local URLs are accepted only for validated LAN packages. Authoring never accepts URLs.
const ImageSourceSchema = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      /^\/media\/[a-f0-9]{64}$/.test(value) ||
      /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//.test(value),
    'Invalid identity image source',
  );
const ImageSchema = z.object({ src: ImageSourceSchema, label: z.string().min(1).max(80) });
export const ThemeAccentSchema = z.union([
  z.enum([
    'brio',
    'ocean',
    'forest',
    'violet',
    'amber',
    'rose',
    'teal',
    'cyan',
    'indigo',
    'orange',
    'slate',
    'red',
  ]),
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((color) => color.toLowerCase()),
]);
export const ThemeVisibilitySchema = z.enum(['private', 'public']);
export const CompetitionIdentitySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    accent: ThemeAccentSchema.optional(),
    logo: ImageSchema.optional(),
    character: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('bolt') }),
      ImageSchema.extend({ kind: z.literal('image'), motion: z.enum(['float', 'still']) }),
    ]),
    avatars: z.array(ImageSchema.extend({ id: z.string().regex(/^identity:[a-f0-9-]{36}$/) })).max(20),
    avatarMode: z.enum(['brio', 'custom', 'mixed', 'auto']).default('brio'),
  })
  .refine(
    (identity) =>
      (identity.avatarMode !== 'custom' || identity.avatars.length > 0) &&
      new Set(identity.avatars.map((avatar) => avatar.id)).size === identity.avatars.length,
    'Custom avatar catalogs must be non-empty with unique IDs',
  );
export type CompetitionIdentity = z.infer<typeof CompetitionIdentitySchema>;

export const IdentityImageInputSchema = z.object({
  mediaId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  roles: z
    .array(z.enum(['logo', 'character', 'avatar']))
    .min(1)
    .max(3),
});
export const SaveIdentityRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    accent: ThemeAccentSchema.default('brio'),
    visibility: ThemeVisibilitySchema.default('private'),
    publishConfirmed: z.boolean().optional(),
    images: z.array(IdentityImageInputSchema).min(1).max(20),
    avatarMode: z.enum(['brio', 'custom', 'mixed', 'auto']).default('auto'),
    motion: z.enum(['float', 'still']).default('float'),
  })
  .superRefine((value, ctx) => {
    const invalid =
      new Set(value.images.map((image) => image.mediaId)).size !== value.images.length ||
      value.images.some((image) => new Set(image.roles).size !== image.roles.length) ||
      ['logo', 'character'].some(
        (role) =>
          value.images.filter((image) => image.roles.includes(role as 'logo' | 'character')).length > 1,
      ) ||
      (['custom', 'mixed'].includes(value.avatarMode) &&
        !value.images.some((image) => image.roles.includes('avatar')));
    if (invalid)
      ctx.addIssue({
        code: 'custom',
        message: 'حدّد شعاراً واحداً وشخصية واحدة وأفاتاراً واحداً على الأقل عند استخدام صورك للاعبين.',
      });
  });
export type SaveIdentityRequest = z.infer<typeof SaveIdentityRequestSchema>;
export const CUSTOM_AVATAR_THRESHOLD = 5;
export function includesBoltAvatars(identity: Pick<CompetitionIdentity, 'avatarMode' | 'avatars'>): boolean {
  return (
    identity.avatarMode === 'brio' ||
    identity.avatarMode === 'mixed' ||
    (identity.avatarMode === 'auto' && identity.avatars.length < CUSTOM_AVATAR_THRESHOLD)
  );
}
export type IdentityRecordDto = SaveIdentityRequest & {
  id: string;
  identity: CompetitionIdentity;
  designLocked?: boolean;
};
export type ThemeSummaryDto = {
  id: string;
  name: string;
  visibility: z.infer<typeof ThemeVisibilitySchema>;
  owned: boolean;
  identity: CompetitionIdentity;
};

export const IdentityUploadRequestSchema = z.object({
  byteSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
});
export const IdentityUploadCompleteSchema = z.object({
  assetId: z.string().uuid(),
  publicId: z.string().max(250),
  version: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]{40}$/),
});
export type IdentityUploadComplete = z.infer<typeof IdentityUploadCompleteSchema>;
export const IdentityIdSchema = z.string().uuid();
export const IdentityAssignmentSchema = z.object({ identityId: IdentityIdSchema.nullable() });

/** One resolver for authoring previews and persisted snapshots. Sources come from owned assets. */
export function createCompetitionIdentity(
  input: SaveIdentityRequest,
  sources: ReadonlyMap<string, string>,
): CompetitionIdentity {
  const source = (id: string) => {
    const src = sources.get(id);
    if (!src) throw new Error('Missing identity asset');
    return src;
  };
  const imageFor = (role: 'logo' | 'character') => {
    const image = input.images.find((item) => item.roles.includes(role));
    return image ? { src: source(image.mediaId), label: image.label } : undefined;
  };
  const character = imageFor('character');
  return CompetitionIdentitySchema.parse({
    name: input.name,
    accent: input.accent,
    logo: imageFor('logo'),
    character: character ? { kind: 'image', ...character, motion: input.motion } : { kind: 'bolt' },
    avatarMode: input.avatarMode,
    avatars: input.images
      .filter((image) => image.roles.includes('avatar'))
      .map((image) => ({ id: `identity:${image.mediaId}`, src: source(image.mediaId), label: image.label })),
  });
}

export function identityImageSources(identity?: CompetitionIdentity | null): string[] {
  if (!identity) return [];
  return [
    ...new Set([
      ...(identity.logo ? [identity.logo.src] : []),
      ...(identity.character.kind === 'image' ? [identity.character.src] : []),
      ...identity.avatars.map((avatar) => avatar.src),
    ]),
  ];
}

export function isCompetitionAvatarAllowed(identity: CompetitionIdentity | undefined, id: string): boolean {
  const builtIn =
    /^(?:bolt-avatar-(?:0[1-9]|1[0-5])|avatar_(?:[1-9]|1[0-5])|\/avatars\/avatar-(?:[1-9]|1[0-5])\.svg)$/.test(
      id,
    );
  if (!identity || identity.avatarMode === 'brio') return builtIn;
  return identity.avatars.some((avatar) => avatar.id === id) || (includesBoltAvatars(identity) && builtIn);
}

export function mapIdentityImages(
  identity: CompetitionIdentity,
  map: (src: string) => string,
): CompetitionIdentity {
  return {
    ...identity,
    ...(identity.logo ? { logo: { ...identity.logo, src: map(identity.logo.src) } } : {}),
    character:
      identity.character.kind === 'image'
        ? { ...identity.character, src: map(identity.character.src) }
        : identity.character,
    avatars: identity.avatars.map((avatar) => ({ ...avatar, src: map(avatar.src) })),
  };
}
