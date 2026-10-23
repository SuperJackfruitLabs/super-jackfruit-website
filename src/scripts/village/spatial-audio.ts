// The village's own sounds, out in the world: the other cars' engines and the
// neighbours' chatter, placed in 3D round the camera.
//
// Nothing here is a recording. Each engine is a loop of four-stroke exhaust
// pulses synthesised at start-up, seeded so the cars don't all sound alike,
// and the chatter is wordless formant babble. A fixed pool of voices (a few
// for engines, one or two for talk) is handed to whichever sources are
// nearest; a voice that loses its source fades out over a moment before it
// takes the next. Each voice is HRTF-panned, muffled with distance, and pitch-
// shifted by doppler as a car comes and goes.
//
// It all plays through audio.ts's world bus, so it starts on the visitor's
// first gesture, mutes with M, and follows the sound toggle; the visitor's own
// car keeps its sampled engine there.
//
// Adapted from slop-newyork, https://github.com/mrdoob/slop-newyork:
// js/audio-synthesis.js (randomSequence, normalizeLoop, combustionBuffers),
// js/audio-events.js (randomSource, makeBuffer, speechFragment) and
// js/audio-system.js (SpatialEmitter, updatePool's doppler, updateConversations).
//
// MIT License
//
// Copyright (c) 2026 Mr.doob
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
import type { AudioBus } from './audio';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (v: number) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};

/** past this, a car can't be heard */
const MOTOR_RANGE = 75;
/** and a chat, much sooner */
const TALK_RANGE = 28;
/** a retiring voice fades for this long, s */
const RETIRE = 0.12;

function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalizeLoop(buffer: AudioBuffer, rms: number, ceiling = 0.9): AudioBuffer {
  const data = buffer.getChannelData(0);
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length;
  let energy = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    data[i] -= mean;
    energy += data[i] * data[i];
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const scale = Math.min(ceiling / Math.max(peak, 0.0001), rms / Math.max(Math.sqrt(energy / data.length), 0.0001));
  for (let i = 0; i < data.length; i++) data[i] *= scale;
  return buffer;
}

/**
 * Twenty four-stroke cycles of exhaust pulses at 1200 rpm: each firing a sharp
 * pressure release with a ringing body and a little rough noise, the cylinders
 * slightly unequal, so the loop has an engine's lope instead of an oscillator's
 * buzz. Played faster for revs.
 */
function combustionLoop(ctx: BaseAudioContext, cylinders: number, seed: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const rpm = 1200;
  const cycles = 20;
  const length = Math.round(((cycles * 120) / rpm) * rate);
  const buffer = ctx.createBuffer(1, length, rate);
  const pressure = buffer.getChannelData(0);
  const random = randomSequence(seed);
  const strength = Array.from({ length: cylinders }, () => 0.83 + random() * 0.34);
  const delay = Array.from({ length: cylinders }, () => (random() - 0.5) * 0.035);
  const resonance = (cylinders === 6 ? 118 : 145) * (0.97 + random() * 0.06);
  const duration = Math.round(rate * 0.048);
  const interval = length / (cycles * cylinders);
  const timing = randomSequence(seed);
  const noise = randomSequence(seed ^ 0x65786861);
  for (let firing = 0; firing < cycles * cylinders; firing++) {
    const cyl = firing % cylinders;
    let index = Math.round((firing + delay[cyl] + (timing() - 0.5) * 0.012) * interval);
    index = (index + length) % length;
    const s = strength[cyl] * (0.92 + timing() * 0.16);
    const decay = 0.012 * (0.95 + timing() * 0.1);
    let low = 0;
    for (let i = 0; i < duration; i++) {
      const t = i / rate;
      low += (noise() * 2 - 1 - low) * 0.16;
      const attack = 1 - Math.exp(-t / 0.00065);
      const tail = Math.exp(-t / decay);
      const release = Math.exp(-t / 0.0022) - 0.36 * Math.exp(-t / 0.009);
      const body = Math.sin(TAU * resonance * t) * tail * 0.34;
      pressure[index] += s * attack * (release + body + low * tail * 0.28);
      if (++index === length) index = 0;
    }
  }
  return normalizeLoop(buffer, 0.3);
}

