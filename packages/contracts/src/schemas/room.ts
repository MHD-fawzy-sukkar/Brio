import { z } from 'zod';
import { GamePhaseSchema } from '../protocol';
import { PublicQuestionSchema } from './quiz';

export const JoinRoomRequestSchema = z.object({
  code: z.string().length(6, 'Room code must be exactly 6 characters'),
  nickname: z.string().min(1, 'Nickname is required').max(24, 'Nickname cannot exceed 24 characters'),
  avatarId: z.string().min(1, 'Avatar is required')
});

export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;

export const JoinRoomResponseSchema = z.object({
  roomId: z.string(),
  playerId: z.string(),
  nickname: z.string(),
  avatarId: z.string(),
  sessionToken: z.string()
});

export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>;

export const CreateRoomRequestSchema = z.object({
  quizId: z.string().uuid()
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const CreateRoomResponseSchema = z.object({
  roomId: z.string(),
  code: z.string()
});

export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

export const SubmitAnswerPayloadSchema = z.object({
  roundId: z.string(),
  submissionId: z.string().uuid(),
  optionId: z.string().optional(),
  textAnswer: z.string().max(200).optional()
});

export type SubmitAnswerPayload = z.infer<typeof SubmitAnswerPayloadSchema>;

export const AnswerReceiptSchema = z.object({
  submissionId: z.string().uuid(),
  roundId: z.string(),
  status: z.enum(['accepted', 'duplicate', 'rejected']),
  acceptedAt: z.number().int()
});

export type AnswerReceipt = z.infer<typeof AnswerReceiptSchema>;

/**
 * Player Snapshot DTO - Role-isolated for Player UI
 * Contains only own score, own rank, top 5, and current public question (without answer keys)
 */
export const PlayerSnapshotDtoSchema = z.object({
  role: z.literal('player'),
  roomId: z.string(),
  phase: GamePhaseSchema,
  stateVersion: z.number().int(),
  roundId: z.string().nullable(),
  questionIndex: z.number().int().nullable(),
  phaseStartedAt: z.number().int(),
  phaseEndsAt: z.number().int(),
  question: PublicQuestionSchema.nullable(),
  ownScore: z.number().int(),
  ownRank: z.number().int().nullable(),
  topPlayers: z.array(
    z.object({
      nickname: z.string(),
      avatarId: z.string(),
      score: z.number().int(),
      rank: z.number().int()
    })
  ),
  lobbyPlayers: z.array(z.object({ id: z.string(), nickname: z.string(), avatarId: z.string() }))
});

export type PlayerSnapshotDto = z.infer<typeof PlayerSnapshotDtoSchema>;

/**
 * Host Snapshot DTO - Contains host administrative state & live response counts
 */
export const HostSnapshotDtoSchema = z.object({
  role: z.literal('host'),
  roomId: z.string(),
  code: z.string(),
  phase: GamePhaseSchema,
  stateVersion: z.number().int(),
  roundId: z.string().nullable(),
  questionIndex: z.number().int().nullable(),
  phaseStartedAt: z.number().int(),
  phaseEndsAt: z.number().int(),
  playerCount: z.number().int(),
  lobbyPlayers: z.array(z.object({ id: z.string(), nickname: z.string(), avatarId: z.string() })),
  acceptedAnswersCount: z.number().int().optional(),
  question: PublicQuestionSchema.nullable()
});

export type HostSnapshotDto = z.infer<typeof HostSnapshotDtoSchema>;
