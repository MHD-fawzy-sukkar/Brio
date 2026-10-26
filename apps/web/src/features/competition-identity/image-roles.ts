import type { SaveIdentityRequest } from '@brio/contracts';
type ThemeImage = SaveIdentityRequest['images'][number];

/** Logo artwork stays in logo placements. One player image can also be the mascot. */
export function assignSpecialImage<T extends ThemeImage>(
  images: T[],
  role: 'logo' | 'character',
  id: string,
): T[] {
  const previousLogo = images.find((image) => image.roles.includes('logo'))?.mediaId;
  const previousCharacter = images.find((image) => image.roles.includes('character'))?.mediaId;
  const logo = role === 'logo' ? id : previousLogo === id ? undefined : previousLogo;
  const character = role === 'character' ? id : previousCharacter === id ? undefined : previousCharacter;
  return images.map((image) => ({
    ...image,
    roles:
      image.mediaId === logo ? ['logo'] : image.mediaId === character ? ['avatar', 'character'] : ['avatar'],
  }));
}
