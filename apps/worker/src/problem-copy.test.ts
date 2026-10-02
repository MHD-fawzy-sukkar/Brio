import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeProblemDetail } from './problem-copy';

test('localizes common API and quiz validation errors',()=>{
  assert.equal(localizeProblemDetail('Authentication required'),'يرجى تسجيل الدخول للمتابعة.');
  assert.equal(localizeProblemDetail('MultipleChoice questions must have at least 2 options'),'أضف خيارين على الأقل لهذا السؤال.');
});
