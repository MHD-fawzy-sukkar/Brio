import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplierAfterTypeChange } from './question-form';

test('switching from Poll restores the standard 1000-point multiplier',()=>{
  assert.equal(multiplierAfterTypeChange('Poll','MultipleChoice','Zero'),'Standard');
  assert.equal(multiplierAfterTypeChange('Poll','TrueFalse','Zero'),'Standard');
  assert.equal(multiplierAfterTypeChange('Poll','ShortAnswer','Zero'),'Standard');
});

test('Poll always forces zero while non-poll changes preserve an explicit multiplier',()=>{
  assert.equal(multiplierAfterTypeChange('MultipleChoice','Poll','Double'),'Zero');
  assert.equal(multiplierAfterTypeChange('MultipleChoice','TrueFalse','Double'),'Double');
});
