'use client';

import { useEffect, useState } from 'react';
export function buildPinJoinPath(pin:string):string {
  return `/join/?pin=${encodeURIComponent(pin)}`;
}

export function JoinQrCode({pin}:{pin:string}){
  const [image,setImage]=useState('');
  useEffect(()=>{
    if(!/^\d{6}$/.test(pin))return;
    let active=true;
    const url=new URL(buildPinJoinPath(pin),window.location.origin).toString();
    void import('qrcode').then(({default:QRCode})=>QRCode.toDataURL(url,{width:224,margin:1,errorCorrectionLevel:'M',color:{dark:'#4c1d95',light:'#ffffff'}})).then((data)=>{if(active)setImage(data);});
    return()=>{active=false;};
  },[pin]);
  return <aside className="mx-auto mt-6 w-full max-w-xs rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 text-center shadow-lg shadow-violet-100/50 lg:mt-8"><div className="mx-auto grid aspect-square w-44 place-items-center overflow-hidden rounded-2xl border-8 border-white bg-white shadow-sm">{image?<img src={image} alt={`رمز QR للانضمام إلى اللعبة ${pin}`} className="h-full w-full"/>:<div className="skeleton-shimmer h-full w-full"/>}</div><h3 className="mt-4 font-black text-violet-950">امسح وانضم فوراً</h3><p className="mt-1 text-xs font-bold leading-6 text-slate-500">سيفتح نموذج اللاعب والرمز جاهز تلقائياً.</p><code dir="ltr" className="mt-3 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{pin}</code></aside>;
}
