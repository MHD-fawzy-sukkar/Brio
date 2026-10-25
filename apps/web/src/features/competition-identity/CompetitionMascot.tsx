'use client';

import { BoltMascot } from '../../components/BoltMascot';
import { RoamingBolt } from '../../components/host-lobby/RoamingBolt';
import { MascotFlight } from '../../components/MascotFlight';
import { useCompetitionIdentity } from './CompetitionIdentityProvider';

type CompetitionMascotProps = {
  className?: string;
  label?: string;
} & ({ presentation?: 'hero' } | { presentation: 'roaming'; scope?: 'lobby' | 'page' | 'studio'; celebration?: boolean });

/** Custom artwork gets whole-image motion; Bolt's face rig remains specific to Bolt. */
export function CompetitionMascot(props: CompetitionMascotProps) {
  const { character } = useCompetitionIdentity();
  if (character.kind === 'bolt') {
    return props.presentation === 'roaming'
      ? <RoamingBolt scope={props.scope} celebration={props.celebration} />
      : <BoltMascot className={props.className} label={props.label} />;
  }
  const artwork = <span className={`competition-character ${props.className ?? 'w-full'}`}>
    <img
      src={character.src}
      alt={props.label ?? character.label}
      draggable={false}
      decoding="async"
      className={`competition-character__image${character.motion === 'float' && props.presentation !== 'roaming' ? ' competition-character__image--float' : ''}`}
    />
  </span>;
  if (props.presentation !== 'roaming') return artwork;
  return character.motion === 'float'
    ? <MascotFlight compact scope={props.scope} celebration={props.celebration}>{artwork}</MascotFlight>
    : <div className="competition-character--overlay" aria-hidden="true">{artwork}</div>;
}
