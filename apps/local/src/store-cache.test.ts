import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalStore } from './store';

test('prepared SQL is reused while reads still observe new persisted data and distinct bindings', () => {
  const store = new LocalStore(':memory:');
  try {
    store.db.exec(`INSERT INTO quizzes VALUES('q','{"id":"q","title":"First","questions":[]}')`);
    const prepare = store.db.prepare.bind(store.db);
    let preparations = 0;
    store.db.prepare = (query) => {
      preparations++;
      return prepare(query);
    };
    assert.equal(store.listQuizzes()[0].title, 'First');
    store.listQuizzes();
    assert.equal(preparations, 1);
    store.db.exec(`UPDATE quizzes SET json='{"id":"q","title":"Updated","questions":[]}' WHERE id='q'`);
    assert.equal(store.listQuizzes()[0].title, 'Updated');
    assert.equal(preparations, 1);
    assert.equal(store.load('first'), null);
    assert.equal(store.load('second'), null);
    assert.equal(preparations, 2);
  } finally {
    store.close();
  }
});
