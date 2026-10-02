import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyGameError } from './game-copy';

test('converts server gameplay errors into clear Arabic UX copy',()=>{
  assert.equal(friendlyGameError('Player has already submitted an answer for this round'),'تم تسجيل إجابتك مسبقاً لهذا السؤال.');
  assert.equal(friendlyGameError('Answer submitted outside question time deadline'),'انتهى وقت الإجابة على هذا السؤال.');
});
