import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COURSE_HALF_WIDTH,
  createChives,
  createWind,
  launch,
  powerAt,
  stepFlight,
  type Chive,
  type Wind,
} from '../src/simulation.ts';

const calm: Wind = { x: 0, forward: 0, speed: 0 };
const chive: Chive = { id: 1, name: 'ニラ', length: 1, power: 1, stability: 1, bend: 0, seed: 42, color: '#398b36' };

function finish(power = 1, side = 0, lift = 0.6, wind = calm) {
  const flight = launch(chive, power, side, lift, wind);
  for (let i = 0; i < 1200 && !flight.landed; i++) stepFlight(flight, wind, 1 / 120);
  assert.ok(flight.landed, 'throw must land within ten seconds');
  return flight;
}

test('each selection has eight unique and reproducible chives', () => {
  const first = createChives(() => 0.5);
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map((leaf) => leaf.id)).size, 8);
  assert.equal(new Set(first.map((leaf) => leaf.length)).size, 8);
  assert.deepEqual(first, createChives(() => 0.5));
  assert.equal(first.filter((leaf) => [2, 6].includes(leaf.id)).length, 2);
});

test('power peaks at 850 ms and repeats while a touch is held', () => {
  assert.equal(powerAt(0), 0.05);
  assert.equal(powerAt(850), 1);
  assert.ok(Math.abs(powerAt(425) - 0.525) < 1e-10);
  assert.equal(powerAt(1700), powerAt(0));
  assert.equal(powerAt(2550), powerAt(850));
  assert.equal(powerAt(-100), powerAt(0));
});

test('a centered good throw flies 60–110 metres in three to five seconds', () => {
  const flight = finish();
  assert.ok(flight.distance > 60 && flight.distance < 110, `${flight.distance} m`);
  assert.ok(flight.time > 3 && flight.time < 5, `${flight.time} s`);
  assert.equal(flight.out, false);
  assert.equal(flight.y, 0.12);
  assert.ok(finish(0.15).distance < flight.distance * 0.4);
});

test('direction and swipe length change the trajectory', () => {
  const right = finish(1, 0.8);
  const left = finish(1, -0.8);
  assert.ok(right.x > COURSE_HALF_WIDTH);
  assert.ok(left.x < -COURSE_HALF_WIDTH);
  assert.equal(right.out, true);
  assert.equal(left.out, true);
  assert.ok(finish(1, 0, 0.9).time > finish(1, 0, 0.2).time);
});

test('crosswind drifts sideways; headwind and tailwind affect distance', () => {
  const rightWind = { x: 4.8, forward: 0, speed: 4.8 };
  const leftWind = { x: -4.8, forward: 0, speed: 4.8 };
  assert.ok(finish(1, 0, 0.6, rightWind).x > 2);
  assert.ok(finish(1, 0, 0.6, leftWind).x < -2);
  assert.equal(finish(1, 0, 0.6, rightWind).out, false);
  const tail = finish(1, 0, 0.6, { x: 0, forward: 4.8, speed: 4.8 });
  const head = finish(1, 0, 0.6, { x: 0, forward: -4.8, speed: 4.8 });
  assert.ok(tail.distance > head.distance + 10);
});

test('crossing a sideline is permanent even if wind brings the leaf back', () => {
  const flight = launch(chive, 1, 0, 0.6, calm);
  flight.x = COURSE_HALF_WIDTH - 0.01;
  flight.vx = 2;
  stepFlight(flight, calm, 0.1);
  assert.equal(flight.out, true);
  flight.vx = -5;
  stepFlight(flight, calm, 0.3);
  assert.ok(flight.x < COURSE_HALF_WIDTH);
  assert.equal(flight.out, true);
});

test('wind generation has a consistent vector and bounded strength', () => {
  const numbers = [0.25, 1];
  const wind = createWind(() => numbers.shift() ?? 0);
  assert.equal(wind.speed, 4.8);
  assert.ok(Math.abs(Math.hypot(wind.x, wind.forward) - wind.speed) < 1e-10);
  assert.ok(wind.x > 0);
});

test('large and small frame steps agree, and landed throws stop moving', () => {
  const small = finish();
  const large = launch(chive, 1, 0, 0.6, calm);
  stepFlight(large, calm, 10);
  assert.ok(Math.abs(small.distance - large.distance) < 0.01);
  const snapshot = { ...large };
  stepFlight(large, { x: 99, forward: 99, speed: 140 }, 1);
  assert.deepEqual(large, snapshot);
});
