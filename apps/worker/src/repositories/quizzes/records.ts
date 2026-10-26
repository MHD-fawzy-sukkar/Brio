import type { QuestionType, PointsMultiplier } from '@brio/contracts';

export interface QuizRecord {
  id: string;
  creator_id: string;
  title: string;
  revision: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  cover_image_url: string | null;
  identity_id: string | null;
}

export interface QuestionRecord {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  text: string;
  duration_ms: number;
  multiplier: PointsMultiplier;
  media_id: string | null;
  media_url: string | null;
  essential: number;
  normalization_json: string | null;
}

export interface OptionRecord {
  id: string;
  question_id: string;
  position: number;
  text: string;
  is_correct: number;
}

export interface AlternativeRecord {
  id: string;
  question_id: string;
  normalized_value: string;
}

export interface QuizDetailRecord extends QuizRecord {
  questions: Array<
    QuestionRecord & {
      options: OptionRecord[];
      acceptedAlternatives: string[];
    }
  >;
}
