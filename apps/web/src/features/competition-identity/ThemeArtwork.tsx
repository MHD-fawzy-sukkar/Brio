'use client';
import { useState } from 'react';

function Artwork({ src, className }: { src: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  return <div className={`relative overflow-hidden ${className}`}>
    {!loaded && <div aria-hidden="true" className="skeleton-shimmer absolute inset-0 rounded-xl bg-slate-100" />}
    {fallbackFailed ? <span aria-hidden="true" className="grid h-full place-items-center text-4xl">⚡</span> : <img src={failed ? '/bolt-original.png' : src} alt="" className={`h-full w-full object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => { if (failed) { setFallbackFailed(true); setLoaded(true); } else { setFailed(true); setLoaded(false); } }} />}
  </div>;
}
export function ThemeArtwork({ src, className }: { src: string; className: string }) { return <Artwork key={src} src={src} className={className} />; }
