You are writing a Devvit web application that will be executed on Reddit.com.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, plain CSS and SVG. Styles live in `src/client/index.css`, `tokens.css` and `compact.css`.
- **Backend**: Node.js 22 serverless environment (Devvit), Hono.
- **Communication**: Plain `fetch` requests to JSON `/api/*` endpoints. Shared rules and types live in `src/shared`; there is no tRPC router.

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `index.ts`: Main Hono app, JSON API, daily post creation, moderator menu, install trigger and scheduled job.
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - To add an entrypoint, create a HTML file and add to the mapping inside of `devvit.json`
  - Entrypoints:
    - `game.html`: The React entry point for both inline and expanded play. Keep the start screen usable at 360×512.
  - `game.tsx`: Game screens, interactions and JSON API calls.
- `/src/shared`: **Shared Code** used by the client, server and local harness.
  - `puzzle.ts`: Deterministic generation, beam simulation, solver and puzzle types.
  - `service.ts`: Submission validation, best results, streaks, leaderboard and storage interfaces. Production uses Redis WATCH/MULTI; `MemoryStore` emulates transactions for local use.
- `/tools/local.ts`: Browser harness with the same `GameService` and in-memory storage. Local-only reset and solution endpoints must not be exposed in production.
- `/tests/puzzle.test.ts`: Generator, validation, persistence and streak tests.

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run type-check`: Check typescript types
- `npm run lint`: Check the linter
- `npm test`: Run the Vitest suite
- `npm run test -- my-file-name`: Run tests isolated to a file
- `npm run build`: Build the client and server
- `npm run dev:local`: Start the browser harness at `http://localhost:5173/game.html` (API on 3001), without Reddit login
- `npm run validate:config`: Validate against the official Devvit schema (requires network, not login)

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports
- Never cast typescript types

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
