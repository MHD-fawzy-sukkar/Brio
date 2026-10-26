import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8');
function worker(){
 const handlers:Record<string,(event:any)=>void>={};let cacheReads=0,networkReads=0;const removed:string[]=[];
 runInNewContext(source,{
  self:{location:{origin:'https://brio.test'},addEventListener:(type:string,fn:any)=>handlers[type]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}},URL,Response,
  fetch:async()=>{networkReads++;return new Response('current deployment');},
  caches:{keys:async()=>['brio-static-v5','brio-static-v6','brio-media-v1'],delete:async(name:string)=>{removed.push(name);return true;},match:async()=>{cacheReads++;return new Response('old deployment');},open:async()=>({addAll:async()=>{},put:async()=>{}})}
 });
 const fetchRequest=async(path:string,headers:Record<string,string>={},mode='cors')=>{
  let response:Promise<Response>|undefined;handlers.fetch({request:{url:'https://brio.test'+path,method:'GET',mode,headers:new Headers(headers)},respondWith:(value:Promise<Response>)=>response=value});
  return response?await(await response).text():undefined;
 };
 return {fetchRequest,counts:()=>({cacheReads,networkReads}),activate:async()=>{let task!:Promise<void>;handlers.activate({waitUntil:(value:Promise<void>)=>task=value});await task;return removed;}};
}
test('client navigation and prefetch never revive cached HTML or RSC from an old deployment',async()=>{
 const sw=worker();
 for(const [path,headers,mode] of [['/builder/?_rsc=old',{},'cors'],['/builder/',{RSC:'1'},'cors'],['/builder/index.txt',{},'cors'],['/builder/index.html',{},'cors'],['/builder/',{},'navigate']] as const){
  assert.equal(await sw.fetchRequest(path,headers,mode),'current deployment');
 }
 assert.deepEqual(sw.counts(),{cacheReads:0,networkReads:5});
 assert.equal(await sw.fetchRequest('/api/themes'),undefined);
 assert.equal(await sw.fetchRequest('/_next/static/chunks/app/builder/page-hashed.js'),'old deployment');
 assert.equal(sw.counts().cacheReads,1);
 assert.deepEqual(await sw.activate(),['brio-static-v5']);
});
