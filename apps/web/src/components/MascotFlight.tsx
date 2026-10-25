'use client';

import type { ReactNode } from 'react';
import { useMascotFlight, type MascotFlightOptions } from '../hooks/use-mascot-flight';

/** Shared flight stage: motion never needs to know how a character is drawn. */
export function MascotFlight({ children, ...options }: MascotFlightOptions & { children: ReactNode }) {
  const { areaRef, characterRef, innerRef, ready, dragging, onPointerDown, onPointerMove, endDrag } = useMascotFlight(options);
  return <div ref={areaRef} data-flight-mode={options.compact ? 'compact' : 'roaming'} className="mascot-flight-area" style={{ visibility: ready ? 'visible' : 'hidden' }} aria-hidden="true">
    <div
      ref={characterRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      title="اسحب لتحريك الشخصية"
      className={`roaming-mascot${options.scope === 'studio' ? ' roaming-mascot--studio' : ''} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    ><div ref={innerRef} className="roaming-mascot__3d">{children}</div></div>
  </div>;
}
