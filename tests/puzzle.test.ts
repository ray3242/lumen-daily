import { describe, expect, it } from 'vitest';
import { generate, simulate, solve } from '../src/shared/puzzle';
import {
  advance,
  emptyProfile,
  GameService,
  MemoryStore,
} from '../src/shared/service';
describe('daily puzzles', () => {
  it('is deterministic', () =>
    expect(generate('2026-05-17')).toEqual(generate('2026-05-17')));
  it('has a solvable, unsolved scramble and exact minimum par for 365 UTC dates', () => {
    const sizes = new Set<number>();
    const difficulties = new Set<string>();
    for (let i = 0; i < 365; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i))
        .toISOString()
        .slice(0, 10);
      const p = generate(date);
      sizes.add(p.size);
      difficulties.add(p.difficulty);
      expect(
        simulate(
          p,
          p.mirrors.map((m) => m.initial)
        ).solved,
        date
      ).toBe(false);
      const solved = solve(p);
      expect(simulate(p, solved.states).solved, date).toBe(true);
      expect(solved.par).toBe(p.par);
      let minimum = Infinity;
      for (let mask = 0; mask < 2 ** p.mirrors.length; mask++) {
        const states = p.mirrors.map((_, j) => (mask >> j) & 1);
        if (simulate(p, states).solved)
          minimum = Math.min(
            minimum,
            states.filter((s, j) => s !== p.mirrors[j]!.initial).length
          );
      }
      expect(p.par, date).toBe(minimum);
    }
    expect([...sizes].sort()).toEqual([6, 7, 8]);
    expect(difficulties.size).toBe(5);
  }, 30000);
});
describe('server validation and persistence', () => {
  const date = '2026-05-17';
  const p = generate(date);
  const solution = solve(p);
  it('rejects empty, malformed, unsolved and impossible stats', async () => {
    const service = new GameService(new MemoryStore(), () => date);
    for (const input of [
      null,
      {},
      { states: [], taps: 0, seconds: 2 },
      { states: p.mirrors.map((m) => m.initial), taps: 10, seconds: 2 },
      { states: solution.states, taps: -1, seconds: 2 },
      { states: solution.states, taps: solution.par, seconds: Infinity },
    ])
      await expect(service.submit('a', 'Alice', date, input)).rejects.toThrow();
    await expect(
      service.submit('', 'Guest', date, {
        states: solution.states,
        taps: solution.par,
        seconds: 1,
      })
    ).rejects.toThrow('Sign in');
    expect((await service.init('a', 'Alice', date)).result).toBeNull();
    expect((await service.leaderboard('a', date)).top).toEqual([]);
  });
  it('saves best, ranks taps before time, and does not double count repeats', async () => {
    const s = new GameService(new MemoryStore(), () => date);
    const input = { states: solution.states, taps: solution.par, seconds: 123 };
    await s.submit('a', 'Alice', date, input);
    await s.submit('a', 'Alice', date, { ...input, seconds: 150 });
    await s.submit('b', 'Bob', date, {
      ...input,
      taps: solution.par + 1,
      seconds: 1,
    });
    expect((await s.result('a', date))?.seconds).toBe(123);
    expect((await s.profile('a')).total).toBe(1);
    expect((await s.leaderboard('a', date)).rank).toBe(1);
    expect((await s.leaderboard('b', date)).rank).toBe(2);
  });
  it('archive solves never advance the streak', async () => {
    const s = new GameService(new MemoryStore(), () => '2026-05-18');
    await s.submit('a', 'Alice', date, {
      states: solution.states,
      taps: solution.par,
      seconds: 1,
    });
    expect(await s.profile('a')).toEqual(emptyProfile());
  });
});
describe('UTC streaks', () => {
  it('handles midnight, year boundary, skipped dates and repeated dates', () => {
    const first = advance(emptyProfile(), '2025-12-31');
    expect(first.streak).toBe(1);
    const second = advance(first, '2026-01-01');
    expect(second.streak).toBe(2);
    expect(advance(second, '2026-01-01')).toEqual(second);
    expect(advance(second, '2025-12-30')).toEqual(second);
    expect(advance(second, '2026-01-03').streak).toBe(1);
  });
});
