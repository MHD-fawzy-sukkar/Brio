import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

/**
 * Standard RFC 7807 Problem Details Error Schema
 */
export const ErrorResponseSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int(),
  code: z.string(),
  traceId: z.string(),
  detail: z.string(),
  errors: z.record(z.array(z.string())).optional()
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Game Phases supported in the live protocol
 */
export const GamePhaseSchema = z.enum([
  'LOBBY',
  'COUNTDOWN',
  'QUESTION',
  'STATS',
  'LEADERBOARD',
  'FINISHED',
  'PAUSED',
  'RECOVERY_PAUSED'
]);

export type GamePhase = z.infer<typeof GamePhaseSchema>;

/**
 * Client-to-Server Socket Message Envelopes
 */
export const ClientMessageTypeSchema = z.enum([
  'room.resume',
  'clock.sample',
  'answer.submit',
  'media.status',
  'host.start',
  'host.pause',
  'host.resume',
  'host.end',
  'host.recover'
]);

export type ClientMessageType = z.infer<typeof ClientMessageTypeSchema>;

export const ClientSocketMessageSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: ClientMessageTypeSchema,
  requestId: z.string().uuid(),
  roomId: z.string(),
  payload: z.unknown()
});

export type ClientSocketMessage = z.infer<typeof ClientSocketMessageSchema>;

/**
 * Server-to-Client Socket Message Envelopes
 */
export const ServerMessageTypeSchema = z.enum([
  'room.snapshot',
  'room.state',
  'round.scheduled',
  'answer.receipt',
  'answer.rejected',
  'host.answer-count',
  'round.results',
  'leaderboard',
  'room.finished',
  'connection.replaced',
  'clock.sample',
  'error'
]);

export type ServerMessageType = z.infer<typeof ServerMessageTypeSchema>;

export const ServerSocketMessageSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: ServerMessageTypeSchema,
  roomId: z.string().optional(),
  requestId: z.string().optional(),
  stateVersion: z.number().int().optional(),
  serverNow: z.number().int(),
  payload: z.unknown()
});

export type ServerSocketMessage = z.infer<typeof ServerSocketMessageSchema>;
