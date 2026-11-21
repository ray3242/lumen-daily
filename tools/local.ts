import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer } from 'vite';
import { GameService, MemoryStore } from '../src/shared/service';
import { day, generate, solve } from '../src/shared/puzzle';
const api = new Hono();
const store = new MemoryStore();
const game = new GameService(store);
const date = day();
api.onError((e, c) => c.json({ error: e.message }, 400));
api.get('/api/init', async (c) =>
  c.json(await game.init('local', 'you', date))
);
api.get('/api/leaderboard', async (c) =>
  c.json(await game.leaderboard('local', date))
);
api.post('/api/submit', async (c) =>
  c.json(await game.submit('local', 'you', date, await c.req.json()))
);
api.get('/api/local-solution', (c) => c.json(solve(generate(date))));
api.post('/api/local-reset', (c) => {
  store.values.clear();
  store.boards.clear();
  return c.json({ ok: true });
});
for (const action of ['share', 'subscribe', 'flair'])
  api.post('/api/' + action, (c) =>
    c.json({ message: 'Local preview only — no Reddit action was taken.' })
  );
serve({ fetch: api.fetch, port: 3001 });
const vite = await createServer({
  configFile: false,
  root: 'src/client',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
await vite.listen();
console.log('Lumen local preview: http://localhost:5173/game.html');
