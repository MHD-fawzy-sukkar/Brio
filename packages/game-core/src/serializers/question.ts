import type { PublicQuestion, PublicQuestionOption } from '@brio/contracts';
import type { PublishedQuestion } from '../engine/types';
export function toPublicQuestion(question: PublishedQuestion): PublicQuestion {
  const publicOptions: PublicQuestionOption[] = question.options.map((opt) => ({
    id: opt.id,
    text: opt.text,
  }));

  return {
    id: question.id,
    type: question.type,
    text: question.text,
    durationMs: question.durationMs,
    multiplier: question.multiplier,
    essentialImage: question.essentialImage || null,
    options: publicOptions,
  };
}
