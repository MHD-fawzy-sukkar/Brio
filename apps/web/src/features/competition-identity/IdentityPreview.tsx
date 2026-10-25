'use client';

import { AvatarPicker } from './AvatarPicker';
import { useState } from 'react';
import { CompetitionIdentityProvider } from './CompetitionIdentityProvider';
import { CompetitionIdentityBadge } from './CompetitionIdentityBadge';
import { Avatar } from '../../components/Avatar';
import { selectedAvatar, type CompetitionIdentity } from './model';

export function IdentityPreview({ identity }: { identity: CompetitionIdentity }) {
  const [avatar, setAvatar] = useState('');
  return <CompetitionIdentityProvider identity={identity}>
    <div className="game-surface space-y-5 rounded-2xl border border-slate-200 p-5">
      <p className="text-sm font-bold text-slate-500">معاينة اللاعب داخل المسابقة</p>
      <CompetitionIdentityBadge />
      <div className="mx-auto w-40"><Avatar src={selectedAvatar(identity, avatar)} presentation="hero" className="w-full" label="الأفاتار المحدد" /></div>
      <AvatarPicker value={selectedAvatar(identity, avatar)} onChange={setAvatar} />
    </div>
  </CompetitionIdentityProvider>;
}
