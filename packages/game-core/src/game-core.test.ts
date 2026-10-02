import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeShortAnswer,
  calculatePoints,
  calculateCompetitionRanks
} from './index';

test('normalizeShortAnswer collapses spaces, applies NFC, case-folding, and optional diacritics', () => {
  assert.equal(normalizeShortAnswer('  مَرحَباً  بِكُم  '), 'مرحبا بكم');
  assert.equal(normalizeShortAnswer(' Hello   WORLD  '), 'hello world');
  // Verify default options DO NOT fold ة/ه or ى/ي automatically (SRS Section 3)
  assert.equal(normalizeShortAnswer('فاطمة'), 'فاطمة');
  assert.equal(normalizeShortAnswer('فاطمه'), 'فاطمه');

  // Verify optional folding when explicitly enabled
  assert.equal(normalizeShortAnswer('فاطمة', { foldTehMarbuta: true }), 'فاطمه');
});

test('calculatePoints calculates correct standard, double, zero points', () => {
  assert.equal(calculatePoints(true, 'Standard'), 1000);
  assert.equal(calculatePoints(true, 'Double'), 2000);
  assert.equal(calculatePoints(true, 'Zero'), 0);
  assert.equal(calculatePoints(false, 'Standard'), 0);
  assert.equal(calculatePoints(true, 'Standard', 0, 20000), 1000);
  assert.equal(calculatePoints(true, 'Standard', 10000, 20000), 750);
  assert.equal(calculatePoints(true, 'Standard', 20000, 20000), 500);
});

test('calculateCompetitionRanks calculates competition ranks (1,1,3) with join order tie-breaking for display', () => {
  const players = [
    { id: 'p1', score: 1000, joinedAt: 100 },
    { id: 'p2', score: 2000, joinedAt: 200 },
    { id: 'p3', score: 2000, joinedAt: 150 }, // Tied with p2 at 2000 points
    { id: 'p4', score: 500, joinedAt: 300 }
  ];

  const ranked = calculateCompetitionRanks(players);

  assert.equal(ranked.length, 4);
  // Both top players have 2000 points, so both get rank 1
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 1);
  // p1 with 1000 points gets rank 3 (1, 1, 3 tie policy)
  assert.equal(ranked[2].rank, 3);
  assert.equal(ranked[2].id, 'p1');
  // p4 with 500 points gets rank 4
  assert.equal(ranked[3].rank, 4);
  assert.equal(ranked[3].id, 'p4');
});
