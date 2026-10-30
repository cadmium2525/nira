/** Pure, deterministic rules for a throw. Distances and wind are in metres. */
export interface Chive {
  id: number;
  name: string;
  length: number;
  power: number;
  stability: number;
  bend: number;
  seed: number;
  color: string;
}

/** Signed x/forward wind components in m/s; speed is their magnitude. */
export interface Wind {
  x: number;
  forward: number;
  speed: number;
}

export interface Flight {
  x: number;
  y: number;
  distance: number;
  vx: number;
  vy: number;
  vz: number;
  time: number;
  landed: boolean;
  out: boolean;
  power: number;
}

export interface ThrowResult {
  chive: Chive;
  distance: number;
  out: boolean;
  power: number;
  wind: Wind;
}

export const COURSE_HALF_WIDTH = 6;
const GROUND_HEIGHT = 0.12;
const GRAVITY = 9.81;
const MAX_STEP = 1 / 120;
const characteristics = new WeakMap<Flight, { drag: number; windResponse: number }>();

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

/** A new bunch is created once per game and retained for both selections. */
export function createChives(rng: () => number = Math.random): Chive[] {
  const names = ['すらり', 'くるり', 'しゃきっ', 'のびのび', 'ぴんっ', 'しなり', 'ぐいっ', 'ふわり'];
  const colors = ['#2d8e37', '#439b40', '#258144', '#59a849', '#378c35', '#4b9d46', '#267d3a', '#65a94a'];
  return names.map((name, index) => {
    const variation = clamp(rng(), 0, 1);
    const bend = (clamp(rng(), 0, 1) - 0.5) * 0.42;
    return {
      id: index + 1,
      name,
      length: 0.83 + index * 0.035 + variation * 0.2,
      power: 0.91 + variation * 0.14 + (index % 3) * 0.018,
      stability: 0.78 + (1 - variation) * 0.24 + (index % 2) * 0.055,
      bend,
      seed: Math.floor(clamp(rng(), 0, 1) * 0x7fffffff),
      color: colors[index],
    };
  });
}

export function createWind(rng: () => number = Math.random): Wind {
  const angle = clamp(rng(), 0, 1) * Math.PI * 2;
  const speed = 0.6 + clamp(rng(), 0, 1) * 4.2;
  return { x: Math.sin(angle) * speed, forward: Math.cos(angle) * speed, speed };
}

/** Smooth repeating meter: 5% at touch-down, 100% after 850 ms. */
export function powerAt(holdMs: number): number {
  const time = Math.max(0, Number.isFinite(holdMs) ? holdMs : 0);
  const wave = Math.sin(((time % 1700) / 1700) * Math.PI);
  return 0.05 + 0.95 * wave * wave;
}

/** side controls heading; lift controls elevation independently of charge. */
export function launch(chive: Chive, power: number, side: number, lift: number, _wind: Wind): Flight {
  const charge = clamp(power, 0, 1);
  const elevation = 0.32 + clamp(lift, 0, 1) * 0.59;
  const heading = clamp(side, -1, 1) * 0.63;
  const strength = clamp(chive.power, 0.75, 1.25);
  const speed = (11 + 22 * charge) * strength;
  const horizontalSpeed = speed * Math.cos(elevation);
  const flight: Flight = {
    x: 0,
    y: 1.05,
    distance: 0,
    vx: horizontalSpeed * Math.sin(heading),
    vy: speed * Math.sin(elevation),
    vz: horizontalSpeed * Math.cos(heading),
    time: 0,
    landed: false,
    out: false,
    power: charge,
  };
  characteristics.set(flight, {
    drag: 0.035 + Math.abs(chive.bend) * 0.045 + Math.max(0, chive.length - 1) * 0.02,
    windResponse: 1 / clamp(chive.stability, 0.65, 1.2),
  });
  return flight;
}

/** Advance in small slices so even delayed frames cannot skip a sideline. */
export function stepFlight(flight: Flight, wind: Wind, dt: number): void {
  if (flight.landed || !Number.isFinite(dt) || dt <= 0) return;
  const { drag, windResponse } = characteristics.get(flight) ?? { drag: 0.04, windResponse: 1 };
  let remaining = dt;
  while (remaining > 1e-9 && !flight.landed) {
    const step = Math.min(MAX_STEP, remaining);
    const ax = wind.x * 0.105 * windResponse - flight.vx * drag;
    const ay = -GRAVITY - flight.vy * drag;
    const az = wind.forward * 0.24 * windResponse - flight.vz * drag;
    const nextY = flight.y + flight.vy * step + 0.5 * ay * step * step;
    // Finish on the ground, rather than counting motion below the surface.
    const actualStep = nextY < GROUND_HEIGHT && flight.vy < 0
      ? step * clamp((flight.y - GROUND_HEIGHT) / (flight.y - nextY), 0, 1)
      : step;
    flight.x += flight.vx * actualStep + 0.5 * ax * actualStep * actualStep;
    flight.y += flight.vy * actualStep + 0.5 * ay * actualStep * actualStep;
    flight.distance = Math.max(0, flight.distance + flight.vz * actualStep + 0.5 * az * actualStep * actualStep);
    flight.vx += ax * actualStep;
    flight.vy += ay * actualStep;
    flight.vz = Math.max(0, flight.vz + az * actualStep);
    flight.time += actualStep;
    if (Math.abs(flight.x) > COURSE_HALF_WIDTH) flight.out = true;
    if (nextY <= GROUND_HEIGHT && flight.vy < 0) {
      flight.y = GROUND_HEIGHT;
      flight.landed = true;
    }
    remaining -= step;
  }
}
