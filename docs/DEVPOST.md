# Lumen — a daily light puzzle

## Project links

- App listing: https://developers.reddit.com/apps/lumen-daily
- Demo post: `<DEMO_POST_URL>`
- Test subreddit: `<SUBREDDIT_URL>`
- Video: `<YOUTUBE_URL>`
- Repo: https://github.com/ray3242/lumen-daily

## Inspiration

I wanted a daily puzzle that would work inside a Reddit post without a tutorial screen. A moving beam makes the rules visible: turn a mirror and see what changes.

## What it does

Lumen gives a community the same light-routing puzzle each UTC day. Players turn mirrors until one beam passes through every crystal. A live board shows which crystals are lit. The result card compares turns with the minimum, records time and streak, and shows the daily leaders.

The week starts with smaller boards and ends with more crystals and mirrors. Old posts keep their own puzzles. Sharing is optional and spoiler-free.

## How we built it

I started with Reddit's official React Devvit Web template. React renders the interface and SVG optics; a Hono server handles Reddit context, Redis and platform actions. A shared TypeScript service drives both the Reddit backend and a browser-only development harness.

The generator constructs a route before scrambling it. An exhaustive solver checks every mirror configuration and computes minimum taps, including shorter alternative routes. The server simulates the submitted board again before accepting it.

Devvit's scheduler creates a post at midnight UTC. The install trigger and moderator menu provide the same creation path. Scores use a Redis sorted set ordered by taps and then time. Comment sharing replies to one pinned score thread; flair and community subscription are separate actions.

## Challenges

A constructed route is not necessarily the shortest solution. Computing par from only the construction would overstate it on some boards, so I used exhaustive search on a bounded number of mirrors.

The other constraint was space. The interface needs to fit a mobile inline post, not just a desktop browser. The board, controls and result card share a compact layout. The first hint disappears after the first turn.

## Accomplishments

The game runs without a Reddit login for development. The same rules validate local and production submissions. Tests check a full year of puzzles and cover UTC streak boundaries and invalid submissions. Sound is synthesized locally, off by default, with no audio assets.

## What we learned

The beam is the most useful explanation. Players should be able to try a move before reading instructions. I also learned to separate a valid final board from competitive score integrity: final-state validation does not prove a client-reported timer or move history.

## What's next

I want to tune the weekday difficulty curve from real play: where people pause, how often they reset, and how close they finish to par. A move-replay protocol would make competitive rankings harder to manipulate. Weekly board themes and a browsable archive would give regular players more ways to return without changing the daily rules.

## Built with

Devvit Web, React, TypeScript, Vite, Hono, Redis, SVG, WebAudio, Vitest and Playwright. Free tools only.

## Testing instructions for judges

1. Open the demo post: `<DEMO_POST_URL>` in the public test subreddit: `<SUBREDDIT_URL>`.
2. Select **Play today’s puzzle**. Tap cyan mirrors to turn them and guide the amber beam through every crystal. No installation is needed to play the post.
3. When every crystal glows, select **Save your result** to see taps against par, elapsed time, streak and rank. Sign in to Reddit to save a score.
4. Try undo, reset, the sound toggle, or arrow keys and Enter/Space. Sharing a spoiler-free comment is a separate, optional action; it is never required to keep playing.

### Local alternative

Install Node 22.12+, clone the repository, run `npm ci` and `npm run dev:local`, then open http://localhost:5173/game.html. The same puzzle and validation rules run locally. Sharing, flair and subscription are labeled previews and do not contact Reddit. To check the code, run `npm test`, `npm run type-check` and `npm run build`.
