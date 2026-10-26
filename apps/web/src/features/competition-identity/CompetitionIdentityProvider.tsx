'use client';

import { createContext, useContext, type ReactNode, type CSSProperties } from 'react';
import { DEFAULT_COMPETITION_IDENTITY, type CompetitionIdentity } from './model';
import { themePalette } from './theme-palette';

const CompetitionIdentityContext = createContext<CompetitionIdentity>(DEFAULT_COMPETITION_IDENTITY);

/** Mount around a single competition; never around the app shell or creator dashboard. */
export function CompetitionIdentityProvider({
  identity,
  children,
}: {
  identity: CompetitionIdentity;
  children: ReactNode;
}) {
  const palette = themePalette(identity);
  return (
    <CompetitionIdentityContext.Provider value={identity}>
      <div
        className="competition-theme"
        data-theme-custom={identity !== DEFAULT_COMPETITION_IDENTITY}
        style={
          {
            '--competition-accent': palette.color,
            '--competition-soft': palette.soft,
            '--competition-ink': palette.text,
            '--competition-on-accent': palette.onAccent,
            '--competition-hover': palette.hover,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </CompetitionIdentityContext.Provider>
  );
}

export function useCompetitionIdentity() {
  return useContext(CompetitionIdentityContext);
}
