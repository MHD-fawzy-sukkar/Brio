import type { AuthoringQuestion, QuestionType } from '@brio/contracts';
export const questionTypeLabels: Record<QuestionType, string> = {
  MultipleChoice: 'اختيار من متعدد',
  TrueFalse: 'صح أو خطأ',
  ShortAnswer: 'إجابة قصيرة',
  Poll: 'استطلاع رأي',
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
