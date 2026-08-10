// Everything you hear. One AudioContext, created on the first gesture:
//   engine  — a real petrol loop (CC-BY qubodup, opengameart.org), pitch-bent
//             by a faked gearbox, idling rather than cutting out at rest
//   skid    — filtered noise whose gain follows how much the tyres are scrubbing
//   thud    — a one-shot knock when the car hits something
//   music   — "Where Was I" by yd (CC0, opengameart.org), plain <audio>
const ENGINE_URL = '/assets/village/engine-petrol.mp3';
const MUSIC_URL = '/assets/village/music.m4a';

/** speed span of one imaginary gear, in m/s */
const GEAR_SPAN = 6.5;

export interface AudioBus {
  /** safe to call on every input event; only the first one does anything */
  ensure(): void;
  toggleMute(): boolean;
  setChannel(channel: string, on: boolean): void;
  engine(speed: number, nitro: boolean): void;
  /** sustained tyre scrub, 0..1 */
  skid(level: number): void;
  /** one-shot body knock, 0..1 */
  thud(force: number): void;
}

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let engineSrc: AudioBufferSourceNode | null = null;
  let engineGain: GainNode | null = null;
  let skidGain: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let music: HTMLAudioElement | null = null;
  let starting = false;
  let muted = false;
  let engineOn = true;
  let musicOn = true;

  function makeNoise(actx: AudioContext): AudioBuffer {
    const len = Math.floor(actx.sampleRate * 2);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function start(): void {
    if (ctx || starting || muted) return;
    starting = true;
    const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx = actx;

    const comp = actx.createDynamicsCompressor();
    comp.connect(actx.destination);
    sfxBus = actx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(comp);
    noise = makeNoise(actx);

    // tyre scrub: a loop that is always running and always silent until the
    // rubber actually starts complaining
    const skidSrc = actx.createBufferSource();
    skidSrc.buffer = noise;
    skidSrc.loop = true;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 1.0;
    skidGain = actx.createGain();
    skidGain.gain.value = 0;
    skidSrc.connect(bp);
    bp.connect(skidGain);
    skidGain.connect(sfxBus);
    skidSrc.start();

    (async () => {
      try {
        const res = await fetch(ENGINE_URL);
        const buf = await actx.decodeAudioData(await res.arrayBuffer());
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = actx.createGain();
        gain.gain.value = 0;
        src.connect(gain);
        gain.connect(comp);
        src.start();
        engineSrc = src;
        engineGain = gain;
      } catch {
        engineSrc = null;
        engineGain = null;
      } finally {
        starting = false;
      }
    })();
  }

  function startMusic(): void {
    if (music || muted || !musicOn) return;
    music = new Audio(MUSIC_URL);
    music.loop = true;
    music.volume = 0.8;
    music.play().catch(() => {});
  }

  return {
    ensure(): void {
      start();
      startMusic();
    },

    toggleMute(): boolean {
      muted = !muted;
      if (ctx) {
        if (muted) ctx.suspend();
        else ctx.resume();
      }
      if (music) music.muted = muted;
      return muted;
    },

    setChannel(channel: string, on: boolean): void {
      if (channel === 'music') {
        musicOn = on;
        if (music) music.muted = !on;
        else if (on) startMusic();
      } else if (channel === 'engine') {
        engineOn = on;
      }
    },

    engine(speed: number, nitro: boolean): void {
      if (!ctx || !engineGain || !engineSrc) return;
      const now = ctx.currentTime;
      if (muted || !engineOn) {
        engineGain.gain.setTargetAtTime(0, now, 0.08);
        return;
      }
      const sp = Math.abs(speed);
      const inGear = sp < 0.15 ? 0 : (sp % GEAR_SPAN) / GEAR_SPAN;
      const rpm = Math.min(1, 0.18 + inGear * 0.82 + (nitro ? 0.12 : 0));
      engineSrc.playbackRate.setTargetAtTime(0.65 + rpm * 1.15 + (nitro ? 0.3 : 0), now, 0.07);
      // an idle floor, so a parked car still sounds like a running one
      const idle = 0.022 + Math.sin(now * 3.1) * 0.003;
      const vol = sp < 0.15 ? idle : Math.max(idle, Math.min(0.12, 0.05 + (sp / 18) * 0.06) + (nitro ? 0.02 : 0));
      engineGain.gain.setTargetAtTime(vol, now, 0.1);
    },

    skid(level: number): void {
      if (!ctx || !skidGain) return;
      const target = muted || !engineOn ? 0 : Math.min(1, level) * 0.055;
      skidGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
    },

    thud(force: number): void {
      if (!ctx || !noise || !sfxBus || muted || !engineOn) return;
      const now = ctx.currentTime;
      const f = Math.min(1, force);

      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32 * f, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      src.connect(lp);
      lp.connect(g);
      g.connect(sfxBus);
      src.start(now);
      src.stop(now + 0.24);

      // a little body to the knock, so it reads as mass rather than static
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(46, now + 0.18);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.22 * f, now);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(og);
      og.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.22);
    },
  };
}
