import { serve } from '@hono/node-server';
import { context, createServer, getServerPort, realtime, reddit, redis } from '@devvit/web/server';
import type { Context } from 'hono';
import { createApp } from './app.js';
import { THEMES, dailyPack, today } from './content.js';
import { redisStore } from './store.js';

const store = redisStore(redis);

async function themeForDate(date: string) {
  const votes = await store.leaderboard('theme:' + date, null);
  const winner = votes.rows[0];
  return winner && winner.score > 0 && Object.hasOwn(THEMES, winner.member) ? winner.member : '';
}

const app = createApp({
  store,
  id: () => context.userId,
  postDate: () => context.postData?.date,
  postTheme: (_request, date: string) => context.postData?.hub === true ? themeForDate(date) : context.postData?.theme,
  postPack: () => context.postData?.cards,
  user: async () => {
    const user = await reddit.getCurrentUser();
    return user ? { id: user.id, name: user.username } : null;
  },
  lookup: async (username: string) => {
    const user = await reddit.getUserByUsername(username);
    return user ? { id: user.id, name: user.username } : null;
  },
  adult: async () => (await reddit.getCurrentUser())?.showNsfw === true,
  broadcast: (channel: string, data: { revision: number }) => realtime.send(channel, data)
});

async function ensureGamePost(hub = false) {
  const date = today();
  const key = hub ? 'hub-post' : 'daily-post:' + date;
  const stored = await redis.get(key);
  if (stored) return stored;
  const lock = key + ':lock';
  const lease = await redis.set(lock, 'creating', { nx: true, expiration: new Date(Date.now() + 120_000) });
  if (!lease) return await redis.get(key);
  let previous;
  let posted = false;
  let recorded = false;
  try {
    const subredditName = context.subredditName ?? (await reddit.getCurrentSubreddit()).name;
    const title = hub ? 'SYBK · Play today’s meme drop' : `SYBK · Daily Meme Drop · ${date}`;
    const recent = await reddit.getNewPosts({ subredditName, limit: 25 }).all();
    for (const candidate of recent.filter((post) => post.title === title)) {
      const data = await candidate.getPostData().catch(() => undefined);
      if (data?.sybk === true && (hub ? data.hub === true : data.date === date)) {
        previous = candidate;
        break;
      }
    }
    const theme = hub ? '' : await themeForDate(date);
    const postData = hub ? { sybk: true, hub: true } : { date, sybk: true, theme, cards: dailyPack(date, false, theme) };
    const post = previous ?? await reddit.submitCustomPost({ subredditName, title, entry: 'default', postData });
    posted = true;
    await redis.set(key, post.url);
    recorded = true;
    return post.url;
  } finally {
    if (!posted || recorded) await redis.del(lock);
  }
}

async function openGamePost(c: Context, hub: boolean) {
  try {
    const url = await ensureGamePost(hub);
    return c.json(url ? { navigateTo: url } : { showToast: 'The game post is being created.' });
  } catch (error) {
    console.error('SYBK could not create the daily post', error);
    return c.json({ showToast: 'Could not create the daily post. Try again shortly.' });
  }
}

app.post('/internal/menu/daily', (c) => openGamePost(c, false));
app.post('/internal/menu/hub', (c) => openGamePost(c, true));
app.post('/internal/menu/reports', async (c) => {
  const reports = await store.read('reports:' + today());
  const latest = (reports ?? []).slice(-4);
  return c.json({ showToast: latest.length
    ? latest.map((report) => report.question + ' · ' + report.reason).join(' | ')
    : 'No clue reports today.' });
});
app.post('/internal/scheduler/daily', async (c) => {
  await ensureGamePost();
  return c.json({});
});

serve({ fetch: app.fetch, createServer, port: getServerPort() });
