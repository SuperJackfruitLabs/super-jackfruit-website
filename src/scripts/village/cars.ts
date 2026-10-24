// The garage: every car you can drive, how it handles, and how it sounds.
//
// The off-roader is "Low poly Japan Offroad Car" by Han66st (CC-BY-4.0); the
// rest are Kenney's Car Kit (CC0). One model file per car, fetched only when
// someone picks it, so the village still downloads a single car on arrival.

/** How a car drives. The off-roader's numbers are the village's originals. */
export interface Handling {
  maxSpeed: number;
  nitroMax: number;
  accel: number;
  nitroAccel: number;
  brake: number;
  drag: number;
  /** yaw rate at full lock, rad/s */
  steer: number;
  /**
   * Lateral acceleration the tyres hold before they scrub, m/s². A keyboard
   * turn is always full lock, so a full-lock corner at top speed
   * (steer × maxSpeed) must stay under this, or every bend leaves marks; on
   * nitro it doesn't, and those are the corners that should.
   */
  grip: number;
  /** suspension spring and damping: soft and bouncy, or stiff */
  bodyK: number;
  bodyC: number;
  /** how much a knock throws the body about; heavier cars shrug */
  knock: number;
}

/**
 * How the engine sounds. Every car plays a loop through the same faked
 * gearbox; these set its pitch range, gear length and tone.
 */
export interface EngineSound {
  /** the loop; cars without their own recording share the petrol one */
  url: string;
  /** playback rate at idle and the extra rate a gear's full span adds */
  idleRate: number;
  rateSpan: number;
  /** speed span of one gear, m/s */
  gearSpan: number;
  /** lowpass cutoff, Hz: low for big diesels, open for a race car */
  tone: number;
  /** waveshaper grit, 0..1 */
  grit: number;
  gain: number;
}

export interface CarSpec {
  id: string;
  name: string;
  /** shown under the picker */
  note: string;
  model: string;
  /** body length in the village, m */
  length: number;
  /**
   * Paints the picker offers, as replacements for the model's paint material.
   * Kenney's cars paint through a shared texture palette, so they come as they
   * are and this stays empty.
   */
  paints: string[];
  /** picker thumbnail */
  thumb: string;
  handling: Handling;
  engine: EngineSound;
}

export const PETROL_URL = '/assets/village/engine-petrol.mp3';

const BASE: Handling = {
  maxSpeed: 11,
  nitroMax: 18,
  accel: 9,
  nitroAccel: 17,
  brake: 16,
  drag: 3.2,
  steer: 1.9,
  grip: 22,
  bodyK: 90,
  bodyC: 13,
  knock: 1,
};

const PETROL: EngineSound = {
  url: PETROL_URL,
  idleRate: 0.65,
  rateSpan: 1.15,
  gearSpan: 6.5,
  tone: 6000,
  grit: 0,
  gain: 1,
};

export const CARS: CarSpec[] = [
  {
    id: 'offroad',
    name: 'Off Roader Jimmy',
    note: 'Bouncy and grippy.',
    model: 'offroad-car',
    thumb: '/assets/village/cars/offroad.webp',
    length: 2.9,
    paints: ['#6b7d12', '#cc0000', '#00007d'],
    handling: BASE,
    engine: PETROL,
  },
  {
    id: 'sedan',
    name: 'Sedan Corollary',
    note: 'A steady all-rounder.',
    model: 'car-sedan',
    thumb: '/assets/village/cars/sedan.webp',
    length: 3.0,
    paints: [],
    handling: { ...BASE, bodyK: 110, bodyC: 15 },
    engine: { ...PETROL, idleRate: 0.75, rateSpan: 1.05, tone: 4200 },
  },
  {
    id: 'sports',
    name: 'Sports SupraCharge',
    note: 'Quicker, with sharper steering.',
    model: 'car-sports',
    thumb: '/assets/village/cars/sports.webp',
    length: 3.0,
    paints: [],
    handling: { ...BASE, maxSpeed: 14, nitroMax: 21, accel: 12, steer: 2.15, grip: 31, bodyK: 140, bodyC: 18 },
    engine: { ...PETROL, idleRate: 0.85, rateSpan: 1.4, gearSpan: 7.5, grit: 0.25, gain: 1.1 },
  },
  {
    id: 'taxi',
    name: 'Taxi Checkers',
    note: 'A sedan with a roof sign.',
    model: 'car-taxi',
    thumb: '/assets/village/cars/taxi.webp',
    length: 3.0,
    paints: [],
    handling: { ...BASE, bodyK: 100, bodyC: 14 },
    engine: { ...PETROL, idleRate: 0.72, rateSpan: 1.0, tone: 3600 },
  },
  {
    id: 'police',
    name: 'Police Vic-Tory',
    note: 'Fast in a straight line.',
    model: 'car-police',
    thumb: '/assets/village/cars/police.webp',
    length: 3.2,
    paints: [],
    handling: { ...BASE, maxSpeed: 13, nitroMax: 20, accel: 10.5, grip: 26, bodyK: 120, bodyC: 16 },
    engine: { ...PETROL, idleRate: 0.6, rateSpan: 1.25, gearSpan: 7, tone: 3200, grit: 0.35, gain: 1.15 },
  },
  {
    id: 'van',
    name: 'Van Transit-Ion',
    note: 'Heavier, with wider turns.',
    model: 'car-van',
    thumb: '/assets/village/cars/van.webp',
    length: 3.3,
    paints: [],
    handling: { ...BASE, maxSpeed: 10, accel: 7, steer: 1.6, grip: 18, bodyK: 75, bodyC: 11, knock: 0.7 },
    engine: { ...PETROL, idleRate: 0.55, rateSpan: 0.9, gearSpan: 5, tone: 2400, grit: 0.2 },
  },
  {
    id: 'truck',
    name: 'Truck HiLuxury',
    note: 'The heaviest: slow and hard to stop.',
    model: 'car-truck',
    thumb: '/assets/village/cars/truck.webp',
    length: 3.7,
    paints: [],
    handling: { ...BASE, maxSpeed: 9, nitroMax: 14, accel: 5.5, nitroAccel: 11, brake: 11, drag: 2.4, steer: 1.45, grip: 16, bodyK: 65, bodyC: 10, knock: 0.45 },
    engine: { ...PETROL, idleRate: 0.42, rateSpan: 0.7, gearSpan: 4, tone: 1500, grit: 0.55, gain: 1.3 },
  },
  {
    id: 'race',
    name: 'Race F1-Nale',
    note: 'The fastest, and twitchy.',
    model: 'car-race',
    thumb: '/assets/village/cars/race.webp',
    length: 3.1,
    paints: [],
    handling: { ...BASE, maxSpeed: 16, nitroMax: 24, accel: 14, nitroAccel: 22, steer: 2.3, grip: 38, bodyK: 170, bodyC: 22, knock: 1.2 },
    engine: { ...PETROL, idleRate: 1.0, rateSpan: 1.6, gearSpan: 9, tone: 9000, grit: 0.4, gain: 1.1 },
  },
];

export const carById = (id: string | null | undefined): CarSpec =>
  CARS.find((c) => c.id === id) ?? CARS[0];

export interface CarChoice {
  car: string;
  paint: number;
}

const KEY = 'village:car';

export function loadChoice(): CarChoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const spec = carById(v?.car);
    const paint = Number.isInteger(v?.paint) && v.paint >= 0 && v.paint < spec.paints.length ? v.paint : 0;
    return { car: spec.id, paint };
  } catch {
    return { car: CARS[0].id, paint: 0 };
  }
}

export function saveChoice(c: CarChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private window: the choice lasts this visit */
  }
}
