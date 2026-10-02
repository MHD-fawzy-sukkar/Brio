import test from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundUploadManager } from './background-upload';
import type { MediaVariantsDto } from '@brio/contracts';

const media:MediaVariantsDto={
  mediaId:'media-1', publicId:'question-q1', hostUrl:'https://cdn.test/question-q1.webp',
  mobileUrl:'https://cdn.test/question-q1-mobile.webp', isEssential:true,
  byteSize:100, width:100, height:100
};

test('question upload remains associated with its question and exposes preview then final URL',async()=>{
  let finish!:(value:MediaVariantsDto)=>void;
  const pending=new Promise<MediaVariantsDto>((resolve)=>{finish=resolve;});
  const revoked:string[]=[];
  const manager=new BackgroundUploadManager(
    async()=>media,
    async()=>pending,
    ()=>'blob:question-preview',
    (url)=>revoked.push(url)
  );
  const id=manager.enqueueQuestion('quiz-1','question-1',{} as File);

  assert.deepEqual(manager.latestQuestion('quiz-1','question-1'),{
    id,quizId:'quiz-1',questionId:'question-1',target:'question',previewUrl:'blob:question-preview',
    label:'جاري رفع صورة السؤال…',state:'uploading'
  });

  finish(media);
  await new Promise((resolve)=>setTimeout(resolve,0));
  const completed=manager.latestQuestion('quiz-1','question-1');
  assert.equal(completed?.state,'completed');
  assert.equal(completed?.resultUrl,media.hostUrl);

  manager.dismiss(id);
  assert.deepEqual(revoked,['blob:question-preview']);
});
