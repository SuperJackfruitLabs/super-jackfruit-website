// Whether the visitor has asked for less motion: the system setting, or the
// suite's own Motion choice (vibekit writes data-motion="reduce" on <html>).
//
// Reduced, the village keeps everything that is the visitor's doing (the
// car, its suspension, people dodging or parachuting) and stills what moves on
// its own: swinging signs and flags, swaying trees, drifting clouds, birds and
// smoke, the camera's knock and the nitro lens; the traffic creeps; the map
// stops turning. Read live, so changing either setting applies at once.
export interface Motion {
  readonly reduced: boolean;
}

export function createMotion(): Motion {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const read = () => !!query?.matches || document.documentElement.getAttribute('data-motion') === 'reduce';
  const state = { reduced: read() };
  query?.addEventListener?.('change', () => (state.reduced = read()));
  new MutationObserver(() => (state.reduced = read())).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  return state;
}
