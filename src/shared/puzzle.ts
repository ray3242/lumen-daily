export type Point = { x: number; y: number };
export type Mirror = Point & { initial: number };
export type Puzzle = {
  date: string;
  number: number;
  size: number;
  difficulty: string;
  source: Point;
  mirrors: Mirror[];
  crystals: Point[];
  walls: Point[];
  par: number;
};
export const day = (now = new Date()) => now.toISOString().slice(0, 10);
export const dayIndex = (date: string) =>
  Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export function simulate(p: Puzzle, states: number[]) {
  let x = p.source.x,
    y = p.source.y,
    dx = 1,
    dy = 0;
  const points: Point[] = [{ x: x - 1, y }];
  const lit = new Set<number>();
  const seen = new Set<string>();
  while (x >= 0 && y >= 0 && x < p.size && y < p.size) {
    const key = `${x},${y},${dx},${dy}`;
    if (seen.has(key)) break;
    seen.add(key);
    points.push({ x, y });
    if (p.walls.some((w) => same(w, { x, y }))) break;
    p.crystals.forEach((c, i) => {
      if (same(c, { x, y })) lit.add(i);
    });
    const m = p.mirrors.findIndex((m) => same(m, { x, y }));
    if (m >= 0) [dx, dy] = states[m] === 0 ? [-dy, -dx] : [dy, dx];
    x += dx;
    y += dy;
  }
  points.push({ x, y });
  return { points, lit: [...lit], solved: lit.size === p.crystals.length };
}
export function solve(p: Puzzle) {
  let best: number[] = [],
    distance = Infinity;
  for (let bits = 0; bits < 2 ** p.mirrors.length; bits++) {
    const states = p.mirrors.map((_, i) => (bits >> i) & 1);
    const taps = states.filter((s, i) => s !== p.mirrors[i]!.initial).length;
    if (taps < distance && simulate(p, states).solved) {
      distance = taps;
      best = states;
    }
  }
  return { states: best, par: distance };
}
export function generate(date: string): Puzzle {
  let seed =
    [...date].reduce(
      (s, c) => Math.imul(s ^ c.charCodeAt(0), 16777619),
      2166136261
    ) >>> 0;
  const random = () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const weekday = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const size = weekday < 2 ? 6 : weekday < 5 ? 7 : 8;
  const count = 2 + Math.floor(weekday / 2);
  for (;;) {
    const source = { x: 0, y: Math.floor(random() * size) };
    const path: Point[] = [];
    const mirrors: Mirror[] = [];
    let pos = source,
      dx = 1,
      dy = 0;
    while (
      pos.x >= 0 &&
      pos.y >= 0 &&
      pos.x < size &&
      pos.y < size &&
      !path.some((c) => same(c, pos))
    ) {
      path.push(pos);
      if (path.length > 1 && random() < 0.35 && mirrors.length < 9) {
        const initial = random() < 0.5 ? 0 : 1;
        mirrors.push({ ...pos, initial });
        [dx, dy] = initial === 0 ? [-dy, -dx] : [dy, dx];
      }
      pos = { x: pos.x + dx, y: pos.y + dy };
    }
    if (mirrors.length < 3 + Math.floor(weekday / 2) || path.length < size * 2)
      continue;
    const available = path.filter(
      (c) => !mirrors.some((m) => same(m, c)) && !same(c, source)
    );
    if (available.length < count) continue;
    const crystals = Array.from(
      { length: count },
      (_, i) => available[Math.floor(((i + 0.5) * available.length) / count)]!
    );
    const walls: Point[] = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!path.some((c) => same(c, { x, y })) && random() < 0.16)
          walls.push({ x, y });
    mirrors.forEach((m) => {
      if (random() < 0.65) m.initial = 1 - m.initial;
    });
    const puzzle: Puzzle = {
      date,
      number: dayIndex(date) - dayIndex('2025-01-01') + 1,
      size,
      difficulty: [
        'Gentle',
        'Gentle',
        'Steady',
        'Steady',
        'Tricky',
        'Hard',
        'Expert',
      ][weekday]!,
      source,
      mirrors,
      crystals,
      walls,
      par: 0,
    };
    if (
      simulate(
        puzzle,
        mirrors.map((m) => m.initial)
      ).solved
    )
      continue;
    puzzle.par = solve(puzzle).par;
    if (Number.isFinite(puzzle.par)) return puzzle;
  }
}
