import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthoringQuestionSchema } from '@brio/contracts';
import { createTestDatabase } from './d1';
import {
  createQuizForCreator,
  getQuizForCreator,
  updateQuestionInQuiz,
} from '../repositories/quiz.repository';

test('image removal is explicit, owner-scoped and persists without deleting shared media', async () => {
  const { db, sqlite } = createTestDatabase();
  try {
    sqlite
      .prepare('INSERT INTO creators VALUES(?,?,?,?,?)')
      .run('owner', 'owner', 'Owner', 'owner@test.invalid', 'now');
    const question = AuthoringQuestionSchema.parse({
      type: 'Poll',
      text: 'Keep the question',
      durationMs: 10000,
      multiplier: 'Zero',
      options: [
        { text: 'A', isCorrect: false },
        { text: 'B', isCorrect: false },
      ],
    });
    const quiz = await createQuizForCreator(db, 'owner', 'Images', null, [question]);
    const id = quiz.questions[0].id;
    sqlite
      .prepare(
        'INSERT INTO media (id, creator_id, provider_public_id, rendition_json, version_hash, host_url) VALUES(?,?,?,?,?,?)',
      )
      .run('image', 'owner', 'image', '{}', 'hash', 'https://cdn.test/image.webp');
    sqlite.prepare('UPDATE questions SET media_id=?, essential=1 WHERE id=?').run('image', id);

    await updateQuestionInQuiz(db, quiz.id, id, 'owner', question);
    assert.equal((await getQuizForCreator(db, quiz.id, 'owner'))!.questions[0].media_id, 'image');
    const removal = AuthoringQuestionSchema.parse({ ...question, removeImage: true });
    await assert.rejects(updateQuestionInQuiz(db, quiz.id, id, 'other', removal), /unauthorized/);
    assert.equal(sqlite.prepare('SELECT media_id FROM questions WHERE id=?').get(id)!.media_id, 'image');

    await updateQuestionInQuiz(db, quiz.id, id, 'owner', removal);
    const saved = (await getQuizForCreator(db, quiz.id, 'owner'))!.questions[0];
    assert.equal(saved.media_id, null);
    assert.equal(saved.media_url, null);
    assert.equal(saved.essential, 0);
    assert.equal(saved.text, question.text);
    assert.equal(saved.options.length, 2);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM media').get()!.count, 1);
  } finally {
    sqlite.close();
  }
});
