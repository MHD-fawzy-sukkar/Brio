import { t } from '../../i18n/locale';
import type { AuthoringQuestion, PointsMultiplier, QuestionType } from '@brio/contracts';
export type StoredQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  duration_ms: number;
  multiplier: PointsMultiplier;
  media_url?: string | null;
  essentialImage?: string | null;
  options: { text: string; is_correct: number }[];
  acceptedAlternatives?: string[];
};

export const fromStored = (found: StoredQuestion): AuthoringQuestion => ({
  id: found.id,
  type: found.type,
  text: found.text,
  durationMs: found.duration_ms,
  multiplier: found.multiplier,
  essentialImage: null,
  options: (found.options ?? []).map((option) => ({ text: option.text, isCorrect: option.is_correct === 1 })),
  acceptedAlternatives: found.acceptedAlternatives ?? [],
});

export const typeLabels: Record<QuestionType, string> = {
  get MultipleChoice() {
    return t('اختيار من متعدد');
  },
  get TrueFalse() {
    return t('صح أو خطأ');
  },
  get ShortAnswer() {
    return t('إجابة قصيرة');
  },
  get Poll() {
    return t('استطلاع رأي');
  },
};

export const blankOptions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ text: '', isCorrect: index === 0 }));
