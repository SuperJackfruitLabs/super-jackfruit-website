const EASE = 0.12;
const KEY_STEP = 240;
const DRAG_SUPPRESS_PX = 6;

export function initStreet(): void {
  const scene = document.getElementById('scene');
  const street = document.getElementById('street');
  if (!scene || !street) return;

  const layers: Array<{ el: HTMLElement | null; factor: number }> = [
    { el: document.querySelector<HTMLElement>('.layer--backdrop'), factor: 0.35 },
    { el: street, factor: 1 },
    { el: document.querySelector<HTMLElement>('.layer--fore'), factor: 1.4 },
  ];

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0;
  let current = 0;

  const maxPan = () => Math.max(0, street.scrollWidth - window.innerWidth);
  const clamp = () => {
    target = Math.min(0, Math.max(-maxPan(), target));
  };

  const apply = () => {
    for (const { el, factor } of layers) {
      el?.style.setProperty('transform', `translate3d(${current * factor}px, 0, 0)`);
    }
    window.dispatchEvent(new CustomEvent('street:pan', { detail: { x: current } }));
  };

  const tick = () => {
    current += (target - current) * (reduced ? 1 : EASE);
    if (Math.abs(target - current) < 0.1) current = target;
    apply();
    requestAnimationFrame(tick);
  };

  scene.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target -= delta;
      clamp();
    },
    { passive: false }
  );

  let dragging = false;
  let startX = 0;
  let startTarget = 0;
  let moved = 0;

  scene.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startTarget = target;
    moved = 0;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    target = startTarget + dx;
    clamp();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  // a drag should not count as a click on a sign
  scene.addEventListener(
    'click',
    (e) => {
      if (moved > DRAG_SUPPRESS_PX) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('panel-open')) return;
    if (e.key === 'ArrowRight') {
      target -= KEY_STEP;
      clamp();
    } else if (e.key === 'ArrowLeft') {
      target += KEY_STEP;
      clamp();
    }
  });

  // keep tab-focused signs in view (browser can't scroll our transform)
  street.addEventListener('focusin', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const r = a.getBoundingClientRect();
    if (r.left < 0 || r.right > window.innerWidth) {
      target = current - (r.left - (window.innerWidth / 2 - r.width / 2));
      clamp();
    }
  });

  // neutralize any native scrolling of the fixed scene
  scene.addEventListener('scroll', () => {
    scene.scrollLeft = 0;
    scene.scrollTop = 0;
  });

  window.addEventListener('resize', clamp);

  tick();
}
