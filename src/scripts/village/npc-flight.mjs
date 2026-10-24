export const NPC_LAUNCH_TIME = 0.9;
export const NPC_DESCENT_TIME = 4.4;
export const NPC_FLIGHT_HEIGHT = 8.5;
export const NPC_FLIGHT_TIME = NPC_LAUNCH_TIME + NPC_DESCENT_TIME;

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));

export function sweptContact(ax, az, bx, bz, px, pz, radius) {
  const dx = bx - ax;
  const dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t = length2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / length2) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t)) < radius;
}

export function chooseLanding(origin, isSafe, seed = 0) {
  if (origin.home && isSafe(origin.home.x, origin.home.z)) {
    return { x: origin.home.x, z: origin.home.z, y: origin.home.y ?? 0 };
  }
  const start = seed * 2.399963229728653;
  for (const radius of [2, 3.5, 5, 7]) {
    for (let i = 0; i < 20; i++) {
      const angle = start + (i / 20) * Math.PI * 2;
      const x = origin.x + Math.cos(angle) * radius;
      const z = origin.z + Math.sin(angle) * radius;
      if (isSafe(x, z)) return { x, z, y: 0 };
    }
  }
  return null;
}

export function createFlight(origin, landing) {
  return {
    elapsed: 0,
    x: origin.x,
    z: origin.z,
    y: origin.y ?? 0,
    landing,
    apex: (origin.y ?? 0) + NPC_FLIGHT_HEIGHT,
  };
}

export function sampleFlight(flight, dt) {
  flight.elapsed = Math.min(NPC_FLIGHT_TIME, flight.elapsed + dt);
  const t = flight.elapsed;
  const end = flight.landing;
  if (t < NPC_LAUNCH_TIME) {
    const u = t / NPC_LAUNCH_TIME;
    return {
      phase: 'launch', landed: false, canopy: 0,
      x: flight.x, z: flight.z,
      y: flight.y + NPC_FLIGHT_HEIGHT * (1 - (1 - u) ** 2),
    };
  }
  const u = clamp((t - NPC_LAUNCH_TIME) / NPC_DESCENT_TIME);
  const drift = smooth(u);
  const sway = Math.sin(u * Math.PI * 2) * Math.sin(u * Math.PI) * 0.18;
  const dx = end.x - flight.x;
  const dz = end.z - flight.z;
  const length = Math.hypot(dx, dz) || 1;
  return {
    phase: u >= 1 ? 'landed' : 'parachute',
    landed: u >= 1,
    canopy: u >= 1 ? 0 : smooth(clamp((t - NPC_LAUNCH_TIME) / 0.35)),
    x: flight.x + dx * drift + (-dz / length) * sway,
    z: flight.z + dz * drift + (dx / length) * sway,
    y: end.y + (flight.apex - end.y) * (1 - drift),
  };
}
