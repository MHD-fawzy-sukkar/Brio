export const AVATAR_VARIANT_COUNT = 15;

export function avatarVariant(playerIndex: number) {
  const safeIndex = Number.isFinite(playerIndex) ? Math.trunc(playerIndex) : 0;
  const index = ((safeIndex % AVATAR_VARIANT_COUNT) + AVATAR_VARIANT_COUNT) % AVATAR_VARIANT_COUNT;
  const hue = index * (360 / AVATAR_VARIANT_COUNT);
  const frontFacing = index % 5 === 0;
  return {
    hue,
    direction: frontFacing || index % 2 === 0 ? 1 : -1,
    tilt: frontFacing ? 0 : [-8, 0, 8][index % 3],
    glow: `hsl(${(hue + 345) % 360} 75% 55% / .45)`
  };
}