function randomSource(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
  state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
  state ^= state >>> 16;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeBuffer(ctx: BaseAudioContext, duration: number, synth: (t: number, i: number) => number, peak = 0.6): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate);
  const d = buffer.getChannelData(0);
  let max = 0;
  let mean = 0;
  for (let i = 0; i < d.length; i++) {
    d[i] = synth(i / ctx.sampleRate, i);
    mean += d[i];
  }
  mean /= d.length;
  for (let i = 0; i < d.length; i++) {
    // a short fade at each end, so a pitched part stopping mid-cycle doesn't click
    const fade = Math.min(1, i / (ctx.sampleRate * 0.002), (d.length - 1 - i) / (ctx.sampleRate * 0.012));
    d[i] = (d[i] - mean) * fade;
    max = Math.max(max, Math.abs(d[i]));
  }
  const scale = max > 0 ? peak / max : 0;
  for (let i = 0; i < d.length; i++) d[i] *= scale;
  return buffer;
}

interface Speaker {
  pitch: number;
  formants: number;
  breath: number;
}

/**
 * A syllable or three of wordless speech: a glottal pulse train through three
 * formant resonators that glide from vowel to vowel, with a little breath and
 * the odd consonant. Heard from across a garden it reads as people talking.
 */
function speechFragment(ctx: BaseAudioContext, speaker: Speaker, seed: number): AudioBuffer {
  const random = randomSource(seed);
  const vowels = [[600, 1170, 2380], [470, 1740, 2460], [340, 2010, 2650], [470, 890, 2300], [420, 1450, 2350]];
  const duration = 0.57 + random() * 0.28;
  const count = 2 + Math.floor(random() * 3);
  const segments = Array.from({ length: count }, () => ({
    vowel: vowels[Math.floor(random() * vowels.length)], weight: 0.65 + random() * 0.7,
    consonant: Math.floor(random() * 5), transition: 0.028 + random() * 0.038,
    stress: 0.62 + random() * 0.38, pitch: 0.96 + random() * 0.1, start: 0, duration: 0,
  }));
  const weight = segments.reduce((sum, sg) => sum + sg.weight, 0);
  let cursor = 0;
  for (const sg of segments) {
    sg.start = cursor;
    sg.duration = (duration * sg.weight) / weight;
    cursor += sg.duration;
  }
  const resonators = [95, 135, 190].map((bandwidth, i) => {
    const radius = Math.exp((-Math.PI * bandwidth) / ctx.sampleRate);
    return { radius, a: 0, b: radius * radius, gain: (1 - radius) * [1, 0.8, 0.36][i], frequency: segments[0].vowel[i] * speaker.formants, y1: 0, y2: 0 };
  });
  const pitchFall = 0.08 + random() * 0.1;
  const open = 0.52 + speaker.breath * 0.5;
  const closing = 0.19;
  const breathK = 1 - Math.exp((-TAU * 1600) / ctx.sampleRate);
  const formantK = 1 - Math.exp(-32 / (ctx.sampleRate * 0.022));
  const prosodyK = 1 - Math.exp(-1 / (ctx.sampleRate * 0.025));
  const nasal = [250, 1180, 2250];
  let phase = random();
  let lastFlow = 0;
  let breath = 0;
  let low = 0;
  let index = 0;
  let jitter = 1;
  let shimmer = 1;
  let pitch = speaker.pitch;
  return makeBuffer(ctx, duration, (t, sample) => {
    while (index + 1 < count && t >= segments[index + 1].start) index++;
    const sg = segments[index];
    const prev = segments[Math.max(0, index - 1)];
    const local = t - sg.start;
    const art = smoothstep(local / sg.transition);
    const voiced = sg.consonant === 0 ? 0.35 + art * 0.65 : sg.consonant === 1 ? 0.7 + art * 0.3 : art;
    if (sample % 32 === 0) {
      for (let i = 0; i < resonators.length; i++) {
        const r = resonators[i];
        const from = sg.consonant === 0 ? nasal[i] : prev.vowel[i];
        const target = (from + (sg.vowel[i] - from) * art) * speaker.formants;
        r.frequency += (target - r.frequency) * formantK;
        r.a = 2 * r.radius * Math.cos((TAU * r.frequency) / ctx.sampleRate);
      }
    }
    const n = random() * 2 - 1;
    breath += (n - breath) * breathK;
    low += (n - low) * 0.025;
    pitch += (speaker.pitch * sg.pitch * (1.06 - (pitchFall * t) / duration) - pitch) * prosodyK;
    const f0 = pitch * jitter * (1 + 0.014 * Math.sin(t * 21) + 0.008 * Math.sin(t * 37));
    phase += f0 / ctx.sampleRate;
    if (phase >= 1) {
      phase -= 1;
      jitter = 0.991 + random() * 0.018;
      shimmer = 0.94 + random() * 0.12;
    }
    const flow = phase < open ? 0.5 - 0.5 * Math.cos((Math.PI * phase) / open)
      : phase < open + closing ? Math.cos((Math.PI * 0.5 * (phase - open)) / closing) : 0;
    const pulse = ((flow - lastFlow) * ctx.sampleRate) / (speaker.pitch * 8);
    lastFlow = flow;
    const excitation = pulse * shimmer * voiced + breath * speaker.breath * voiced;
    let vowel = 0;
    for (const r of resonators) {
      const y = excitation + r.a * r.y1 - r.b * r.y2;
      r.y2 = r.y1;
      r.y1 = y;
      vowel += y * r.gain;
    }
    const fricative = sg.consonant === 2 ? (breath - low) * 0.1 * (1 - art)
      : sg.consonant === 3 ? (n - breath) * 0.1 * Math.exp(-Math.max(0, local - 0.012) * 180)
      : sg.consonant === 4 ? breath * 0.055 * (1 - art) : 0;
    const env = smoothstep(t / 0.025) * smoothstep((duration - t) / 0.085);
    return (vowel + fricative) * env;
  }, 0.45);
}

