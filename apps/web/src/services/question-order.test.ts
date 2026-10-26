import test from 'node:test';
import assert from 'node:assert/strict';
import { moveQuestion } from './question-order';
test('dragging up/down and keyboard movement keep every question exactly once', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveQuestion(ids, 'a', 'd', true), ['b', 'c', 'd', 'a']);
  assert.deepEqual(moveQuestion(ids, 'd', 'b'), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveQuestion(ids, 'b', 'c', true), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveQuestion(ids, 'missing', 'b'), ids);
  assert.deepEqual(moveQuestion(ids, 'b', 'b'), ids);
  assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
});
