import { day, dayIndex, generate, simulate } from './puzzle';
export type Result = {
  taps: number;
  seconds: number;
  states: number[];
  username: string;
};
export type Profile = { streak: number; total: number; last: string };
export type Transaction = {
  multi(): Promise<void>;
  set(key: string, value: string): Promise<unknown>;
  zAdd(
    key: string,
    member: { member: string; score: number }
  ): Promise<unknown>;
  exec(): Promise<unknown[]>;
  discard(): Promise<void>;
};
export type Store = {
  watch(...keys: string[]): Promise<Transaction>;
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
  zAdd(
    key: string,
    member: { member: string; score: number }
  ): Promise<unknown>;
  zRange(
    key: string,
    start: number,
    stop: number
  ): Promise<{ member: string; score: number }[]>;
  zRank(key: string, member: string): Promise<number | undefined>;
};
export const emptyProfile = (): Profile => ({ streak: 0, total: 0, last: '' });
export function advance(profile: Profile, date: string): Profile {
  if (profile.last >= date) return profile;
  return {
    last: date,
    total: profile.total + 1,
    streak:
      dayIndex(date) - dayIndex(profile.last) === 1 ? profile.streak + 1 : 1,
  };
}
export class GameService {
  constructor(
    private store: Store,
    private today = day
  ) {}
  async profile(user: string): Promise<Profile> {
    return JSON.parse(
      (await this.store.get(`user:${user}`)) ?? JSON.stringify(emptyProfile())
    );
  }
  async result(user: string, date: string): Promise<Result | null> {
    return JSON.parse(
      (await this.store.get(`result:${date}:${user}`)) ?? 'null'
    );
  }
  async init(user: string, username: string, date: string) {
    const profile = await this.profile(user);
    if (dayIndex(this.today()) - dayIndex(profile.last) > 1) profile.streak = 0;
    return {
      puzzle: generate(date),
      profile,
      result: await this.result(user, date),
      username,
      archive: date !== this.today(),
    };
  }
  async leaderboard(user: string, date: string) {
    const rows = await this.store.zRange(`board:${date}`, 0, 9);
    const top = await Promise.all(
      rows.map(async (r, i) => ({
        rank: i + 1,
        ...(await this.result(r.member, date)),
      }))
    );
    const rank = await this.store.zRank(`board:${date}`, user);
    return { top, rank: rank === undefined ? null : rank + 1 };
  }
  async submit(user: string, username: string, date: string, input: unknown) {
    if (!user) throw new Error('Sign in to save your result.');
    if (
      !input ||
      typeof input !== 'object' ||
      !('states' in input) ||
      !('taps' in input) ||
      !('seconds' in input)
    )
      throw new Error('Invalid submission');
    const { states, taps, seconds } = input;
    const p = generate(date);
    if (
      !Array.isArray(states) ||
      states.length !== p.mirrors.length ||
      !states.every((s) => s === 0 || s === 1) ||
      typeof taps !== 'number' ||
      !Number.isInteger(taps) ||
      taps < states.filter((s, i) => s !== p.mirrors[i]!.initial).length ||
      taps > 100000 ||
      typeof seconds !== 'number' ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds >= 86400
    )
      throw new Error('Invalid submission');
    if (!simulate(p, states).solved)
      throw new Error('Light every crystal before submitting.');
    const result: Result = {
      states,
      taps,
      seconds: Math.ceil(seconds),
      username,
    };
    await this.save(user, date, result);
    return {
      ...(await this.init(user, username, date)),
      ...(await this.leaderboard(user, date)),
    };
  }
  private async save(user: string, date: string, result: Result) {
    const resultKey = `result:${date}:${user}`;
    const profileKey = `user:${user}`;
    const countsForStreak = date === this.today();
    for (let attempt = 0; attempt < 5; attempt++) {
      const transaction = await this.store.watch(resultKey, profileKey);
      try {
        const prior = await this.result(user, date);
        const profile = await this.profile(user);
        const score = (r: Result) => r.taps * 100000 + r.seconds;
        const best = prior && score(prior) <= score(result) ? prior : result;
        await transaction.multi();
        await transaction.set(resultKey, JSON.stringify(best));
        await transaction.zAdd(`board:${date}`, {
          member: user,
          score: score(best),
        });
        if (countsForStreak)
          await transaction.set(
            profileKey,
            JSON.stringify(advance(profile, date))
          );
        const replies = await transaction.exec();
        if (replies.length === (countsForStreak ? 3 : 2)) return;
      } catch (error) {
        await transaction.discard().catch(() => undefined);
        if (
          !(error instanceof Error) ||
          !/watched|\bwatch\b|\baborted\b|transaction.*conflict/i.test(
            error.message
          )
        )
          throw error;
      }
    }
    throw new Error('Your score changed in another tab. Please save again.');
  }
}
export class MemoryStore implements Store {
  values = new Map<string, string>();
  boards = new Map<string, Map<string, number>>();
  private versions = new Map<string, number>();
  async watch(...keys: string[]): Promise<Transaction> {
    const snapshot = keys.map((key) => this.versions.get(key) ?? 0);
    const commands: (() => void)[] = [];
    let started = false;
    const queue = (command: () => void) => {
      if (!started) throw new Error('Call multi before queuing writes.');
      commands.push(command);
    };
    return {
      multi: async () => {
        started = true;
      },
      set: async (key, value) => {
        queue(() => this.writeValue(key, value));
      },
      zAdd: async (key, member) => {
        queue(() => this.writeScore(key, member));
      },
      discard: async () => {
        commands.length = 0;
      },
      exec: async () => {
        if (
          keys.some((key, i) => (this.versions.get(key) ?? 0) !== snapshot[i])
        )
          return [];
        commands.forEach((command) => command());
        return commands.map(() => 'OK');
      },
    };
  }
  private touch(key: string) {
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }
  private writeValue(k: string, v: string) {
    this.values.set(k, v);
    this.touch(k);
  }
  private writeScore(k: string, m: { member: string; score: number }) {
    const b = this.boards.get(k) ?? new Map();
    b.set(m.member, m.score);
    this.boards.set(k, b);
    this.touch(k);
  }
  async get(k: string) {
    return this.values.get(k);
  }
  async set(k: string, v: string) {
    this.writeValue(k, v);
  }
  async zAdd(k: string, m: { member: string; score: number }) {
    this.writeScore(k, m);
  }
  async zRange(k: string, start: number, stop: number) {
    return [...(this.boards.get(k) ?? [])]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member))
      .slice(start, stop + 1);
  }
  async zRank(k: string, m: string) {
    const rows = await this.zRange(k, 0, Infinity);
    const i = rows.findIndex((r) => r.member === m);
    return i < 0 ? undefined : i;
  }
}
