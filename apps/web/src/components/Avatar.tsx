import { BoltMascot, type MascotExpression } from './BoltMascot';
import type { CSSProperties } from 'react';
import { avatarVariant, AVATAR_VARIANT_COUNT } from './avatar-variants';

// These stable IDs are saved with the player; every variant renders one bitmap.
export const STATIC_AVATARS=Array.from({length:AVATAR_VARIANT_COUNT},(_,index)=>`/avatars/avatar-${index+1}.svg`);

function staticAvatarIndex(source:string):number|null {
  const match=/\/avatars\/avatar-(\d+)\.svg$/.exec(source);
  if(!match)return null;
  return Number(match[1])-1;
}

type AvatarProps = {
  src:string;
  label?:string;
  className?:string;
  expression?:MascotExpression;
  isTalking?:boolean;
  hueRotate?:number;
  playerIndex?:number;
};

export function Avatar({src,label='',className='h-12 w-12',expression='idle',isTalking=false,hueRotate,playerIndex}:AvatarProps){
  const sourceIndex=staticAvatarIndex(src);
  if(src && sourceIndex===null && hueRotate===undefined)return <img src={src} alt={label} loading="eager" decoding="async" className={className}/>;
  const personality = avatarVariant(playerIndex ?? sourceIndex ?? 0);
  const style = {
    '--avatar-direction': personality.direction,
    '--avatar-tilt': `${personality.tilt}deg`,
    '--avatar-glow': personality.glow,
    '--avatar-hue': `${hueRotate ?? personality.hue}deg`
  } as CSSProperties;
  return <span className={`avatar ${className}`} style={style}>
    <span className="avatar__art">
      <BoltMascot
        className="h-full w-full"
        label={label}
        expression={expression}
        isTalking={isTalking}
        animated={false}
        pose="flat"
        faceMode="expressive"
      />
    </span>
  </span>;
}