/** a fixed place in the world a sound comes from: HRTF panning, distance muffling, and a level */
interface Emitter {
  input: GainNode;
  filter: BiquadFilterNode;
  panner: PannerNode;
}

function emitter(ctx: AudioContext, out: AudioNode, refDistance: number): Emitter {
  const input = ctx.createGain();
  input.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.5;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = refDistance;
  panner.rolloffFactor = 1.15;
  panner.maxDistance = 300;
  input.connect(filter).connect(panner).connect(out);
  return { input, filter, panner };
}

const smooth = (p: AudioParam, v: number, now: number, time = 0.035) => {
  p.cancelScheduledValues(now);
  p.setTargetAtTime(v, now, time);
};

function place(e: Emitter, x: number, y: number, z: number, now: number, snap: boolean): void {
  if (snap) {
    for (const [p, v] of [[e.panner.positionX, x], [e.panner.positionY, y], [e.panner.positionZ, z]] as const) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(v, now);
    }
  } else {
    smooth(e.panner.positionX, x, now);
    smooth(e.panner.positionY, y, now);
    smooth(e.panner.positionZ, z, now);
  }
}

export interface SoundSource {
  id: number;
  x: number;
  z: number;
  speed: number;
  active: boolean;
}

export interface Listener {
  x: number;
  y: number;
  z: number;
  /** which way the camera looks, flat */
  fx: number;
  fz: number;
}

export interface SpatialAudio {
  /** `chats` is asked for only when the voices are updated, ten times a second */
  update(dt: number, listener: Listener, cars: ReadonlyArray<SoundSource>, chats: () => ReadonlyArray<{ id: number; x: number; z: number }>): void;
  /** how many voices are sounding, for the debug hook */
  counts(): { started: boolean; motors: number; motorPool: number; talk: number; talkPool: number; syllables: number };
}

