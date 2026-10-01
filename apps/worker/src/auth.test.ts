import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogleIdToken } from './auth/google';
import { validateQuestionTypeRules } from './repositories/quiz.repository';
import type { AuthoringQuestion } from '@brio/contracts';

test('verifyGoogleIdToken rejects invalid JWT token format', async () => {
  await assert.rejects(
    async () => {
      await verifyGoogleIdToken('invalid.token', 'test-client-id');
    },
    (err: Error) => err.message.includes('Invalid JWT token format')
  );
});

test('verifyGoogleIdToken allows mock bypass only when explicit dev flag is passed', async () => {
  const result = await verifyGoogleIdToken('mock:sub123:user@brio.com:TestUser', 'my-client-id', {
    allowDevBypass: true
  });
  assert.equal(result.sub, 'sub123');
  assert.equal(result.email, 'user@brio.com');
  assert.equal(result.name, 'TestUser');

  // Fails if allowDevBypass is false
  await assert.rejects(async () => {
    await verifyGoogleIdToken('mock:sub123:user@brio.com:TestUser', 'my-client-id', {
      allowDevBypass: false
    });
  });
});

test('validateQuestionTypeRules validates MultipleChoice questions (exactly 4 options, 1 correct)', () => {
  const validMCQ: AuthoringQuestion = {
    type: 'MultipleChoice',
    text: 'ما هي عاصمة السعودية؟',
    durationMs: 20000,
    multiplier: 'Standard',
    options: [
      { text: 'الرياض', isCorrect: true },
      { text: 'جدة', isCorrect: false },
      { text: 'مكة', isCorrect: false },
      { text: 'الدمام', isCorrect: false }
    ],
    acceptedAlternatives: []
  };

  assert.doesNotThrow(() => validateQuestionTypeRules(validMCQ));

  // Invalid: only 3 options
  const invalidMCQCount: AuthoringQuestion = {
    ...validMCQ,
    options: validMCQ.options.slice(0, 3)
  };
  assert.throws(() => validateQuestionTypeRules(invalidMCQCount), /must have exactly 4 options/);

  // Invalid: 2 correct options
  const invalidMCQCorrect: AuthoringQuestion = {
    ...validMCQ,
    options: [
      { text: 'الرياض', isCorrect: true },
      { text: 'جدة', isCorrect: true },
      { text: 'مكة', isCorrect: false },
      { text: 'الدمام', isCorrect: false }
    ]
  };
  assert.throws(() => validateQuestionTypeRules(invalidMCQCorrect), /must have exactly 1 correct option/);
});

test('validateQuestionTypeRules validates TrueFalse questions (exactly 2 options, 1 correct)', () => {
  const validTF: AuthoringQuestion = {
    type: 'TrueFalse',
    text: 'الرياض عاصمة السعودية؟',
    durationMs: 20000,
    multiplier: 'Standard',
    options: [
      { text: 'صح', isCorrect: true },
      { text: 'خطأ', isCorrect: false }
    ],
    acceptedAlternatives: []
  };

  assert.doesNotThrow(() => validateQuestionTypeRules(validTF));

  const invalidTF: AuthoringQuestion = {
    ...validTF,
    options: [
      { text: 'صح', isCorrect: true },
      { text: 'خطأ', isCorrect: true }
    ]
  };
  assert.throws(() => validateQuestionTypeRules(invalidTF), /must have exactly 1 correct option/);
});

test('validateQuestionTypeRules validates Poll questions (2-4 options, 0 correct)', () => {
  const validPoll: AuthoringQuestion = {
    type: 'Poll',
    text: 'ما هو لوناك المفضل؟',
    durationMs: 20000,
    multiplier: 'Zero',
    options: [
      { text: 'أزرق', isCorrect: false },
      { text: 'أحمر', isCorrect: false },
      { text: 'أخضر', isCorrect: false }
    ],
    acceptedAlternatives: []
  };

  assert.doesNotThrow(() => validateQuestionTypeRules(validPoll));

  const invalidPoll: AuthoringQuestion = {
    ...validPoll,
    options: [
      { text: 'أزرق', isCorrect: true },
      { text: 'أحمر', isCorrect: false }
    ]
  };
  assert.throws(() => validateQuestionTypeRules(invalidPoll), /must not have any correct options marked/);
});

test('validateQuestionTypeRules validates ShortAnswer questions (>=1 accepted alternative)', () => {
  const validSA: AuthoringQuestion = {
    type: 'ShortAnswer',
    text: 'اكتب عاصمة المملكة',
    durationMs: 20000,
    multiplier: 'Standard',
    options: [],
    acceptedAlternatives: ['الرياض']
  };

  assert.doesNotThrow(() => validateQuestionTypeRules(validSA));

  const invalidSA: AuthoringQuestion = {
    ...validSA,
    acceptedAlternatives: []
  };
  assert.throws(() => validateQuestionTypeRules(invalidSA), /must have at least 1 explicit accepted alternative/);
});

test('validateQuestionTypeRules enforces duration limits (10s - 120s)', () => {
  const valid: AuthoringQuestion = {
    type: 'ShortAnswer',
    text: 'اختبار',
    durationMs: 15000,
    multiplier: 'Standard',
    options: [],
    acceptedAlternatives: ['بديل']
  };

  assert.doesNotThrow(() => validateQuestionTypeRules(valid));

  assert.throws(
    () => validateQuestionTypeRules({ ...valid, durationMs: 5000 }),
    /duration must be between 10 and 120 seconds/
  );

  assert.throws(
    () => validateQuestionTypeRules({ ...valid, durationMs: 150000 }),
    /duration must be between 10 and 120 seconds/
  );
});
