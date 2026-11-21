# Lumen

A daily light-routing puzzle for Reddit Interactive Posts, built with Devvit Web.

Turn mirrors to guide one beam through every crystal. The board changes at midnight UTC. Monday starts with a 6×6 board; the weekend reaches 8×8. Each puzzle has a verified minimum turn count, or **par**.

## How to play

1. Select **Play today’s puzzle**.
2. Tap cyan mirrors to flip between / and \\. The amber beam updates immediately.
3. Light every diamond-shaped crystal. Walls stop the beam.
4. Select **Save your result**. The server checks the route before saving.
5. Compare taps with par, then share a spoiler-free score if you want.

Arrow keys move between mirrors; Enter or Space turns one. Undo counts as a turn. Reset starts a new attempt and timer. Sound is off until enabled. Reduced-motion preferences disable animation.

**Perfect** means par; **Great work** means within two turns; any valid route is a solve. Results are ordered by taps, then seconds. Replays keep your best score. A streak requires solves on consecutive UTC dates, not rolling 24-hour windows. Archive posts retain their own date and leaderboard but do not advance streaks or lifetime daily solves.

## Run without Reddit

Requires Node 22.12+ and npm. No account, login, paid service, API key, or network API is needed to play locally after installation.

```sh
nvm install
nvm use
npm ci
npm run dev:local
# http://localhost:5173/game.html (API on localhost:3001)
```

The harness uses the same generator, simulation, submission validation, scoring, streak and ranking service as production, backed by an in-memory Redis-compatible adapter. State resets when the process restarts. Sharing, flair and subscription are explicitly marked previews and do not contact Reddit. The local-only solution endpoint is available for demo automation; it is not included in the Devvit server.

## Checks

```sh
npm test
npm run type-check
npm run build
npm run lint
npx tsx tools/validate-config.ts # fetches public schema; no login
```

Vitest covers 365 consecutive dates, all board sizes/difficulty levels, exact minimum par by exhaustive search, deterministic generation, non-solved starts, invalid submissions, empty state, ranking, best results, archive play, repeated submissions, UTC/year boundaries and broken streaks.

## Architecture

- `src/shared/puzzle.ts`: date seed, path construction, mirrors/crystals/walls, live beam tracing, loop detection, exhaustive minimum-distance solver.
- `src/shared/service.ts`: API-independent game rules and storage contract; production Redis and local memory share the implementation.
- `src/server/index.ts`: Hono HTTP server using `@devvit/web/server`, Reddit actions and daily post lifecycle.
- `src/client/`: React + TypeScript, SVG board, responsive CSS, generated WebAudio notes, no external assets or fonts.
- `tools/local.ts`: Vite browser harness plus Hono mock API.
- `tests/`: Vitest suite.
- `docs/`: submission copy and demo shot list.

Started from the official [reddit/devvit-template-react](https://github.com/reddit/devvit-template-react) template (Devvit 0.15.4). The current template uses Hono, an Express-style HTTP router. Communication uses small JSON endpoints with shared rules and types under `src/shared`.

### Puzzle construction and calibration

A seeded PRNG traces a self-avoiding route, inserts turns, places 2–5 crystals along it, and adds walls only outside it. Mirror states are scrambled; solved starts are discarded. All mirror configurations (at most 512) are checked to find the actual minimum taps, including alternative solutions. Difficulty raises grid size, crystal count and minimum mirror count across the week. This is algorithmic calibration, not a claim of player-tested difficulty.

### Trust model and limits

The server derives the date from the post, identifies the player from Devvit context and re-simulates final states. It checks binary states, state count and sensible tap/time bounds; it does not trust a client-supplied solved flag. As with many lightweight puzzle games, timing and the claimed tap count above the final-state lower bound are client-reported, not an anti-cheat replay protocol. Score saves use Redis WATCH/MULTI to compare the best result and update the leaderboard and profile together. Conflicts retry with fresh state; repeat saves repair incomplete older writes without counting a daily solve twice. Live Redis behavior and launch-scale traffic still need platform testing.

## Reddit integrations

- Moderator menu: **Create today's Lumen post**.
- Install trigger creates the first puzzle; configured cron creates one daily at **00:00 UTC**.
- Date is saved in post data and Redis. Sequential create requests reuse the existing daily post.
- Per-user daily bests, daily Redis sorted-set leaderboard, streak and total solves.
- Explicit **Share as a comment** action uses `runAs: 'USER'`, replies to a single stickied score thread and suppresses repeated shares on that post.
- Separate opt-in subscription and streak flair buttons. Flair failures are non-fatal. No reward or gameplay depends on these actions.
- Guest play is available; sign-in is required to save or share.

User actions require Reddit approval. In unapproved playtests, comments may be attributed to the app rather than the player (except the app owner). Moderator permissions/community flair settings can prevent score-thread pinning or flair updates. No Reddit login or remote calls have been tested here.

## Upload and playtest (owner)

The app name `lumen-daily` is under the 16-character limit but availability is not verified. Rename it in `devvit.json` if Reddit reports a conflict.

```sh
npx devvit login
npm run deploy
npx devvit playtest YOUR_TEST_SUBREDDIT
```

Use a test subreddit you moderate. Installation should create a post. If needed use the subreddit moderator menu to create today's post. Verify the inline 512px experience, old-post dates, signed-out play, score saves, rank updates, comment attribution/thread, flair opt-in, subscription consent, and the midnight scheduled job. CLI upload may prompt for initial app registration and terms acceptance. Only publish after checking these flows and Reddit's review requirements.

## Dependencies and license

All tools and assets used are free. Lumen's original code is MIT licensed; third-party packages retain their own licenses. The official template remains BSD-3-Clause; see `docs/TEMPLATE_LICENSE`. The pinned official Devvit CLI currently brings npm audit advisories in CLI dependencies (including isomorphic-git and tmp); do not treat the local toolchain as an untrusted repository import service. Review upstream updates before publishing.
