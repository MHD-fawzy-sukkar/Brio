import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionId } from './submission-id';

test('submission IDs work on LAN HTTP where crypto.randomUUID is unavailable', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const secureCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: secureCrypto.getRandomValues.bind(secureCrypto) } });
  try {
    const ids = new Set(Array.from({ length: 100 }, createSubmissionId));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.match(id, /^[a-f0-9]{32}$/);
  } finally { if (original) Object.defineProperty(globalThis, 'crypto', original); }
});
