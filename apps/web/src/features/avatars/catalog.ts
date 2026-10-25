export const AVATAR_EYE_STYLES = ['round', 'wink', 'joyful', 'sparkle', 'heart', 'curious', 'sleepy', 'focused'] as const;
export type AvatarEyeStyle = typeof AVATAR_EYE_STYLES[number];
export const AVATAR_VARIANT_COUNT = 15;
export const BOLT_AVATARS = Array.from({ length: AVATAR_VARIANT_COUNT }, (_, index) => `bolt-avatar-${String(index + 1).padStart(2, '0')}`);

export function resolveAvatarIndex(source: string): number | null {
  // Keep saved player identities compatible while removing the old artwork.
  const match = /^(?:bolt-avatar-|avatar_)(\d+)$/.exec(source)
    ?? /(?:^|\/)avatars\/avatar-(\d+)\.svg$/.exec(source);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < AVATAR_VARIANT_COUNT ? index : null;
}

export function avatarVariant(playerIndex: number) {
  const safeIndex = Number.isFinite(playerIndex) ? Math.trunc(playerIndex) : 0;
  const index = ((safeIndex % AVATAR_VARIANT_COUNT) + AVATAR_VARIANT_COUNT) % AVATAR_VARIANT_COUNT;
  const hue = index * (360 / AVATAR_VARIANT_COUNT);
  return { hue, eyeStyle: AVATAR_EYE_STYLES[index % AVATAR_EYE_STYLES.length], glow: `hsl(${(hue + 345) % 360} 75% 55% / .45)` };
}
