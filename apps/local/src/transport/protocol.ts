import { type IncomingMessage } from 'node:http';
import { createHash } from 'node:crypto';
import { WebSocket } from 'ws';
import { z } from 'zod';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export const cookie = (req: IncomingMessage, name: string) =>
  (req.headers.cookie || '')
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';

export const playerCookie = (id: string) => `brio_lan_${id}`;

export const joinSchema = z.object({
  nickname: z.string().trim().min(2).max(20),
  avatarId: z.string().min(1).max(100).default('avatar_1'),
});

export const answerSchema = z.object({
  roundId: z.string().max(160),
  submissionId: z.string().min(1).max(100),
  optionId: z.string().max(100).optional(),
  textAnswer: z.string().max(200).optional(),
});

export const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Connection = {
  ws: WebSocket;
  roomId: string;
  playerId?: string;
  host: boolean;
  recent: number[];
};
