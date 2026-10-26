import test from 'node:test';
import { createHash } from 'node:crypto';
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
  'base64',
);
export function fixtureBundle() {
  return {
    format: 'brio-lan',
    version: 1,
    quiz: {
      id: 'quiz',
      title: 'LAN test',
      revision: 1,
      questions: [
        {
          id: 'q1',
          text: 'First question',
          type: 'MultipleChoice',
          durationMs: 10000,
          multiplier: 'Standard',
          essentialImage: 'image:one',
          options: [
            { id: 'a', text: 'Yes', isCorrect: true },
            { id: 'b', text: 'No', isCorrect: false },
          ],
          acceptedAlternatives: [],
        },
        {
          id: 'q2',
          text: 'PRIVATE FUTURE QUESTION',
          type: 'Poll',
          durationMs: 10000,
          multiplier: 'Zero',
          options: [
            { id: 'a', text: 'Yes', isCorrect: false },
            { id: 'b', text: 'No', isCorrect: false },
          ],
          acceptedAlternatives: [],
        },
      ],
    },
    media: [
      {
        sourceUrl: 'image:one',
        contentType: 'image/png',
        sha256: createHash('sha256').update(png).digest('hex'),
        base64: png.toString('base64'),
      },
    ],
  };
}
