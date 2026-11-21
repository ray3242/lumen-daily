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
  it.each([true, false])(
    'never replaces a better score under concurrent submissions (best first: %s)',
    async (bestFirst) => {
      class ContendedStore extends MemoryStore {
        conflicts = 0;
        override async watch(...keys: string[]) {
          const tx = await super.watch(...keys);
          return {
            ...tx,
            exec: async () => {
              const replies = await tx.exec();
              if (!replies.length) this.conflicts++;
              return replies;
            },
          };
        }
      }
      const store = new ContendedStore();
      const s = new GameService(store, () => date);
      const best = { states: solution.states, taps: solution.par, seconds: 10 };
      const worse = { ...best, seconds: 100 };
      await Promise.all(
        (bestFirst ? [best, worse] : [worse, best]).map((input) =>
          s.submit('a', 'Alice', date, input)
        )
      );
      expect(store.conflicts).toBeGreaterThan(0);
      expect((await s.result('a', date))?.seconds).toBe(10);
      expect((await s.leaderboard('a', date)).top[0]?.seconds).toBe(10);
      expect((await s.profile('a')).total).toBe(1);
    }
  );
  it.each(['leaderboard', 'profile'])(
    'repairs a legacy partial save missing %s on retry',
    async (missing) => {
      const store = new MemoryStore();
      const s = new GameService(store, () => date);
      const best = {
        states: solution.states,
        taps: solution.par,
        seconds: 10,
        username: 'Alice',
      };
      await store.set(`result:${date}:a`, JSON.stringify(best));
      if (missing === 'profile')
        await store.zAdd(`board:${date}`, {
          member: 'a',
          score: best.taps * 100000 + best.seconds,
        });
      await s.submit('a', 'Alice', date, { ...best, seconds: 100 });
      await s.submit('a', 'Alice', date, best);
      expect((await s.result('a', date))?.seconds).toBe(10);
      expect((await s.leaderboard('a', date)).rank).toBe(1);
      expect(await s.profile('a')).toEqual({ streak: 1, total: 1, last: date });
    }
  );
  it('recovers after an acknowledged commit is lost without counting the solve twice', async () => {
    class LostResponseStore extends MemoryStore {
      fail = true;
      override async watch(...keys: string[]) {
        const tx = await super.watch(...keys);
        return {
          ...tx,
          exec: async () => {
            const replies = await tx.exec();
            if (this.fail) {
              this.fail = false;
              throw new Error('Lost response');
            }
            return replies;
          },
        };
      }
    }
    const s = new GameService(new LostResponseStore(), () => date);
    const input = { states: solution.states, taps: solution.par, seconds: 10 };
    await expect(s.submit('a', 'Alice', date, input)).rejects.toThrow(
      'Lost response'
    );
    await s.submit('a', 'Alice', date, input);
    expect((await s.profile('a')).total).toBe(1);
    expect((await s.leaderboard('a', date)).rank).toBe(1);
  });
  it.each(['leaderboard', 'profile'])(
    'does not partially save when the %s write fails before commit',
    async (failure) => {
      class FailingStore extends MemoryStore {
        fail = true;
        override async watch(...keys: string[]) {
          const tx = await super.watch(...keys);
          return {
            ...tx,
            set: async (key: string, value: string) => {
              if (
                this.fail &&
                failure === 'profile' &&
                key.startsWith('user:')
              ) {
                this.fail = false;
                throw new Error('Write failed');
              }
              return tx.set(key, value);
            },
            zAdd: async (
              key: string,
              member: { member: string; score: number }
            ) => {
              if (this.fail && failure === 'leaderboard') {
                this.fail = false;
                throw new Error('Write failed');
              }
              return tx.zAdd(key, member);
            },
          };
        }
      }
      const s = new GameService(new FailingStore(), () => date);
      const input = {
        states: solution.states,
        taps: solution.par,
        seconds: 10,
      };
      await expect(s.submit('a', 'Alice', date, input)).rejects.toThrow(
        'Write failed'
      );
      expect(await s.result('a', date)).toBeNull();
      await s.submit('a', 'Alice', date, input);
      expect((await s.profile('a')).total).toBe(1);
      expect((await s.leaderboard('a', date)).rank).toBe(1);
    }
  );
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
