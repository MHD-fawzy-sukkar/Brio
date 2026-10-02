const palette=['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4'];

export const STATIC_AVATARS=palette.map((_,index)=>`/avatars/avatar-${index+1}.svg`);

function staticAvatarColor(source:string):string|null {
  const match=/\/avatars\/avatar-(\d+)\.svg$/.exec(source);
  if(!match)return null;
  return palette[(Number(match[1])-1)%palette.length]||palette[0];
}

export function Avatar({src,label='',className='h-12 w-12'}:{src:string;label?:string;className?:string}){
  const color=staticAvatarColor(src);
  if(!color)return <img src={src} alt={label} loading="eager" decoding="async" className={className}/>;
  return <svg role={label?'img':undefined} aria-label={label||undefined} aria-hidden={label?undefined:true} viewBox="0 0 100 100" className={className}>
    <circle cx="50" cy="50" r="48" fill={color}/>
    <circle cx="50" cy="38" r="18" fill="#fff"/>
    <path d="M22 82C22 62 78 62 78 82Z" fill="#fff"/>
  </svg>;
}
