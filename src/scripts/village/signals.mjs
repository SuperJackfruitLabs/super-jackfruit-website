// Traffic signals, as a pure function of the clock.
//
// Nothing stores a signal's state: the drivers and the lamps both ask what the
// phase is at this second, so they can't disagree, and every visitor's village
// shows the same lights at the same moment (the clock is the wall clock).
//
// One cycle, in seconds: the through road gets the long green, then a short
// all-red, then the side street's turn, then all-red again.

export const CYCLE = 32;
const MAIN_GREEN = 15;
const MAIN_AMBER = 3;
const CLEAR = 1;
const SIDE_GREEN = 9;
const SIDE_AMBER = 3;

/**
 * What an approach sees at time t (seconds).
 * @param {number} t
 * @param {boolean} main the through road, or the side street
 * @param {number} [offset] so neighbouring junctions don't change together
 * @returns {'green' | 'amber' | 'red'}
 */
export function signalPhase(t, main, offset = 0) {
  const c = (((t + offset) % CYCLE) + CYCLE) % CYCLE;
  if (main) {
    if (c < MAIN_GREEN) return 'green';
    if (c < MAIN_GREEN + MAIN_AMBER) return 'amber';
    return 'red';
  }
  const start = MAIN_GREEN + MAIN_AMBER + CLEAR;
  if (c >= start && c < start + SIDE_GREEN) return 'green';
  if (c >= start + SIDE_GREEN && c < start + SIDE_GREEN + SIDE_AMBER) return 'amber';
  return 'red';
}
