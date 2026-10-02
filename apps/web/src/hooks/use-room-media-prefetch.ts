'use client';

import { useEffect, useState } from 'react';
import { globalMediaPrefetchEngine } from '../services/media-prefetch';

interface ManifestItem { mediaId:string; url:string; questionIndex:number; isEssential:boolean }

export function useRoomMediaPrefetch(roomId: string, questionIndex: number | null | undefined) {
  const [manifest,setManifest] = useState<ManifestItem[]>([]);

  useEffect(() => {
    if (!roomId) return;
    const controller = new AbortController();
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/media`, { signal:controller.signal })
      .then((response)=>response.ok?response.json():[])
      .then((items:ManifestItem[])=>{
        setManifest(items);
        globalMediaPrefetchEngine.queueImages(items.map((item)=>({
          url:item.url, questionId:item.mediaId, isEssential:item.isEssential,
          priority:item.questionIndex<=1?1:3
        })));
      }).catch(()=>undefined);
    return ()=>controller.abort();
  },[roomId]);

  useEffect(()=>{
    if (questionIndex===null||questionIndex===undefined) return;
    const next = manifest.find((item)=>item.questionIndex===questionIndex+1);
    if (next) globalMediaPrefetchEngine.prioritizeUpcoming(next.url,next.isEssential);
  },[manifest,questionIndex]);
}
