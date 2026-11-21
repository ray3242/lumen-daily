import type { Puzzle } from '../shared/puzzle';

export type Progress = {
  puzzle: string;
  states: number[];
  history: number[];
  taps: number;
  startedAt: number;
};
export const progressKey = (puzzle: Puzzle, username: string) =>
  `lumen-progress:${puzzle.date}:${encodeURIComponent(username || 'anonymous')}`;

export function readProgress(
  raw: string | null,
  puzzle: Puzzle,
  now = Date.now()
): Progress | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('puzzle' in value) ||
      value.puzzle !== JSON.stringify(puzzle) ||
      !('states' in value) ||
      !Array.isArray(value.states) ||
      value.states.length !== puzzle.mirrors.length ||
      !value.states.every((s) => s === 0 || s === 1) ||
      !('history' in value) ||
      !Array.isArray(value.history) ||
      !value.history.every(
        (i) => Number.isInteger(i) && i >= 0 && i < puzzle.mirrors.length
      ) ||
      !('taps' in value) ||
      typeof value.taps !== 'number' ||
      !Number.isInteger(value.taps) ||
      value.taps < value.history.length ||
      value.taps > 100000 ||
      !('startedAt' in value) ||
      typeof value.startedAt !== 'number' ||
      !Number.isFinite(value.startedAt) ||
      value.startedAt <= 0 ||
      value.startedAt > now
    )
      return null;
    const states = puzzle.mirrors.map((m) => m.initial);
    for (const index of value.history) states[index] = 1 - states[index]!;
    const savedStates = value.states;
    if (!states.every((state, i) => state === savedStates[i])) return null;
    return {
      puzzle: value.puzzle,
      states: value.states,
      history: value.history,
      taps: value.taps,
      startedAt: value.startedAt,
    };
  } catch {
    return null;
  }
}

export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Storage is optional when the browser disables it. */
  }
}
