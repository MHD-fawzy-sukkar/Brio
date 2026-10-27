import { catalog } from './messages';
export type Locale = 'ar' | 'en';
export const LANGUAGE_KEY = 'brio_language_v1';
let locale: Locale = 'ar';
const listeners = new Set<() => void>();
export const getLocale = () => locale;
export const serverLocale = (): Locale => 'ar';
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setLocale(next: Locale) {
  if (next !== 'ar' && next !== 'en') return;
  const changed = locale !== next;
  locale = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* Storage is optional. */
  }
  if (changed) for (const listener of listeners) listener();
}
export function initializeLocale() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  } catch {
    /* Arabic remains the default when storage is unavailable. */
  }
}
export function t(
  source: string,
  values?: Record<string, string | number>,
  language: Locale = getLocale(),
): string {
  let template = language === 'en' ? (catalog[source] ?? source) : source;
  if (language === 'en' && values?.[0] === 1) {
    if (source === '{0} أسئلة في المسابقة' || source === '{0} سؤال في هذه المسابقة')
      template = '{0} question in this quiz';
    if (source === '{0} صورة مختارة · حتى 20 صورة') template = '{0} image selected · Up to 20 images';
    if (source === 'تم اختيار {0} صورة. الحد الأقصى 20 صورة.')
      template = '{0} image selected. The limit is 20.';
  }
  return values ? template.replace(/\{(\d+)\}/g, (match, key) => String(values[key] ?? match)) : template;
}
export function countNoun(source: string, count: number, language: Locale = getLocale()) {
  if (language === 'ar') return source;
  const nouns: Record<string, [string, string]> = {
    سؤال: ['question', 'questions'],
    مسابقة: ['quiz', 'quizzes'],
    نقطة: ['point', 'points'],
    'صورة للاعبين': ['player image', 'player images'],
    'صورة للاعبين ·': ['player image ·', 'player images ·'],
  };
  return nouns[source]?.[count === 1 ? 0 : 1] ?? t(source, undefined, language);
}
// Error text may be stored before the user changes language. Resolve both directions.
const reverse = new Map(Object.entries(catalog).map(([ar, en]) => [en, ar]));
const templates = Object.entries(catalog)
  .filter(([ar]) => /\{\d+\}/.test(ar))
  .map(([ar, en]) => {
    const compile = (text: string) =>
      new RegExp(
        '^' +
          text
            .split(/\{\d+\}/)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('(.*?)') +
          '$',
      );
    return { ar, en, arabic: compile(ar), english: compile(en) };
  });
export function translateMessage(message: string, language: Locale = getLocale()): string {
  if (!message) return '';
  if (
    /^(Failed to fetch|fetch failed|Load failed|Network request failed|NetworkError when attempting to fetch resource\.?)$/i.test(
      message,
    )
  )
    return t('تعذّر الاتصال بخدمة الموقع. حدّث الصفحة وحاول مجدداً.', undefined, language);
  if (
    /^(AbortError|The operation was aborted|The user aborted a request|signal is aborted|The operation was aborted due to timeout)/i.test(
      message,
    )
  )
    return t('استغرق التحميل وقتاً أطول من المتوقع. حاول مجدداً.', undefined, language);
  const source = reverse.get(message) ?? message;
  if (catalog[source]) return t(source, undefined, language);
  for (const item of templates) {
    const match = item.arabic.exec(message) ?? item.english.exec(message);
    if (match)
      return t(
        item.ar,
        Object.fromEntries(match.slice(1).map((value, index) => [String(index), value])),
        language,
      );
  }
  return message;
}
export const numberLocale = () => (getLocale() === 'ar' ? 'ar' : 'en');
