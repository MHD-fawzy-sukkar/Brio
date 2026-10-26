import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveIdentityRequestSchema } from '@brio/contracts';
import { DeferredIdentityUploads } from './deferred-uploads';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const input = (count: number) => SaveIdentityRequestSchema.parse({ name: 'Team', images: Array.from({length:count}, (_,i) => ({ mediaId:id(i+1),label:`Image ${i}`,roles:i ? ['avatar'] : ['avatar','character'] })) });
test('selecting/removing local images never uploads; explicit preparation remaps IDs with at most two concurrent uploads', async () => {
  let calls=0, active=0, peak=0;
  const queue = new DeferredIdentityUploads(async () => { const current=++calls; active++; peak=Math.max(peak,active); await new Promise(done=>setTimeout(done,2)); active--; return {mediaId:id(current+100),src:'https://res.cloudinary.com/demo/image/upload/sample.jpg'}; },()=>{});
  for(let n=1;n<=8;n++)queue.stage({id:id(n),file:new File(['x'],`${n}.png`,{type:'image/png'}),preview:'blob:local',status:'staged'});
  queue.remove(id(8)); assert.equal(calls,0);
  const draft=input(7), prepared=await queue.prepare(draft,new AbortController().signal);
  assert.equal(calls,7); assert.equal(peak,2); assert.equal(draft.images[0].mediaId,id(1));
  assert.equal(new Set(prepared.images.map(image=>image.mediaId)).size,7); assert.ok(prepared.images.every(image=>image.mediaId!==id(1))); assert.deepEqual(prepared.images[0].roles,['avatar','character']);
});
test('save retries only failed images, preserving successful upload assets', async () => {
  const calls = new Map<string,number>(); let fail=true;
  const queue=new DeferredIdentityUploads(async file=>{calls.set(file.name,(calls.get(file.name)??0)+1);if(file.name==='bad.png'&&fail)throw new Error('offline');return{mediaId:id(file.name==='bad.png'?102:101),src:'https://res.cloudinary.com/demo/image/upload/sample.jpg'};},()=>{});
  for(const [n,name] of [[1,'ok.png'],[2,'bad.png']] as const)queue.stage({id:id(n),file:new File(['x'],name),preview:'blob:local',status:'staged'});
  await assert.rejects(queue.prepare(input(2),new AbortController().signal),/بعض الصور/);
  fail=false;const saved=await queue.prepare(input(2),new AbortController().signal);
  assert.equal(calls.get('ok.png'),1); assert.equal(calls.get('bad.png'),2); assert.equal(saved.images[0].mediaId,id(101));
});
test('cancelled saves do not start queued uploads', async()=>{
  let calls=0;const queue=new DeferredIdentityUploads(async()=>{calls++;return{mediaId:id(100),src:'https://res.cloudinary.com/demo/image/upload/sample.jpg'};},()=>{});
  queue.stage({id:id(1),file:new File(['x'],'one.png'),preview:'blob:local',status:'staged'});
  const abort=new AbortController();abort.abort();await assert.rejects(queue.prepare(input(1),abort.signal));assert.equal(calls,0);
});
