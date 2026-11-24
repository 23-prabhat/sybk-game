import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from '../src/server/app.js';
import { previewStore } from '../src/server/store.js';

const user = (name) => ({ id: 'preview-' + name.toLowerCase(), name });
const identity = (c) => {
  const name = c.req.header('X-SYBK-Preview-Player') || 'PipFan';
  return name === 'guest' ? null : user(name);
};
const app = createApp({
  store: previewStore(), preview: true,
  id: (c) => identity(c)?.id,
  user: identity,
  lookup: user,
  adult: (c) => Boolean(identity(c)) && identity(c)?.name !== 'NoAdults'
});
app.use('*', serveStatic({ root: './dist/client' }));
const port = Number(process.env.PORT || 4185);
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => console.log(`SYBK preview at http://127.0.0.1:${port}/splash.html`));
