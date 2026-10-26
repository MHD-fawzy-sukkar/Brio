import type { AuthoringQuestion } from '@brio/contracts';

export function validateQuestionTypeRules(q: AuthoringQuestion): void {
  if (q.durationMs < 10000 || q.durationMs > 120000) {
    throw new Error('Question duration must be between 10 and 120 seconds (10,000ms - 120,000ms)');
  }

  switch (q.type) {
    case 'MultipleChoice': {
      if (!q.options || q.options.length < 2) {
        throw new Error('MultipleChoice questions must have at least 2 options');
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new Error('MultipleChoice questions must have exactly 1 correct option');
      }
      break;
    }
    case 'TrueFalse': {
      if (!q.options || q.options.length !== 2) {
        throw new Error('TrueFalse questions must have exactly 2 options');
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new Error('TrueFalse questions must have exactly 1 correct option');
      }
      break;
    }
    case 'Poll': {
      if (!q.options || q.options.length < 2) {
        throw new Error('Poll questions must have at least 2 options');
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 0) {
        throw new Error('Poll questions must not have any correct options marked');
      }
      break;
    }
    case 'ShortAnswer': {
      if (!q.acceptedAlternatives || q.acceptedAlternatives.length < 1) {
        throw new Error('ShortAnswer questions must have at least 1 explicit accepted alternative');
      }
      break;
    }
    default:
      throw new Error(`Unsupported question type: ${q.type}`);
  }
}
