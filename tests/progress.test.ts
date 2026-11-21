import { describe, expect, it } from 'vitest';
import { generate } from '../src/shared/puzzle';
import { progressKey, readProgress } from '../src/client/progress';

describe('in-progress storage', () => {
  const puzzle = generate('2026-05-17');
  const states = puzzle.mirrors.map((m) => m.initial);
  states[0] = 1 - states[0]!;
  const progress = {
    puzzle: JSON.stringify(puzzle),
    states,
    history: [0],
    taps: 1,
    startedAt: 1000,
  };
  it('restores valid state and keeps player and date keys separate', () => {
    expect(readProgress(JSON.stringify(progress), puzzle, 2000)).toEqual(
      progress
    );
    expect(progressKey(puzzle, 'Alice')).not.toBe(progressKey(puzzle, 'Bob'));
    expect(progressKey(puzzle, 'Alice')).not.toBe(
      progressKey(generate('2026-05-18'), 'Alice')
    );
  });
  it('ignores empty, malformed and obsolete data', () => {
    for (const raw of [
      null,
      '',
      '{',
      'null',
      '{}',
      JSON.stringify({ ...progress, puzzle: 'old puzzle' }),
    ])
      expect(readProgress(raw, puzzle, 2000)).toBeNull();
  });
  it('rejects invalid state, history, tap counts and timestamps', () => {
    for (const invalid of [
      { states: [] },
      { states: states.map(() => 2) },
      { history: [-1] },
      { history: [] },
      { taps: -1 },
      { taps: 0.5 },
      { taps: 100001 },
      { startedAt: null },
      { startedAt: 3000 },
    ])
      expect(
        readProgress(JSON.stringify({ ...progress, ...invalid }), puzzle, 2000)
      ).toBeNull();
  });
});
