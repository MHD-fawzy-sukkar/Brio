import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JoinRoomRequestSchema,
  GoogleAuthRequestSchema,
  SubmitAnswerPayloadSchema,
  ErrorResponseSchema,
  PROTOCOL_VERSION
} from './index';

test('JoinRoomRequestSchema validates correct room code and nickname', () => {
  const valid = JoinRoomRequestSchema.parse({
    code: '123456',
    nickname: 'أحمد',
    avatarId: '/avatars/avatar-1.svg'
  });
  assert.equal(valid.code, '123456');
  assert.equal(valid.nickname, 'أحمد');

  assert.throws(() => {
    JoinRoomRequestSchema.parse({ code: '123', nickname: '', avatarId: '' });
  });
});

test('GoogleAuthRequestSchema requires non-empty idToken', () => {
  const valid = GoogleAuthRequestSchema.parse({ idToken: 'valid-token' });
  assert.equal(valid.idToken, 'valid-token');

  assert.throws(() => {
    GoogleAuthRequestSchema.parse({ idToken: '' });
  });
});

test('ErrorResponseSchema parses RFC 7807 problem details structure', () => {
  const err = ErrorResponseSchema.parse({
    status: 404,
    code: 'not_found',
    traceId: 'uuid-1234',
    detail: 'Resource not found'
  });
  assert.equal(err.status, 404);
  assert.equal(err.code, 'not_found');
  assert.equal(PROTOCOL_VERSION, 1);
});
