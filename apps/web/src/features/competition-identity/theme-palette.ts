import type { CompetitionIdentity } from './model';

export const THEME_PALETTES = {
  brio: { label: 'Brio', color: '#9f3043', soft: '#fff1f3' },
  ocean: { label: 'أزرق', color: '#0369a1', soft: '#f0f9ff' },
  forest: { label: 'أخضر', color: '#047857', soft: '#ecfdf5' },
  violet: { label: 'بنفسجي', color: '#6d28d9', soft: '#f5f3ff' },
  amber: { label: 'كهرماني', color: '#92400e', soft: '#fffbeb' }
} as const;

export function themePalette(identity: CompetitionIdentity) {
  return THEME_PALETTES[identity.accent ?? 'brio'];
}
