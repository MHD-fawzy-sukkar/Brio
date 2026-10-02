'use client';

import { useEffect, useState } from 'react';
export function buildPinJoinPath(pin:string):string {
  return `/join/?pin=${encodeURIComponent(pin)}`;
}

export function JoinQrCode({pin,className=''}:{pin:string;className?:string}){
  const [image,setImage]=useState('');
  useEffect(()=>{
    if(!/^\d{6}$/.test(pin))return;
    let active=true;
    const url=new URL(buildPinJoinPath(pin),window.location.origin).toString();
    void import('qrcode').then(({default:QRCode})=>QRCode.toDataURL(url,{width:224,margin:1,errorCorrectionLevel:'M',color:{dark:'#6d2335',light:'#ffffff'}})).then((data)=>{if(active)setImage(data);});
    return()=>{active=false;};
  },[pin]);
  return <div className={`grid aspect-square place-items-center overflow-hidden rounded-2xl border-8 border-white bg-white shadow-sm ${className}`}>{image?<img src={image} alt={`رمز QR للانضمام إلى اللعبة ${pin}`} className="h-full w-full"/>:<div className="skeleton-shimmer h-full w-full"/>}</div>;
}
