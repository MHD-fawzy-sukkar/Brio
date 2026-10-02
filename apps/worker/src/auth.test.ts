import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogleIdToken } from './auth/google';
import { buildSessionCookie, createSessionInfo } from './auth/session';
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

test('remember me creates a persistent secure cookie only when requested', async () => {
  const regular = buildSessionCookie('token', true, false);
  const remembered = buildSessionCookie('token', true, true);
  assert.equal(regular.includes('Max-Age='), false);
  assert.equal(regular.includes('SameSite=Lax'), true);
  assert.equal(regular.includes('Secure'), true);
  assert.equal(remembered.includes('Max-Age=2592000'), true);

  const shortSession = await createSessionInfo(false);
  const longSession = await createSessionInfo(true);
  assert.ok(Date.parse(longSession.expiresAt) > Date.parse(shortSession.expiresAt));
});

test('validateQuestionTypeRules validates MultipleChoice questions (2+ dynamic options, 1 correct)', () => {
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

  assert.doesNotThrow(() => validateQuestionTypeRules({
    ...validMCQ,
    options: [...validMCQ.options, { text: 'الخبر', isCorrect: false }, { text: 'أبها', isCorrect: false }]
  }));

  // Invalid: fewer than 2 options
  const invalidMCQCount: AuthoringQuestion = {
    ...validMCQ,
    options: validMCQ.options.slice(0, 1)
  };
  assert.throws(() => validateQuestionTypeRules(invalidMCQCount), /must have at least 2 options/);

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

test('validateQuestionTypeRules validates Poll questions (2+ dynamic options, 0 correct)', () => {
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
  assert.doesNotThrow(() => validateQuestionTypeRules({
    ...validPoll,
    options: Array.from({ length: 8 }, (_, index) => ({ text: `خيار ${index + 1}`, isCorrect: false }))
  }));

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
