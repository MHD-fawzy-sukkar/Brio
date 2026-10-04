import { BoltMascot, type MascotExpression } from './BoltMascot';

const avatarHues=[205,120,42,0,315,175];

export const STATIC_AVATARS=avatarHues.map((_,index)=>`/avatars/avatar-${index+1}.svg`);

function staticAvatarHue(source:string):number|null {
  const match=/\/avatars\/avatar-(\d+)\.svg$/.exec(source);
  if(!match)return null;
  return avatarHues[(Number(match[1])-1)%avatarHues.length]??avatarHues[0];
}

type AvatarProps = {
  src:string;
  label?:string;
  className?:string;
  expression?:MascotExpression;
  isTalking?:boolean;
  hueRotate?:number;
};

export function Avatar({src,label='',className='h-12 w-12',expression='idle',isTalking=false,hueRotate}:AvatarProps){
  const generatedHue=hueRotate??staticAvatarHue(src);
  if(generatedHue===null)return <img src={src} alt={label} loading="eager" decoding="async" className={className}/>;
  return <BoltMascot
    className={className}
    label={label}
    expression={expression}
    isTalking={isTalking}
    hueRotate={generatedHue}
    animated={false}
  />;
}
