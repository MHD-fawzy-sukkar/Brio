/** Decorative CSS-only light field. Local fields are clipped by their panel. */
export function AmbientBackground({ fixed = false }: { fixed?: boolean }) {
  return <div className={`ambient-background${fixed ? ' ambient-background--fixed' : ''}`} aria-hidden="true">
    <div className="ambient-orb ambient-orb--crimson" />
    <div className="ambient-orb ambient-orb--purple" />
    <div className="ambient-orb ambient-orb--amber" />
    <div className="ambient-orb ambient-orb--rose" />
  </div>;
}
