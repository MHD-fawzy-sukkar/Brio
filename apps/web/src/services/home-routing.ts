export type HomeExperience = 'loading' | 'dashboard' | 'join';

export function resolveHomeExperience(loading: boolean, authenticated: boolean): HomeExperience {
  if (loading) return 'loading';
  return authenticated ? 'dashboard' : 'join';
}

export function normalizePin(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '').slice(0, 6);
}
