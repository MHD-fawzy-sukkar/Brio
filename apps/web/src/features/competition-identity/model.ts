import { BOLT_AVATARS, resolveAvatarIndex } from '../avatars/catalog';
import type { CompetitionIdentity as IdentityDto } from '@brio/contracts';
import { includesBoltAvatars } from '@brio/contracts';

/** Presentation only: Brio's global palette, navigation and backgrounds are not themeable. */
export type CompetitionAvatar = Readonly<IdentityDto['avatars'][number]>;
export type CompetitionCharacter = Readonly<IdentityDto['character']>;

export type CompetitionIdentity = Readonly<
  Omit<IdentityDto, 'avatars' | 'avatarMode'> & {
    avatars: readonly CompetitionAvatar[];
    avatarMode?: IdentityDto['avatarMode'];
  }
>;

export const DEFAULT_COMPETITION_IDENTITY: CompetitionIdentity = {
  name: 'Brio',
  character: { kind: 'bolt' },
  avatars: BOLT_AVATARS.map((id, index) => ({ id, src: id, label: `الصورة ${index + 1}` })),
};

/** Empty or removed selections always resolve to a playable default. */
export function identityAvatars(identity: CompetitionIdentity): readonly CompetitionAvatar[] {
  if (identity.avatarMode === 'brio') return DEFAULT_COMPETITION_IDENTITY.avatars;
  if (
    identity.avatarMode &&
    includesBoltAvatars({ avatarMode: identity.avatarMode, avatars: [...identity.avatars] })
  )
    return [...identity.avatars, ...DEFAULT_COMPETITION_IDENTITY.avatars];
  return identity.avatars.length ? identity.avatars : DEFAULT_COMPETITION_IDENTITY.avatars;
}

export function selectedAvatar(identity: CompetitionIdentity, selectedId: string): string {
  const avatars = identityAvatars(identity);
  const character = identity.character;
  const defaultAvatar =
    character.kind === 'image' ? avatars.find((avatar) => avatar.src === character.src) : undefined;
  return avatars.some((avatar) => avatar.id === selectedId) ? selectedId : (defaultAvatar ?? avatars[0]).id;
}

export function resolveAvatarSource(identity: CompetitionIdentity, id: string): string {
  // Existing room snapshots keep their built-in IDs and legacy image URLs.
  if (resolveAvatarIndex(id) !== null) return id;
  return identityAvatars(identity).find((avatar) => avatar.id === id)?.src ?? id;
}
