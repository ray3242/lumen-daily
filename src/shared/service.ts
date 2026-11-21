import { day, dayIndex, generate, simulate } from './puzzle';
export type Result = {
  taps: number;
  seconds: number;
  states: number[];
  username: string;
};
export type Profile = { streak: number; total: number; last: string };
export type Store = {
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
    const prior = await this.result(user, date);
    const result: Result = {
      states,
      taps,
      seconds: Math.ceil(seconds),
      username,
    };
    if (
      !prior ||
      taps * 100000 + result.seconds < prior.taps * 100000 + prior.seconds
    ) {
      await this.store.set(`result:${date}:${user}`, JSON.stringify(result));
      await this.store.zAdd(`board:${date}`, {
        member: user,
        score: taps * 100000 + result.seconds,
      });
    }
    if (!prior && date === this.today())
      await this.store.set(
        `user:${user}`,
        JSON.stringify(advance(await this.profile(user), date))
      );
    return {
      ...(await this.init(user, username, date)),
      ...(await this.leaderboard(user, date)),
    };
  }
}
export class MemoryStore implements Store {
  values = new Map<string, string>();
  boards = new Map<string, Map<string, number>>();
  async get(k: string) {
    return this.values.get(k);
  }
  async set(k: string, v: string) {
    this.values.set(k, v);
  }
  async zAdd(k: string, m: { member: string; score: number }) {
    const b = this.boards.get(k) ?? new Map();
    b.set(m.member, m.score);
    this.boards.set(k, b);
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
