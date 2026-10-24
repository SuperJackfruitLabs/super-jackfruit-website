// The garage: every car you can drive, how it handles, and how it sounds.
//
// The off-roader and five replacements are Han66st's authored models (CC-BY-4.0);
// the race car is eddyboa's Low-poly Vintage F1 (CC-BY-4.0). Selected styles
// load on demand, so the village downloads one car on arrival.

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

export interface CarStyle {
  id: string;
  name: string;
  model: string;
}

export interface CarSpec {
  id: string;
  name: string;
  /** shown under the picker */
  note: string;
  model: string;
  styles?: CarStyle[];
  /** body length in the village, m */
  length: number;
  /** original finish first, then selective body-paint alternatives */
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
    styles: [
      { id: 'sedan', name: 'Sedan', model: 'car-sedan' },
      { id: 'wagon', name: 'Wagon', model: 'car-sedan-wagon' },
    ],
    thumb: '/assets/village/cars/sedan.webp',
    length: 3.0,
    paints: ['#8b0000', '#ecece8', '#2c5d8a', '#30343a'],
    handling: { ...BASE, bodyK: 110, bodyC: 15 },
    engine: { ...PETROL, idleRate: 0.75, rateSpan: 1.05, tone: 4200 },
  },
  {
    id: 'sports',
    name: 'Sports Apex',
    note: 'Quicker, with sharper steering.',
    model: 'car-sports',
    thumb: '/assets/village/cars/sports.webp',
    length: 3.0,
    paints: ['#e76c00', '#ecece8', '#24272b', '#2c5d8a'],
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
    paints: ['#d92d27', '#f2b632', '#1b8b68', '#3478b9'],
    handling: { ...BASE, bodyK: 100, bodyC: 14 },
    engine: { ...PETROL, idleRate: 0.72, rateSpan: 1.0, tone: 3600 },
  },
  {
    id: 'van',
    name: 'Van Transit-Ion',
    note: 'Heavier, with wider turns.',
    model: 'car-van',
    styles: [
      { id: 'mpv', name: 'MPV', model: 'car-van' },
      { id: 'suv', name: 'SUV', model: 'car-van-suv' },
    ],
    thumb: '/assets/village/cars/van.webp',
    length: 3.3,
    paints: ['#989898', '#a52323', '#e4e2dc', '#2c5d8a'],
    handling: { ...BASE, maxSpeed: 10, accel: 7, steer: 1.6, grip: 18, bodyK: 75, bodyC: 11, knock: 0.7 },
    engine: { ...PETROL, idleRate: 0.55, rateSpan: 0.9, gearSpan: 5, tone: 2400, grit: 0.2 },
  },
  {
    id: 'truck',
    name: 'Pickup L300',
    note: 'The heaviest: slow and hard to stop.',
    model: 'car-truck',
    thumb: '/assets/village/cars/truck.webp',
    length: 3.7,
    paints: ['#1a1a1a', '#a52323', '#e4e2dc', '#2c5d8a'],
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
    paints: ['#dc2525', '#2964c7', '#22946f', '#e97b24'],
    handling: { ...BASE, maxSpeed: 16, nitroMax: 24, accel: 14, nitroAccel: 22, steer: 2.3, grip: 38, bodyK: 170, bodyC: 22, knock: 1.2 },
    engine: { ...PETROL, idleRate: 1.0, rateSpan: 1.6, gearSpan: 9, tone: 9000, grit: 0.4, gain: 1.1 },
  },
];

export const carById = (id: string | null | undefined): CarSpec =>
  CARS.find((c) => c.id === id) ?? CARS[0];

export const carStyle = (spec: CarSpec, id: string | null | undefined): CarStyle =>
  spec.styles?.find((style) => style.id === id) ?? spec.styles?.[0] ?? { id: 'factory', name: 'Factory', model: spec.model };

export interface CarChoice {
  car: string;
  paint: number;
  style?: string;
}

const KEY = 'village:car';

export function loadChoice(): CarChoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const spec = carById(v?.car);
    const paint = Number.isInteger(v?.paint) && v.paint >= 0 && v.paint < spec.paints.length ? v.paint : 0;
    return { car: spec.id, paint, ...(spec.styles ? { style: carStyle(spec, v?.style).id } : {}) };
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
