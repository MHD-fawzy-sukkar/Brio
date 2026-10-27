import { t } from '../../i18n/locale';
import type { AuthoringQuestion, QuestionType } from '@brio/contracts';
export const questionTypeLabels: Record<QuestionType, string> = {
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

export interface QuizDetail {
  identity_id?: string | null;
  id: string;
  title: string;
  cover_image_url?: string | null;
  coverImageUrl?: string | null;
  revision: number;
  questions: Array<
    AuthoringQuestion & {
      id: string;
      duration_ms?: number;
      media_url?: string | null;
      options: Array<{ id?: string; text: string; is_correct?: number; isCorrect?: boolean }>;
    }
  >;
}
