import type {
  GamePhase,
  QuestionType,
  PointsMultiplier,
  PlayerSnapshotDto,
  HostSnapshotDto,
  PublicQuestion
} from '@brio/contracts';

export interface PublishedOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface PublishedQuestion {
  id: string;
  type: QuestionType;
  text: string;
  durationMs: number;
  multiplier: PointsMultiplier;
  essentialImage?: string | null;
  options: PublishedOption[];
  acceptedAlternatives: string[];
}

export interface PublishedQuizSnapshot {
  id: string;
  title: string;
  revision: number;
  questions: PublishedQuestion[];
}

export interface PlayerState {
  id: string;
  nickname: string;
  avatarId: string;
  score: number;
  joinedAt: number;
  connectionGeneration: number;
}

export interface AnswerRecord {
  roundId: string;
  playerId: string;
  submissionId: string;
  payloadDigest: string;
  optionId?: string;
  textAnswer?: string;
  receivedAt: number;
  status: 'accepted' | 'rejected' | 'duplicate';
  isCorrect?: boolean;
  pointsAwarded?: number;
}

export interface ActiveRoundState {
  roundId: string;
  questionIndex: number;
  questionId: string;
  type: QuestionType;
  startsAt: number;
  endsAt: number;
  statsEndsAt: number;
  rankingEndsAt: number;
  closed: boolean;
  scored: boolean;
}

export interface GameState {
  roomId: string;
  quizVersionId: string;
  phase: GamePhase;
  stateVersion: number;
  currentQuestionIndex: number;
  activeRound: ActiveRoundState | null;
  players: Map<string, PlayerState>;
  answers: Map<string, AnswerRecord>; // Keyed by `${roundId}:${playerId}`
  submissionIds: Set<string>;
  pausedQueued: boolean;
  interruptedRoundId: string | null;
}

export interface AnswerSubmissionInput {
  playerId: string;
  roundId: string;
  submissionId: string;
  optionId?: string;
  textAnswer?: string;
}

export interface AnswerSubmissionResult {
  status: 'accepted' | 'duplicate' | 'rejected';
  reason?: string;
  receipt?: {
    submissionId: string;
    roundId: string;
    status: 'accepted' | 'duplicate' | 'rejected';
    acceptedAt: number;
  };
}

export type EngineEffectType =
  | 'PERSIST_STATE'
  | 'BROADCAST_STATE'
  | 'SCHEDULE_ALARM'
  | 'CANCEL_ALARM'
  | 'ENTER_RECOVERY_PAUSED';

export interface EngineEffect {
  type: EngineEffectType;
  dueAt?: number;
  actionName?: string;
  reason?: string;
}
