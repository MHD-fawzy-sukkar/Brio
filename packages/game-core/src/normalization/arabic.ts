export interface NormalizationOptions {
  stripDiacritics?: boolean;
  stripTatweel?: boolean;
  foldAlef?: boolean;
  foldTehMarbuta?: boolean; // Default false; optional per quiz setting
  foldAlefMaksura?: boolean; // Default false; optional per quiz setting
}

export const DEFAULT_NORMALIZATION_OPTIONS: NormalizationOptions = {
  stripDiacritics: true,
  stripTatweel: true,
  foldAlef: true,
  foldTehMarbuta: false,
  foldAlefMaksura: false
};

/**
 * Normalizes short-answer text deterministically.
 * Per SRS-Architecture.md Section 3:
 * - Trim leading/trailing spaces
 * - Collapse multiple internal spaces
 * - Apply Unicode NFC
 * - Case-fold Latin characters
 * - Optional Arabic diacritic/tatweel removal and alef folding
 * - DOES NOT automatically merge ة/ه or ى/ي unless explicitly enabled by options.
 */
export function normalizeShortAnswer(input: string, options: NormalizationOptions = DEFAULT_NORMALIZATION_OPTIONS): string {
  if (!input) return '';

  // 1. Unicode NFC & Trim & Lowercase
  let text = input.normalize('NFC').trim().toLowerCase();

  // 2. Collapse internal whitespace
  text = text.replace(/\s+/g, ' ');

  // 3. Optional Tatweel removal (U+0640)
  if (options.stripTatweel !== false) {
    text = text.replace(/\u0640/g, '');
  }

  // 4. Optional Arabic Diacritics (Tashkeel) removal (U+064B - U+0652, U+0670)
  if (options.stripDiacritics !== false) {
    text = text.replace(/[\u064B-\u0652\u0670]/g, '');
  }

  // 5. Optional Alef folding (أ, إ, آ -> ا)
  if (options.foldAlef !== false) {
    text = text.replace(/[\u0622\u0623\u0625]/g, '\u0627');
  }

  // 6. Optional Teh Marbuta folding (ة -> ه)
  if (options.foldTehMarbuta === true) {
    text = text.replace(/\u0629/g, '\u0647');
  }

  // 7. Optional Alef Maksura folding (ى -> ي)
  if (options.foldAlefMaksura === true) {
    text = text.replace(/\u0649/g, '\u064A');
  }

  return text.trim();
}
