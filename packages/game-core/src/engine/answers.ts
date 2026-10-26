import type {
  GameState,
  PublishedQuizSnapshot,
  PublishedQuestion,
  AnswerSubmissionInput,
  AnswerSubmissionResult,
  AnswerRecord,
} from './types';
import { calculatePoints } from '../scoring/rules';
import { matchShortAnswer } from '../normalization/matching';

export function processAnswerSubmission(
  state: GameState,
  quiz: PublishedQuizSnapshot,
  input: AnswerSubmissionInput,
  now: number,
): AnswerSubmissionResult {
  const { playerId, roundId, submissionId, optionId, textAnswer } = input;

  const key = `${roundId}:${playerId}`;
  const existingAnswer = state.answers.get(key);

  // 1. Idempotency Check: Same submissionId and roundId returns existing receipt even after close
  if (existingAnswer) {
    if (existingAnswer.submissionId === submissionId) {
      return {
        status: existingAnswer.status,
        receipt: {
          submissionId,
          roundId,
          status: existingAnswer.status,
          acceptedAt: existingAnswer.receivedAt,
        },
      };
    }
    // Conflicting payload or second answer for same round
    return {
      status: 'rejected',
      reason: 'Player has already submitted an answer for this round',
    };
  }

  // 2. Reject duplicate submissionId used across different rounds
  if (state.submissionIds.has(submissionId)) {
    return {
      status: 'rejected',
      reason: 'Duplicate submission ID',
    };
  }

  // 3. Active Round & Phase Validation
  if (state.phase !== 'QUESTION' || !state.activeRound || state.activeRound.roundId !== roundId) {
    return {
      status: 'rejected',
      reason: `Answer submitted outside active question round (Current phase: ${state.phase})`,
    };
  }

  // 4. Time Deadline Enforcement: receivedAt MUST be startsAt <= now < endsAt
  // Reject now >= endsAt even if server close alarm is late!
  if (now < state.activeRound.startsAt || now >= state.activeRound.endsAt) {
    return {
      status: 'rejected',
      reason: 'Answer submitted outside question time deadline',
    };
  }

  // 5. Store Accepted Answer Record in Memory (DO NOT score yet!)
  const digest = `${optionId || ''}:${textAnswer || ''}`;
  const record: AnswerRecord = {
    roundId,
    playerId,
    submissionId,
    payloadDigest: digest,
    optionId,
    textAnswer,
    receivedAt: now,
    status: 'accepted',
  };

  state.answers.set(key, record);
  state.submissionIds.add(submissionId);
  // Every accepted answer is observable room state and must receive a new version.
  state.stateVersion++;

  return {
    status: 'accepted',
    receipt: {
      submissionId,
      roundId,
      status: 'accepted',
      acceptedAt: now,
    },
  };
}

export function scoreRound(state: GameState, question: PublishedQuestion): void {
  if (!state.activeRound || state.activeRound.scored) return;

  const roundId = state.activeRound.roundId;

  for (const [key, ans] of state.answers.entries()) {
    if (ans.roundId !== roundId || ans.status !== 'accepted') continue;

    let isCorrect = false;

    if (question.type === 'MultipleChoice' || question.type === 'TrueFalse') {
      const matchOpt = question.options.find((o) => o.id === ans.optionId);
      isCorrect = matchOpt ? matchOpt.isCorrect : false;
    } else if (question.type === 'ShortAnswer') {
      isCorrect = matchShortAnswer(ans.textAnswer || '', question.acceptedAlternatives);
    } else if (question.type === 'Poll') {
      isCorrect = false; // Polls have no correctness
    }

    const responseTimeMs = Math.max(0, ans.receivedAt - state.activeRound.startsAt);
    const points = calculatePoints(isCorrect, question.multiplier, responseTimeMs, question.durationMs);
    ans.isCorrect = isCorrect;
    ans.pointsAwarded = points;

    // Update Player Score
    const player = state.players.get(ans.playerId);
    if (player) {
      player.score += points;
    }
  }

  state.activeRound.scored = true;
}
