import { z } from 'zod';

export const QuestionTypeSchema = z.enum([
  'MultipleChoice',
  'TrueFalse',
  'ShortAnswer',
  'Poll'
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const PointsMultiplierSchema = z.enum([
  'Standard',
  'Double',
  'Zero'
]);

export type PointsMultiplier = z.infer<typeof PointsMultiplierSchema>;

/**
 * Public Player Option DTO - MUST NOT leak isCorrect flag!
 */
export const PublicQuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string()
});

export type PublicQuestionOption = z.infer<typeof PublicQuestionOptionSchema>;

/**
 * Public Player Question DTO - MUST NOT include correct answer keys!
 */
export const PublicQuestionSchema = z.object({
  id: z.string(),
  type: QuestionTypeSchema,
  text: z.string(),
  durationMs: z.number().int().min(10000).max(120000),
  multiplier: PointsMultiplierSchema,
  essentialImage: z.string().nullable().optional(),
  options: z.array(PublicQuestionOptionSchema).optional()
});

export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;

/**
 * Authoring Question Option Schema (Creator view - includes isCorrect)
 */
export const AuthoringQuestionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(200),
  isCorrect: z.boolean()
});

export type AuthoringQuestionOption = z.infer<typeof AuthoringQuestionOptionSchema>;

/**
 * Authoring Question Schema (Creator view)
 */
export const AuthoringQuestionSchema = z.object({
  id: z.string().optional(),
  type: QuestionTypeSchema,
  text: z.string().min(1).max(1000),
  durationMs: z.number().int().min(10000).max(120000).default(20000),
  multiplier: PointsMultiplierSchema.default('Standard'),
  options: z.array(AuthoringQuestionOptionSchema).default([]),
  acceptedAlternatives: z.array(z.string()).default([]),
  essentialImage: z.string().nullable().optional()
});

export type AuthoringQuestion = z.infer<typeof AuthoringQuestionSchema>;

/**
 * Create/Update Quiz Schema
 */
export const SaveQuizRequestSchema = z.object({
  title: z.string().min(1).max(120),
  questions: z.array(AuthoringQuestionSchema).default([])
});

export type SaveQuizRequest = z.infer<typeof SaveQuizRequestSchema>;

/**
 * Creator Quiz Summary DTO
 */
export const QuizSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  questionCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type QuizSummaryDto = z.infer<typeof QuizSummaryDtoSchema>;
