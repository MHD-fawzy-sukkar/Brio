import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './d1';
import { createQuizForCreator, addQuestionToQuiz, deleteQuestionFromQuiz, getQuizForCreator, reorderQuizQuestions, publishQuizVersion, getLatestQuizVersion } from '../repositories/quiz.repository';
const poll = (text:string) => ({type:'Poll' as const,text,durationMs:10000,multiplier:'Zero' as const,options:[{text:'A',isCorrect:false},{text:'B',isCorrect:false}],acceptedAlternatives:[]});
test('question reorder persists atomically, rejects duplicates/foreign IDs, and leaves published snapshots unchanged',async()=>{
 const {db,sqlite}=createTestDatabase();try{
 sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run('owner','owner','owner','owner@test.invalid','now');
 const quiz=await createQuizForCreator(db,'owner','Order',null,[poll('First'),poll('Second'),poll('Third')]);
 const ids=quiz.questions.map(q=>q.id);await publishQuizVersion(db,quiz.id,'owner');
 await reorderQuizQuestions(db,quiz.id,'owner',[ids[2],ids[0],ids[1]]);
 assert.deepEqual((await getQuizForCreator(db,quiz.id,'owner'))!.questions.map(q=>q.text),['Third','First','Second']);
 assert.deepEqual(JSON.parse((await getLatestQuizVersion(db,quiz.id))!.private_snapshot_json).questions.map((q:{text:string})=>q.text),['First','Second','Third']);
 for(const invalid of [[ids[0],ids[0],ids[1]],[ids[0]],[ids[0],ids[1],'foreign']]) await assert.rejects(reorderQuizQuestions(db,quiz.id,'owner',invalid));
 await assert.rejects(reorderQuizQuestions(db,quiz.id,'other',ids));
 sqlite.exec("CREATE TRIGGER fail_second_position BEFORE UPDATE OF position ON questions WHEN NEW.position=2 BEGIN SELECT RAISE(ABORT,'reorder failure'); END");
 await assert.rejects(reorderQuizQuestions(db,quiz.id,'owner',ids),/reorder failure/);
 assert.deepEqual((await getQuizForCreator(db,quiz.id,'owner'))!.questions.map(q=>q.id),[ids[2],ids[0],ids[1]]);
 }finally{sqlite.close();}
});


test('adding after deletion appends after the last position, including after a drag reorder',async()=>{
 const {db,sqlite}=createTestDatabase();try{
 sqlite.prepare('INSERT INTO creators VALUES(?,?,?,?,?)').run('owner','owner','owner','owner@test.invalid','now');
 const quiz=await createQuizForCreator(db,'owner','Append',null,[poll('First'),poll('Second'),poll('Third')]);
 await deleteQuestionFromQuiz(db,quiz.id,quiz.questions[1].id,'owner');
 await addQuestionToQuiz(db,quiz.id,'owner',poll('Fourth'));
 let saved=(await getQuizForCreator(db,quiz.id,'owner'))!;
 assert.deepEqual(saved.questions.map(q=>q.position),[1,3,4]);
 assert.deepEqual(saved.questions.map(q=>q.text),['First','Third','Fourth']);
 await reorderQuizQuestions(db,quiz.id,'owner',saved.questions.map(q=>q.id).reverse());
 await addQuestionToQuiz(db,quiz.id,'owner',poll('Fifth'));
 saved=(await getQuizForCreator(db,quiz.id,'owner'))!;
 assert.deepEqual(saved.questions.map(q=>q.text),['Fourth','Third','First','Fifth']);assert.deepEqual(saved.questions.map(q=>q.position),[1,2,3,4]);
 }finally{sqlite.close();}
});
