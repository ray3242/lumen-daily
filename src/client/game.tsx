import './index.css';
import './compact.css';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { simulate } from '../shared/puzzle';
import type { Puzzle } from '../shared/puzzle';
import type { Profile, Result } from '../shared/service';
type Init = {
  puzzle: Puzzle;
  profile: Profile;
  result: Result | null;
  username: string;
  archive: boolean;
};
type Board = { top: (Result & { rank: number })[]; rank: number | null };
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Please try again.');
  return data;
}
const clock = (s: number) =>
  Math.floor(s / 60)
    .toString()
    .padStart(2, '0') +
  ':' +
  (s % 60).toString().padStart(2, '0');
export function Mark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M5 35H19L32 12V35H43"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="m32 5 5 7-5 7-5-7Z" fill="currentColor" />
    </svg>
  );
}
export function App() {
  const [data, setData] = useState<Init>();
  const [states, setStates] = useState<number[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [taps, setTaps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<'start' | 'play' | 'result'>('start');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [board, setBoard] = useState<Board>({ top: [], rank: null });
  const [hint, setHint] = useState(!localStorage.getItem('lumen-played'));
  const [remaining, setRemaining] = useState(0);
  const started = useRef(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    api<Init>('init')
      .then((d) => {
        setData(d);
        setStates(d.puzzle.mirrors.map((m) => m.initial));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (phase === 'play')
        setSeconds(Math.floor((Date.now() - started.current) / 1000));
      setRemaining(
        Math.max(
          0,
          Math.floor((new Date().setUTCHours(24, 0, 0, 0) - Date.now()) / 1000)
        )
      );
    }, 250);
    return () => clearInterval(id);
  }, [phase]);
  function tone(solved = false) {
    if (muted) return;
    try {
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      void ctx.resume();
      [0, ...(solved ? [1, 2] : [])].forEach((i) => {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = [440, 554, 659][i]!;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(
          0.06,
          ctx.currentTime + 0.015 + i * 0.08
        );
        g.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + 0.25 + i * 0.08
        );
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.5);
      });
    } catch {
      /* Audio is optional. */
    }
  }
  function start() {
    if (!data) return;
    if (data.result) {
      setPhase('result');
      api<Board>('leaderboard')
        .then(setBoard)
        .catch((e) => setError(e.message));
      return;
    }
    started.current = Date.now();
    setPhase('play');
  }
  function rotate(i: number) {
    if (phase !== 'play' || busy) return;
    tone();
    setStates((s) => s.map((v, j) => (j === i ? 1 - v : v)));
    setHistory((h) => [...h, i]);
    setTaps((t) => t + 1);
    setHint(false);
    localStorage.setItem('lumen-played', '1');
    setError('');
  }
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const result = await api<Init & Board>('submit', {
        states,
        taps,
        seconds,
      });
      setData(result);
      setBoard(result);
      setPhase('result');
      tone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function action(name: string) {
    setBusy(true);
    try {
      const r = await api<{ message: string }>(name, {});
      setNotice(r.message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="loading">
        <Mark />
        <h1>Lumen</h1>
        <p role="status">{error || 'Loading today’s puzzle…'}</p>
        {error && (
          <button
            onClick={() => {
              setError('');
              api<Init>('init')
                .then((d) => {
                  setData(d);
                  setStates(d.puzzle.mirrors.map((m) => m.initial));
                })
                .catch((e) => setError(e.message));
            }}
          >
            Try again
          </button>
        )}
      </main>
    );
  const p = data.puzzle,
    beam = simulate(p, states),
    result = data.result;
  const dateLabel = new Date(p.date + 'T00:00:00Z').toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric', timeZone: 'UTC' }
  );
  function keyMove(e: KeyboardEvent, i: number) {
    let n: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      n = (i + 1) % p.mirrors.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      n = (i + p.mirrors.length - 1) % p.mirrors.length;
    else return;
    e.preventDefault();
    buttons.current[n]?.focus();
  }
  const puzzleView = (
    <div className={'board ' + (beam.solved ? 'complete' : '')}>
      <svg
        className="optics"
        viewBox={`-0.65 -0.65 ${p.size + 0.3} ${p.size + 0.3}`}
        aria-label={`${beam.lit.length} of ${p.crystals.length} crystals lit`}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation=".1" />
          </filter>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path
              d="M-.5 .5H.5V-.5"
              fill="none"
              stroke="#294050"
              strokeWidth=".015"
            />
          </pattern>
        </defs>
        <rect
          x="-.5"
          y="-.5"
          width={p.size}
          height={p.size}
          fill="url(#grid)"
        />
        {p.walls.map((w) => (
          <rect
            key={w.x + ',' + w.y}
            x={w.x - 0.32}
            y={w.y - 0.32}
            width=".64"
            height=".64"
            rx=".09"
            fill="#263945"
            stroke="#3a505b"
            strokeWidth=".02"
          />
        ))}
        <polyline
          key={states.join('') + 'glow'}
          points={beam.points.map((v) => v.x + ',' + v.y).join(' ')}
          fill="none"
          stroke="#f5bf6c"
          strokeWidth=".15"
          filter="url(#glow)"
          opacity=".8"
        />
        <polyline
          key={states.join('')}
          className="beam"
          points={beam.points.map((v) => v.x + ',' + v.y).join(' ')}
          fill="none"
          stroke="#ffdc9b"
          strokeWidth=".045"
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength="1"
        />
        {p.crystals.map((c, i) => (
          <g
            key={i}
            transform={`translate(${c.x},${c.y})`}
            className={beam.lit.includes(i) ? 'crystal lit' : 'crystal'}
          >
            <path d="M0 -.23 .19 0 0 .23 -.19 0Z" strokeWidth=".035" />
            <path d="M0 -.23V.23M-.19 0H.19" fill="none" strokeWidth=".018" />
          </g>
        ))}
        <circle cx={-0.48} cy={p.source.y} r=".13" fill="#ffdc9b" />
      </svg>
      <div className="mirror-layer">
        {p.mirrors.map((m, i) => (
          <button
            ref={(el) => {
              buttons.current[i] = el;
            }}
            key={i}
            className="mirror"
            data-mirror={i}
            disabled={phase !== 'play' || busy}
            aria-label={`Mirror row ${m.y + 1}, column ${m.x + 1}, ${states[i] === 0 ? 'slash' : 'backslash'}. Rotate`}
            style={{
              left: `${((m.x + 0.65) / (p.size + 0.3)) * 100}%`,
              top: `${((m.y + 0.65) / (p.size + 0.3)) * 100}%`,
              width: `${100 / (p.size + 0.3)}%`,
              height: `${100 / (p.size + 0.3)}%`,
            }}
            onKeyDown={(e) => keyMove(e, i)}
            onClick={() => rotate(i)}
          >
            <span
              style={{ transform: `rotate(${states[i] === 0 ? -45 : 45}deg)` }}
            />
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <main className={'shell ' + phase}>
      <header>
        <a className="brand" href="#main" aria-label="Lumen">
          <Mark />
          <span>Lumen</span>
        </a>
        <button
          className="sound"
          aria-label={muted ? 'Turn sound on' : 'Mute sound'}
          aria-pressed={!muted}
          onClick={() => setMuted(!muted)}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </header>
      <section id="main" className="content">
        {phase === 'start' ? (
          <>
            <div className="intro">
              <div className="edition">Daily light puzzle · #{p.number}</div>
              <h1>
                One beam.
                <br />
                Every crystal.
              </h1>
              <p>Turn mirrors to connect them.</p>
            </div>
            <div className="preview">{puzzleView}</div>
            <div className="start-bottom">
              <div className="daily-meta">
                <span>
                  {dateLabel} <b>·</b> {p.difficulty}
                </span>
                <span>{data.profile.streak} day streak</span>
              </div>
              <button className="primary" onClick={start}>
                {result ? 'View your result' : 'Play today’s puzzle'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
              <p className="footnote">
                {data.archive
                  ? 'Archive puzzle · streaks are unchanged'
                  : 'One puzzle each day. A fresh start at midnight UTC.'}
              </p>
            </div>
          </>
        ) : phase === 'play' ? (
          <>
            <div className="play-heading">
              <div>
                <div className="edition">
                  #{p.number} · {p.difficulty}
                  {data.archive ? ' · Archive' : ''}
                </div>
                <h1>Follow the light.</h1>
              </div>
              <div className="time" aria-label={seconds + ' seconds'}>
                {clock(seconds)}
              </div>
            </div>
            <div className="hud">
              <span>
                <strong>{taps}</strong> {taps === 1 ? 'tap' : 'taps'}{' '}
                <span className="dim">/ par {p.par}</span>
              </span>
              <span className="crystal-count">
                {beam.lit.length} / {p.crystals.length} crystals
              </span>
            </div>
            {puzzleView}
            <div className="below-board">
              <p className="hint" role="status">
                {beam.solved
                  ? 'All crystals lit. Keep this route.'
                  : hint
                    ? 'Tap a mirror to turn it.'
                    : 'Light every crystal with the fewest turns.'}
              </p>
              <div className="controls">
                <button
                  disabled={!history.length || busy}
                  onClick={() => {
                    const i = history[history.length - 1]!;
                    setStates((s) => s.map((v, j) => (j === i ? 1 - v : v)));
                    setHistory((h) => h.slice(0, -1));
                    setTaps((t) => t + 1);
                  }}
                >
                  ↶ Undo
                </button>
                <button
                  disabled={!taps || busy}
                  onClick={() => {
                    setStates(p.mirrors.map((m) => m.initial));
                    setHistory([]);
                    setTaps(0);
                    started.current = Date.now();
                    setSeconds(0);
                  }}
                >
                  Reset
                </button>
              </div>
              <button
                className="primary save"
                disabled={!beam.solved || busy}
                onClick={() => void submit()}
              >
                {busy
                  ? 'Saving…'
                  : beam.solved
                    ? 'Save your result'
                    : 'Find the route'}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </>
        ) : (
          <div className="result-card">
            <div className="solve-mark">
              <Mark />
            </div>
            <div className="edition">
              Lumen #{p.number} · {dateLabel}
            </div>
            <h1>
              {result && result.taps === p.par
                ? 'Perfect.'
                : result && result.taps <= p.par + 2
                  ? 'Great work.'
                  : 'All lit.'}
            </h1>
            <p className="result-sub">Every crystal, connected.</p>
            <div className="stats">
              <div>
                <strong>
                  {result?.taps}
                  <small> / {p.par}</small>
                </strong>
                <span>Taps / par</span>
              </div>
              <div>
                <strong>{clock(result?.seconds ?? 0)}</strong>
                <span>Time</span>
              </div>
              <div>
                <strong>
                  {data.profile.streak}
                  <small> {data.profile.streak === 1 ? 'day' : 'days'}</small>
                </strong>
                <span>Streak</span>
              </div>
            </div>
            <div className="result-meta">
              <span>
                {data.profile.total} total{' '}
                {data.profile.total === 1 ? 'solve' : 'solves'}
                {data.archive ? ' · Archive' : ''}
              </span>
              <span>{board.rank ? 'Rank #' + board.rank : 'Unranked'}</span>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void action('share')}
            >
              Share as a comment <span aria-hidden="true">↗</span>
            </button>
            <p className="footnote">
              Posts your spoiler-free score in the score thread.
            </p>
            <div className="leaderboard">
              <div className="list-title">
                <strong>Daily leaderboard</strong>
                <span>Top 3</span>
              </div>
              {board.top.length ? (
                board.top.slice(0, 3).map((r) => (
                  <div className="leader-row" key={r.rank}>
                    <span className="rank">
                      {r.rank.toString().padStart(2, '0')}
                    </span>
                    <span>{r.username}</span>
                    <span>
                      {r.taps} taps <b>·</b> {clock(r.seconds)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="footnote">Be the first to light the way.</p>
              )}
            </div>
            <div className="next">
              <span>Next puzzle in</span>
              <strong>
                {Math.floor(remaining / 3600)
                  .toString()
                  .padStart(2, '0')}
                :{clock(remaining % 3600)}
              </strong>
            </div>
            <div className="result-actions">
              <button disabled={busy} onClick={() => void action('subscribe')}>
                Subscribe to community
              </button>
              <button disabled={busy} onClick={() => void action('flair')}>
                Set streak flair
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="message" role="status">
            {notice}
          </p>
        )}
      </section>
      <footer>
        <span>A new puzzle every day</span>
        <span>#{p.number}</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
