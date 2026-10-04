import { AVATAR_EYE_STYLES } from './AvatarEyes';

export const AVATAR_VARIANT_COUNT = 15;

export function avatarVariant(playerIndex: number) {
  const safeIndex = Number.isFinite(playerIndex) ? Math.trunc(playerIndex) : 0;
  const index = ((safeIndex % AVATAR_VARIANT_COUNT) + AVATAR_VARIANT_COUNT) % AVATAR_VARIANT_COUNT;
  const hue = index * (360 / AVATAR_VARIANT_COUNT);
  return {
    hue,
    eyeStyle: AVATAR_EYE_STYLES[index % AVATAR_EYE_STYLES.length],
    direction: 1,
    tilt: 0,
    glow: `hsl(${(hue + 345) % 360} 75% 55% / .45)`
  };
}
