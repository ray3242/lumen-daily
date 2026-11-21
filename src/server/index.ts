import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import {
  createServer,
  getServerPort,
  context,
  redis,
  reddit,
} from '@devvit/web/server';
import { GameService } from '../shared/service';
import { day, generate } from '../shared/puzzle';
import type { TriggerResponse } from '@devvit/web/shared';
import type { TaskResponse } from '@devvit/web/server';
const app = new Hono();
const game = new GameService(redis);
const isCommentId = (id: string): id is `t1_${string}` => id.startsWith('t1_');
const isPostId = (id: string): id is `t3_${string}` => id.startsWith('t3_');
async function postDate() {
  if (!context.postId) throw new Error('Open a Lumen post to play.');
  const date = await redis.get(`post:${context.postId}`);
  if (!date)
    throw new Error(
      'This post has no puzzle date. Ask a moderator to create a Lumen post.'
    );
  return date;
}
app.onError((e, c) => c.json({ error: e.message }, 400));
app.get('/api/init', async (c) =>
  c.json(
    await game.init(
      context.userId ?? '',
      context.username ?? 'Guest',
      await postDate()
    )
  )
);
app.get('/api/leaderboard', async (c) =>
  c.json(await game.leaderboard(context.userId ?? '', await postDate()))
);
app.post('/api/submit', async (c) =>
  c.json(
    await game.submit(
      context.userId ?? '',
      context.username ?? 'Guest',
      await postDate(),
      await c.req.json()
    )
  )
);
app.post('/api/share', async (c) => {
  if (!context.userId || !context.postId) throw new Error('Sign in to share.');
  const date = await postDate();
  const result = await game.result(context.userId, date);
  if (!result) throw new Error('Solve this puzzle first.');
  const key = `shared:${context.postId}:${context.userId}`;
  if (await redis.get(key))
    return c.json({ message: 'Already shared on this post.' });
  const parent = await redis.get(`thread:${context.postId}`);
  if (!parent || !isCommentId(parent))
    throw new Error('The score thread is unavailable. Try again later.');
  const p = generate(date);
  await reddit.submitComment({
    id: parent,
    runAs: 'USER',
    text: `Lumen #${p.number} · ${date}\n\n${'💠'.repeat(p.crystals.length)}\n\n${result.taps} taps / par ${p.par} · ${result.seconds}s · u/${context.username}\n\nNo routes, no spoilers. See you tomorrow.`,
  });
  await redis.set(key, '1');
  return c.json({ message: 'Result shared in the score thread.' });
});
app.post('/api/flair', async (c) => {
  if (!context.username || !context.userId || !context.subredditName)
    throw new Error('Sign in to set flair.');
  try {
    const p = await game.profile(context.userId);
    await reddit.setUserFlair({
      subredditName: context.subredditName,
      username: context.username,
      text: `Lumen streak ${p.streak}`,
    });
    return c.json({ message: 'Flair updated.' });
  } catch {
    return c.json({ message: 'Flair is not available in this community.' });
  }
});
app.post('/api/subscribe', async (c) => {
  await reddit.subscribeToCurrentSubreddit();
  return c.json({ message: 'Subscribed to this community.' });
});
async function createDaily() {
  const date = day();
  const key = `daily:${date}`;
  const existing = await redis.get(key);
  const p = generate(date);
  const id =
    existing ??
    (
      await reddit.submitCustomPost({
        title: `Lumen #${p.number} — ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`,
        entry: 'default',
        postData: { date },
      })
    ).id;
  await redis.set(`post:${id}`, date);
  await redis.set(key, id);
  if (!(await redis.get(`thread:${id}`)) && isPostId(id)) {
    const post = await reddit.getPostById(id);
    const comment = await post.addComment({
      text: 'Daily score thread. Share your spoiler-free Lumen result here. Please keep solutions out of the comments.',
    });
    await comment.distinguish(true);
    await redis.set(`thread:${id}`, comment.id);
  }
  return id;
}
app.post('/internal/menu/post-create', async (c) => {
  const id = await createDaily();
  return c.json({
    navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${id}`,
  });
});
app.post('/internal/triggers/on-app-install', async (c) => {
  await createDaily();
  return c.json<TriggerResponse>({
    status: 'success',
    message: 'Today’s Lumen is ready.',
  });
});
app.post('/internal/scheduler/daily', async (c) => {
  await createDaily();
  return c.json<TaskResponse>({ status: 'ok' });
});
serve({ fetch: app.fetch, createServer, port: getServerPort() });
