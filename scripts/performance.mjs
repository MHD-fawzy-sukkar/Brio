import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import * as baseline from '../benchmarks/snapshot-before.ts';
import {
  createInitialGameState,
  createSnapshotProjection,
  toPublicPlayerSnapshot,
  toPublicHostSnapshot,
} from '../packages/game-core/src/index.ts';
const baselineCommit = 'c711fd2a3d07838b825e08389dd9ba933379d1ee';
const quiz = {
  id: 'bench-version',
  revision: 1,
  title: 'Performance fixture',
  questions: [
    {
      id: 'q',
      type: 'MultipleChoice',
      text: 'Question',
      durationMs: 20000,
      multiplier: 'Standard',
      options: [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
      ],
      acceptedAlternatives: [],
    },
  ],
};
const state = createInitialGameState('bench-room', quiz.id);
for (let i = 0; i < 150; i++)
  state.players.set(`p${i}`, {
    id: `p${i}`,
    nickname: `Player ${i}`,
    avatarId: 'avatar_1',
    joinedAt: i,
    score: (i % 17) * 100,
    connectionGeneration: 1,
  });
const ids = [...state.players.keys()];
function render(shared) {
  const projection = shared ? createSnapshotProjection(state, quiz) : undefined;
  return shared
    ? [
        toPublicHostSnapshot(state, quiz, projection),
        ...ids.map((id) => toPublicPlayerSnapshot(state, id, quiz, projection)),
      ]
    : [
        baseline.toPublicHostSnapshot(state, quiz),
        ...ids.map((id) => baseline.toPublicPlayerSnapshot(state, id, quiz)),
      ];
}
assert.deepEqual(render(true), render(false));
const measure = (shared) => {
  const samples = [];
  for (let i = 0; i < 10; i++) render(shared);
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    render(shared);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return { p50Ms: +samples[50].toFixed(3), p95Ms: +samples[95].toFixed(3) };
};
const independent = measure(false),
  shared = measure(true);
const report = {
  baselineCommit,
  players: 150,
  iterations: 100,
  workload:
    'Host + 150 player DTOs per broadcast; ranking/projection only, excludes network and JSON transport',
  independent,
  shared,
  reductionP50Percent: +((1 - shared.p50Ms / independent.p50Ms) * 100).toFixed(1),
  identicalSnapshots: true,
};
console.log(JSON.stringify(report, null, 2));
fs.mkdirSync('docs/performance', { recursive: true });
fs.writeFileSync('docs/performance/snapshot-projection.json', JSON.stringify(report, null, 2) + '\n');
