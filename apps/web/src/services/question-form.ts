import type { PointsMultiplier, QuestionType } from '@brio/contracts';

export function multiplierAfterTypeChange(previous:QuestionType,next:QuestionType,current:PointsMultiplier):PointsMultiplier {
  if (next==='Poll') return 'Zero';
  if (previous==='Poll') return 'Standard';
  return current;
}