export function createSpatialAudio(bus: AudioBus, limits: { motors: number; talk: number }): SpatialAudio {
  let ready: {
    ctx: AudioContext;
    motors: Array<{ e: Emitter; src: AudioBufferSourceNode; road: GainNode; id: number; retireAt: number; dist: number }>;
    talkers: Array<{ e: Emitter; id: number; retireAt: number; next: number; reply: boolean; seq: number }>;
    syllables: AudioBuffer[][];
  } | null = null;
  let building = false;
  let since = 0;
  let syllablesPlayed = 0;

  /** the graph is built the first time the world bus exists, i.e. after the first gesture */
  function build(ctx: AudioContext, out: AudioNode): NonNullable<typeof ready> {
    const loops = [4, 4, 6].map((cyl, i) => combustionLoop(ctx, cyl, 0x5eed + i * 977));
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    {
      const d = noise.getChannelData(0);
      const r = randomSequence(77);
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    }
    const motors = Array.from({ length: limits.motors }, (_, i) => {
      const e = emitter(ctx, out, 4);
      const src = ctx.createBufferSource();
      src.buffer = loops[i % loops.length];
      src.loop = true;
      const engine = ctx.createBiquadFilter();
      engine.type = 'lowpass';
      engine.frequency.value = 900;
      src.connect(engine).connect(e.input);
      // tyres on tarmac, louder with speed
      const rumble = ctx.createBufferSource();
      rumble.buffer = noise;
      rumble.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 700;
      band.Q.value = 0.6;
      const road = ctx.createGain();
      road.gain.value = 0;
      rumble.connect(band).connect(road).connect(e.input);
      src.start(0, Math.random() * (src.buffer?.duration ?? 0));
      rumble.start(0, Math.random());
      return { e, src, road, id: -1, retireAt: 0, dist: 0 };
    });
    const talkers = Array.from({ length: limits.talk }, () => ({ e: emitter(ctx, out, 2), id: -1, retireAt: 0, next: 0, reply: false, seq: 0 }));
    const speakers: Speaker[] = [
      { pitch: 119, formants: 0.94, breath: 0.1 }, { pitch: 143, formants: 1.0, breath: 0.08 },
      { pitch: 191, formants: 1.1, breath: 0.09 }, { pitch: 216, formants: 1.14, breath: 0.13 },
    ];
    const syllables = speakers.map((sp, v) => Array.from({ length: 4 }, (_, i) => speechFragment(ctx, sp, i + v * 4 + 20)));
    return { ctx, motors, talkers, syllables };
  }

  return {
    update(dt, l, cars, chats): void {
      const world = bus.world();
      if (!world) return; // no gesture yet, or muted: stay silent
      if (!ready) {
        // synthesising the loops takes a few tens of ms: do it once, off the gesture's own handler
        if (!building) {
          building = true;
          setTimeout(() => (ready = build(world.ctx, world.out)), 0);
        }
        return;
      }
      since += dt;
      if (since < 0.1) return; // ten updates a second is plenty for the ear
      const step = since;
      since = 0;
      const { ctx } = ready;
      const now = ctx.currentTime;

      // the listener rides with the camera
      const lis = ctx.listener;
      if (lis.positionX) {
        smooth(lis.positionX, l.x, now);
        smooth(lis.positionY, l.y, now);
        smooth(lis.positionZ, l.z, now);
        smooth(lis.forwardX, l.fx, now);
        smooth(lis.forwardY, 0, now);
        smooth(lis.forwardZ, l.fz, now);
        smooth(lis.upX, 0, now);
        smooth(lis.upY, 1, now);
        smooth(lis.upZ, 0, now);
      } else {
        lis.setPosition(l.x, l.y, l.z);
        lis.setOrientation(l.fx, 0, l.fz, 0, 1, 0);
      }

      // ---------- engines: the nearest few cars get a voice ----------
      const near = cars
        .filter((c) => c.active)
        .map((c) => ({ c, d: Math.hypot(c.x - l.x, c.z - l.z) }))
        .filter((q) => q.d < MOTOR_RANGE)
        .sort((a, b) => a.d - b.d)
        .slice(0, ready.motors.length);
      const wanted = new Set(near.map((q) => q.c.id));
      for (const v of ready.motors) {
        if (v.id >= 0 && !wanted.has(v.id) && !v.retireAt) {
          smooth(v.e.input.gain, 0, now, 0.025);
          v.retireAt = now + RETIRE;
        }
        if (v.retireAt && now >= v.retireAt) {
          v.id = -1;
          v.retireAt = 0;
        }
      }
      for (const { c, d } of near) {
        let v = ready.motors.find((m) => m.id === c.id);
        let fresh = false;
        if (!v) {
          v = ready.motors.find((m) => m.id < 0);
          if (!v) continue; // retiring voices still count against the pool
          v.id = c.id;
          fresh = true;
        }
        v.retireAt = 0;
        place(v.e, c.x, 0.6, c.z, now, fresh);
        // coming toward you sounds higher, going away lower
        const radial = fresh ? 0 : clamp((d - v.dist) / step, -40, 40);
        const doppler = clamp(343 / (343 + radial), 0.85, 1.18);
        v.dist = d;
        const rev = 0.55 + clamp(c.speed / 8, 0, 1.2) * 0.7;
        smooth(v.src.playbackRate, rev * doppler, now, 0.08);
        const fade = smoothstep((MOTOR_RANGE - d) / (MOTOR_RANGE * 0.3));
        smooth(v.e.input.gain, 0.32 * fade, now, 0.05);
        smooth(v.road.gain, clamp(c.speed / 8, 0, 1) * 0.35, now, 0.1);
        smooth(v.e.filter.frequency, 1800 + 14000 * Math.exp(-d / 40), now, 0.12);
      }

      // ---------- chatter: the nearest chats, a speaker at a time ----------
      const talk = chats()
        .map((c) => ({ c, d: Math.hypot(c.x - l.x, c.z - l.z) }))
        .filter((q) => q.d < TALK_RANGE)
        .sort((a, b) => a.d - b.d)
        .slice(0, ready.talkers.length);
      const talking = new Set(talk.map((q) => q.c.id));
      for (const v of ready.talkers) {
        if (v.id >= 0 && !talking.has(v.id)) {
          smooth(v.e.input.gain, 0, now, 0.025);
          v.id = -1;
        }
      }
      for (const { c, d } of talk) {
        let v = ready.talkers.find((t) => t.id === c.id);
        if (!v) {
          v = ready.talkers.find((t) => t.id < 0);
          if (!v) continue;
          v.id = c.id;
          v.next = now + 0.3;
          v.reply = false;
          place(v.e, c.x, 1.3, c.z, now, true);
        }
        smooth(v.e.input.gain, 0.5 * smoothstep((TALK_RANGE - d) / (TALK_RANGE * 0.4)), now, 0.05);
        if (now < v.next) continue;
        // one of the pair speaks a phrase, then the other replies after a pause
        const voice = ready.syllables[(c.id * 2 + (v.reply ? 1 : 0)) % ready.syllables.length];
        const count = Math.random() < 0.65 ? 2 : 1;
        let when = now + 0.02;
        for (let i = 0; i < count; i++) {
          const buf = voice[(v.seq + i) % voice.length];
          const s = ctx.createBufferSource();
          s.buffer = buf;
          s.playbackRate.value = 0.97 + Math.random() * 0.06;
          s.connect(v.e.input);
          s.start(when);
          when += buf.duration / s.playbackRate.value + 0.065 + Math.random() * 0.13;
          syllablesPlayed++;
        }
        v.next = when + 0.35 + Math.random() * 0.75;
        v.reply = !v.reply;
        v.seq++;
      }
    },

    counts: () => ({
      started: !!ready,
      motors: ready ? ready.motors.filter((m) => m.id >= 0).length : 0,
      motorPool: limits.motors,
      talk: ready ? ready.talkers.filter((t) => t.id >= 0).length : 0,
      talkPool: limits.talk,
      syllables: syllablesPlayed,
    }),
  };
}
