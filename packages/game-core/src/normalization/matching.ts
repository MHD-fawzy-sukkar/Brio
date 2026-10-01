import { normalizeShortAnswer, type NormalizationOptions } from './arabic';

/**
 * Matches a submitted short-answer text against a list of accepted alternatives.
 * Uses deterministic NFC normalization, space trimming, lowercase, case-folding,
 * and optional Arabic diacritic/folding options.
 */
export function matchShortAnswer(
  submittedText: string,
  acceptedAlternatives: string[],
  options?: NormalizationOptions
): boolean {
  if (!submittedText || !acceptedAlternatives || acceptedAlternatives.length === 0) {
    return false;
  }

  const normalizedInput = normalizeShortAnswer(submittedText, options);
  if (!normalizedInput) {
    return false;
  }

  for (const alt of acceptedAlternatives) {
    const normalizedAlt = normalizeShortAnswer(alt, options);
    if (normalizedInput === normalizedAlt) {
      return true;
    }
  }

  return false;
}
