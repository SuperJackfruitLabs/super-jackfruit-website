// Keyboard, on-screen controls, drag-joystick and gamepad, folded into one
// throttle/steer/nitro reading per frame.
export interface TouchState {
  /** −1 left … +1 right */
  steer: number;
  /** −1 reverse … +1 forward */
  throttle: number;
  nitro: boolean;
}

export interface InputState {
  /** −1 left … +1 right, as pressed */
  ix: number;
  /** −1 forward … +1 back, screen-vertical */
  iz: number;
  nitro: boolean;
}

export interface Input {
  read(): InputState;
  keys: Set<string>;
}

export function createInput(canvas: HTMLCanvasElement, onFirstGesture: () => void): Input {
  const keys = new Set<string>();
  const state: InputState = { ix: 0, iz: 0, nitro: false };
  // on a touch device the page puts a wheel and pedals on screen and posts
  // their state here; the drag-joystick stands down so the two can't fight
  const touch: TouchState = { steer: 0, throttle: 0, nitro: false };
  const hasTouchControls = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  window.addEventListener('village:touch', ((e: CustomEvent<TouchState>) => {
    touch.steer = e.detail.steer;
    touch.throttle = e.detail.throttle;
    touch.nitro = e.detail.nitro;
    onFirstGesture();
  }) as EventListener);
  // Triggers live on buttons 6/7 in the standard mapping, but many pads report
  // them as axes resting at −1 — remembered per axis once we've seen that.
  const triggerAxes = new Set<number>();

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    onFirstGesture();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  let joy: { sx: number; sy: number; dx: number; dy: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    onFirstGesture();
    if (hasTouchControls) return;
    joy = { sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    if (joy) {
      joy.dx = (e.clientX - joy.sx) / 60;
      joy.dy = (e.clientY - joy.sy) / 60;
    }
  });
  window.addEventListener('pointerup', () => (joy = null));

  return {
    keys,
    read(): InputState {
      let ix = 0;
      let iz = 0;
      if (keys.has('w') || keys.has('arrowup')) iz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) iz += 1;
      if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
      if (keys.has('d') || keys.has('arrowright')) ix += 1;
      if (joy) {
        ix += Math.max(-1, Math.min(1, joy.dx));
        iz += Math.max(-1, Math.min(1, joy.dy));
      }
      ix += touch.steer;
      iz -= touch.throttle; // screen-up is forward, so forward is negative iz

      // gamepad: left stick steers, RT throttle, LT brake/reverse, A = nitro
      let padNitro = false;
      const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
        ix += dz(pad.axes[0] ?? 0);
        let rt = pad.buttons[7]?.value ?? 0;
        let lt = pad.buttons[6]?.value ?? 0;
        for (let ai = 2; ai < pad.axes.length; ai++) {
          if ((pad.axes[ai] ?? 0) < -0.9) triggerAxes.add(ai); // seen at rest → it's a trigger
        }
        if (rt < 0.02 && lt < 0.02 && triggerAxes.size > 0) {
          // deterministic: lower axis index is the LEFT trigger (brake) on both
          // Xbox (2/5) and PlayStation (3/4) non-standard mappings
          const ordered = [...triggerAxes].sort((a, b) => a - b);
          const val = (ai: number | undefined) => (ai === undefined ? 0 : ((pad.axes[ai] ?? -1) + 1) / 2);
          lt = val(ordered[0]);
          rt = val(ordered[1]);
        }
        const trigger = rt - lt;
        if (Math.abs(trigger) > 0.03) iz = -trigger; // triggers take priority over stick-Y
        else iz += dz(pad.axes[1] ?? 0);
        if (pad.buttons[0]?.pressed) padNitro = true;
        break;
      }

      state.ix = Math.max(-1, Math.min(1, ix));
      state.iz = Math.max(-1, Math.min(1, iz));
      state.nitro = keys.has('shift') || padNitro || touch.nitro;
      return state;
    },
  };
}
