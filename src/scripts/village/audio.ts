// Everything you hear. One AudioContext, created on the first gesture:
//   engine  — a loop per car (see cars.ts; the shared petrol one is CC-BY
//             qubodup, opengameart.org), pitch-bent by a faked gearbox whose
//             gears, range and tone each car sets, idling rather than cutting
//             out at rest
//   skid    — filtered noise whose gain follows how much the tyres are scrubbing
//   thud    — a one-shot knock when the car hits something
//   music   — "Where Was I" by yd (CC0, opengameart.org), plain <audio>
import { CARS, type EngineSound } from './cars';

const MUSIC_URL = '/assets/village/music.m4a';

/** how far past a gear's edge the speed must go before the gear changes, m/s */
const GEAR_HYSTERESIS = 0.6;

/**
 * The audible span of a decoded loop. An MP3 carries encoder padding — this
 * one has 25 ms of silence at the head and 19 ms at the tail — and looping the
 * whole buffer plays that gap every pass: the engine cut out for a beat every
 * 8 s at idle and every 3–4 s at full pitch. Loop between the first and last
 * loud samples instead, each nudged to a rising zero crossing so the seam
 * doesn't click.
 */
export function loopSpan(d: Float32Array, rate: number, threshold = 0.01): { start: number; end: number } {
  let a = 0;
  while (a < d.length && Math.abs(d[a]) < threshold) a++;
  let b = d.length - 1;
  while (b > a && Math.abs(d[b]) < threshold) b--;
  const rising = (i: number) => d[i - 1] < 0 && d[i] >= 0;
  let s = Math.max(1, a);
  while (s < b && !rising(s)) s++;
  let e = b;
  while (e > s && !rising(e)) e--;
  return { start: s / rate, end: e / rate };
}

export interface AudioBus {
  /** safe to call on every input event; only the first one does anything */
  ensure(): void;
  toggleMute(): boolean;
  setChannel(channel: string, on: boolean): void;
  engine(speed: number, nitro: boolean): void;
  /** the car changed: switch to its engine */
  setEngine(sound: EngineSound): void;
  /** sustained tyre scrub, 0..1 */
  skid(level: number): void;
  /** one-shot body knock, 0..1 */
  thud(force: number): void;
}

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let engineSrc: AudioBufferSourceNode | null = null;
  let engineGain: GainNode | null = null;
  let engineTone: BiquadFilterNode | null = null;
  let engineGrit: WaveShaperNode | null = null;
  let sound: EngineSound = CARS[0].engine;
  /** the loop that's playing, so a car sharing it doesn't restart it */
  let playingUrl = '';
  const buffers = new Map<string, Promise<AudioBuffer>>();
  let skidGain: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let music: HTMLAudioElement | null = null;
  let starting = false;
  let muted = false;
  let engineOn = true;
  let musicOn = true;
  let gear = 0;

  function makeNoise(actx: AudioContext): AudioBuffer {
    const len = Math.floor(actx.sampleRate * 2);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** a soft clipper: 0 leaves the loop alone, 1 makes it rasp */
  function gritCurve(amount: number): Float32Array {
    const n = 512;
    const curve = new Float32Array(n);
    const k = 1 + amount * 18;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  function decode(actx: AudioContext, url: string): Promise<AudioBuffer> {
    let p = buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => actx.decodeAudioData(b));
      buffers.set(url, p);
      p.catch(() => buffers.delete(url));
    }
    return p;
  }

  /** start the current car's loop, replacing whatever loop was running */
  async function playEngine(actx: AudioContext): Promise<void> {
    const url = sound.url;
    if (url === playingUrl || !engineGain) return;
    playingUrl = url;
    try {
      const buf = await decode(actx, url);
      if (playingUrl !== url) return; // the car changed again meanwhile
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const span = loopSpan(buf.getChannelData(0), buf.sampleRate);
      src.loopStart = span.start;
      src.loopEnd = span.end;
      src.connect(engineGrit!);
      src.start(0, span.start);
      engineSrc?.stop();
      engineSrc = src;
    } catch {
      if (playingUrl === url) playingUrl = '';
    }
  }

  function applyTone(): void {
    if (!ctx || !engineTone || !engineGrit) return;
    engineTone.frequency.setTargetAtTime(sound.tone, ctx.currentTime, 0.05);
    engineGrit.curve = sound.grit > 0 ? gritCurve(sound.grit) : null;
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

    // loop → grit → tone → level; the loop is swapped per car, the rest stays
    engineGrit = actx.createWaveShaper();
    engineGrit.oversample = '2x';
    engineTone = actx.createBiquadFilter();
    engineTone.type = 'lowpass';
    engineTone.Q.value = 0.7;
    engineGain = actx.createGain();
    engineGain.gain.value = 0;
    engineGrit.connect(engineTone);
    engineTone.connect(engineGain);
    engineGain.connect(comp);
    applyTone();
    void playEngine(actx).finally(() => {
      starting = false;
    });
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
      // a browser suspends audio when the tab is hidden or iOS takes the
      // speaker; the next touch or key brings it back
      if (ctx && !muted && ctx.state !== 'running') void ctx.resume();
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
      // change gear only once the speed is clear of the edge, so a car
      // cruising right at a gear's top doesn't flick between two pitches
      const span = sound.gearSpan;
      if (sp > (gear + 1) * span + GEAR_HYSTERESIS) gear++;
      else if (gear > 0 && sp < gear * span - GEAR_HYSTERESIS) gear--;
      gear = Math.max(0, Math.min(gear, Math.floor((sp + GEAR_HYSTERESIS) / span)));
      const inGear = sp < 0.15 ? 0 : Math.min(1, Math.max(0, (sp - gear * span) / span));
      const rpm = Math.min(1, 0.18 + inGear * 0.82 + (nitro ? 0.12 : 0));
      engineSrc.playbackRate.setTargetAtTime(sound.idleRate + rpm * sound.rateSpan + (nitro ? 0.3 : 0), now, 0.07);
      // an idle floor, so a parked car still sounds like a running one
      const idle = 0.022 + Math.sin(now * 3.1) * 0.003;
      const vol = sp < 0.15 ? idle : Math.max(idle, Math.min(0.12, 0.05 + (sp / 18) * 0.06) + (nitro ? 0.02 : 0));
      engineGain.gain.setTargetAtTime(vol * sound.gain, now, 0.1);
    },

    setEngine(next: EngineSound): void {
      sound = next;
      gear = 0;
      if (!ctx) return; // picked before the first gesture: it starts with this one
      applyTone();
      void playEngine(ctx);
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
