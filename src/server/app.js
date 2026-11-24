import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { THEMES, dailyPack, questionFor, today, upcomingSaturday, weekStart } from './content.js';
import { admit, advanceRoom, newRoom, newSolo, roomAction, roomIdleMs, roomView, soloAction, soloView } from './game.js';
import { change, set } from './store.js';

const day = 86_400_000;
const codePattern = /^[A-F0-9]{10}$/;
const makeCode = () => randomBytes(5).toString('hex').toUpperCase();
const soloKey = (date, mature, user) => `solo:${date}:${mature ? 'dark' : 'daily'}:${user}`;
const activeKey = (id) => 'active:' + id;
const profileKey = (id) => 'profile:' + id;
const roomKey = (code) => 'room:' + code;
const queueKey = (mature) => 'queue:' + (mature ? 'dark' : 'daily');
const dayRank = (date) => 'rank:' + date;
const weekRank = (date) => 'week:' + weekStart(date);
const channel = (code) => 'sybk-' + code;
const relCode = (value) => typeof value === 'string' ? value.trim().toUpperCase() : '';

export function createApp(platform) {
  const app = new Hono();
  const { store } = platform;
  const now = () => platform.now?.() ?? Date.now();
  const json = (c) => c.req.json().catch(() => null);
  const problem = (c, status, error) => c.json({ error }, status);
  const dateFor = (c) => {
    const date = platform.postDate?.(c);
    return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && date <= today(now())
      ? date : today(now());
  };

  app.onError((error, c) => {
    console.error('SYBK request failed', c.req.method, c.req.path, error.message);
    return problem(c, 503, 'The stage is having a moment. Try again.');
  });
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });

  async function canUseMature(c, body) {
    return body?.confirm === true && Boolean(await platform.adult(c));
  }

  app.get('/api/bootstrap', async (c) => {
    const id = platform.id(c);
    const date = dateFor(c);
    const progress = id ? await store.read(soloKey(date, false, id)) : null;
    return c.json({
      date, ranked: Boolean(id) && date === today(now()), archived: date !== today(now()),
      signedIn: Boolean(id), preview: platform.preview ?? false,
      progress: progress ? soloView(progress) : null
    });
  });

  app.post('/api/solo', async (c) => {
    const body = await json(c);
    if (!body || !['start', 'answer', 'hint', 'trade', 'skip', 'next'].includes(body.type)) return problem(c, 400, 'Choose an action.');
    if (body.answer != null && typeof body.answer !== 'object') return problem(c, 400, 'Choose an answer.');
    const mature = body.mature === true;
    if (mature && !await canUseMature(c, body)) return problem(c, 403, 'After Dark requires a Reddit account with 18+ content enabled and your consent.');
    const date = dateFor(c);
    if (body.date !== undefined && body.date !== date) return problem(c, 409, 'A new meme drop is ready. Reopen the game to play it.');
    const theme = await platform.postTheme?.(c, date);
    const pinned = platform.postPack?.(c);
    const id = platform.id(c);
    const ranked = Boolean(id) && !mature && date === today(now());
    if (!id) {
      const index = Number.isInteger(body.index) ? body.index : 0;
      const stage = Number.isInteger(body.stage) ? body.stage : 0;
      const clean = newSolo(date, false, theme, pinned);
      if (index < 0 || index >= clean.pack.length || stage < 0 || stage > 2) return problem(c, 400, 'That practice round expired.');
      // Guest play is local and never enters Redis or a leaderboard.
      const { index: _index, stage: _stage, ...base } = clean;
      const phase = body.phase === 'reveal' ? 'reveal' : 'clue';
      const score = Number.isInteger(body.score) ? Math.min(500, Math.max(0, body.score)) : 0;
      const run = { ...base, phase, index, stage, score, version: Number.isInteger(body.version) ? body.version : 0 };
      return c.json({ date, mature: false, ranked: false, run: soloView(soloAction(run, body)) });
    }

    const key = soloKey(date, mature, id);
    const name = ranked && body.type === 'next' ? (await platform.user(c))?.name : null;
    const run = await store.update([key], ([saved]) => {
      const current = saved ?? newSolo(date, mature, theme, pinned);
      const next = body.type === 'start' ? current : soloAction(current, body);
      if (saved === next) return change(next);
      const commands = [set(key, next, 90 * day)];
      if (next.phase === 'complete' && current.phase !== 'complete' && ranked) {
        commands.push(['zAdd', dayRank(date), { member: id, score: next.score }]);
        commands.push(['zIncrBy', weekRank(date), id, next.score]);
        commands.push(set('name:' + id, name ?? 'Reddit player', 90 * day));
        commands.push(['expire', dayRank(date), 90 * 86400]);
        commands.push(['expire', weekRank(date), 90 * 86400]);
      }
      return change(next, ...commands);
    });
    return c.json({ date, mature, ranked, run: soloView(run) });
  });

  app.get('/api/leaderboard', async (c) => {
    const date = dateFor(c);
    const scope = c.req.query('scope') === 'week' ? 'week' : 'today';
    const id = platform.id(c);
    const standings = await store.leaderboard(scope === 'week' ? weekRank(date) : dayRank(date), id);
    let rank = 1;
    const rows = await Promise.all(standings.rows.map(async (row, index, all) => {
      if (index > 0 && row.score < all[index - 1].score) rank = index + 1;
      const placement = rank;
      const name = await store.read('name:' + row.member);
      return { name: name ?? 'Reddit player', score: row.score, rank: placement, you: row.member === id };
    }));
    return c.json({ ...standings, rows, scope });
  });

  app.get('/api/theme', async (c) => {
    const id = platform.id(c);
    const date = dateFor(c);
    const saturday = upcomingSaturday(date);
    const key = 'theme:' + saturday;
    const votes = await store.leaderboard(key, null);
    return c.json({
      date: saturday,
      choices: Object.entries(THEMES).map(([id, theme]) => ({ id, name: theme.name, votes: votes.rows.find((row) => row.member === id)?.score ?? 0 })),
      choice: id ? await store.read(key + ':' + id) : null
    });
  });

  app.post('/api/theme', async (c) => {
    const id = platform.id(c);
    const date = dateFor(c);
    const body = await json(c);
    if (!id || date !== today(now())) return problem(c, 403, 'Vote from the current daily post.');
    if (body?.date !== undefined && body.date !== date) return problem(c, 409, 'Voting for that round has closed. Reopen the game to play today’s round.');
    if (!Object.hasOwn(THEMES, body?.choice)) return problem(c, 400, 'Choose a weekend theme.');
    const run = await store.read(soloKey(date, false, id));
    if (run?.phase !== 'complete') return problem(c, 403, 'Finish today’s round to vote.');
    const key = 'theme:' + upcomingSaturday(date);
    const personal = key + ':' + id;
    const choice = body.choice;
    await store.update([personal], ([previous]) => {
      if (previous === choice) return change(null);
      const commands = [set(personal, choice, 14 * day), ['zIncrBy', key, choice, 1], ['expire', key, 14 * 86400]];
      if (previous) commands.push(['zIncrBy', key, previous, -1]);
      return change(null, ...commands);
    });
    return c.json({ choice });
  });

  app.post('/api/report', async (c) => {
    const body = await json(c);
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to report a clue.');
    if (!questionFor(body?.question) || !['Content', 'Wrong answer', 'Broken clue'].includes(body.reason)) return problem(c, 400, 'Pick a report reason.');
    const key = 'reports:' + today(now());
    await store.update([key], ([existing]) => {
      const flags = existing ?? [];
      if (flags.some((flag) => flag.id === id && flag.question === body.question)) return change(null);
      return change(null, set(key, [...flags.slice(-199), { id, question: body.question, reason: body.reason }], 14 * day));
    });
    return c.json({ ok: true });
  });

  app.get('/api/duel', async (c) => {
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to play live.');
    const [profile, active, inbox] = await Promise.all([
      store.read(profileKey(id)), store.read(activeKey(id)), store.read('inbox:' + id)
    ]);
    return c.json({ active, accepts: Boolean(profile?.accepts), invites: inbox?.filter(({ expires }) => expires > now()) ?? [] });
  });

  app.post('/api/duel/preferences', async (c) => {
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to save your preferences.');
    const body = await json(c);
    await store.write(profileKey(id), { accepts: body?.accepts === true }, 365 * day);
    return c.json({ accepts: body?.accepts === true });
  });

  app.post('/api/duel/inbox', async (c) => {
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to manage your inbox.');
    const code = relCode((await json(c))?.code);
    const key = 'inbox:' + id;
    await store.update([key], ([inbox]) => change(null, set(key, (inbox ?? []).filter((item) => item.code !== code), roomIdleMs)));
    return c.json({ ok: true });
  });

  const announce = async (room) => {
    try { await platform.broadcast?.(channel(room.code), { revision: room.revision }); }
    catch (error) { console.error('SYBK realtime notification missed', error.message); }
  };

  app.post('/api/duel/create', async (c) => {
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to host a duel.');
    const body = await json(c);
    const mature = body?.mature === true;
    if (mature && !await canUseMature(c, body)) return problem(c, 403, 'Enable 18+ content on Reddit and confirm After Dark.');
    const user = await platform.user(c);
    if (!user) return problem(c, 401, 'Could not load your Reddit account.');
    const name = typeof body?.target === 'string' ? body.target.trim().replace(/^u\//i, '') : '';
    if (name && (!/^[\w-]{3,20}$/.test(name) || name.toLowerCase() === user.name.toLowerCase())) return problem(c, 400, 'Enter a valid Reddit username other than your own.');
    const target = name ? await platform.lookup(name) : null;
    if (name && !target) return problem(c, 404, 'That Reddit player could not be found.');
    const fresh = now();
    const code = makeCode();
    const room = newRoom(code, user, mature, fresh, target?.id);
    const throttle = 'create-delay:' + id;
    const inboxKey = 'inbox:' + target?.id;
    const keys = target ? [throttle, profileKey(target.id), inboxKey] : [throttle];
    const result = await store.update(keys, ([last, profile, invitations]) => {
      if (last) return change(null);
      const send = Boolean(target && profile?.accepts);
      const commands = [
        set(throttle, true, 6_000), set(roomKey(code), room, day), set(activeKey(id), code, day)
      ];
      if (send) {
        const inbox = (invitations ?? []).filter((invite) => invite.expires > fresh && invite.from !== user.name).slice(-7);
        commands.push(set(inboxKey, [...inbox, { code, from: user.name, mature, expires: fresh + roomIdleMs }], roomIdleMs));
      }
      return change({ delivered: send }, ...commands);
    });
    if (!result) return problem(c, 429, 'Wait a few seconds before opening another room.');
    return c.json({ room: roomView(room, id, fresh), delivered: result.delivered });
  });

  app.post('/api/duel/queue', async (c) => {
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to find a player.');
    const body = await json(c);
    const mature = body?.mature === true;
    if (mature && !await canUseMature(c, body)) return problem(c, 403, 'Enable 18+ content on Reddit and confirm After Dark.');
    const user = await platform.user(c);
    if (!user) return problem(c, 401, 'Could not load your Reddit account.');
    const key = queueKey(mature);
    const active = activeKey(id);
    if (body?.cancel === true) {
      await store.update([key], ([waiting]) => waiting?.player.id === id ? change(null, ['del', key]) : change(null));
      return c.json({ waiting: false });
    }
    const code = makeCode();
    const result = await store.update([key, active], ([waiting, assigned]) => {
      const fresh = now();
      if (body?.poll && assigned) return change({ code: assigned });
      if (!waiting || waiting.expires <= fresh || waiting.player.id === id) {
        return change({ waiting: true }, set(key, { player: user, expires: fresh + 12_000 }, 12_000), ['del', active]);
      }
      const room = admit(newRoom(code, waiting.player, mature, fresh), user, fresh);
      return change({ code }, ['del', key], set(roomKey(code), room, day),
        set(active, code, day), set(activeKey(waiting.player.id), code, day));
    });
    return c.json(result);
  });

  app.get('/api/duel/preview/:code', async (c) => {
    const id = platform.id(c);
    const code = relCode(c.req.param('code'));
    const room = id && codePattern.test(code) ? await store.read(roomKey(code)) : null;
    if (room && !room.players.some((player) => player.id === id) &&
      (room.players.length === 2 || (room.invited && room.invited !== id))) {
      return problem(c, 404, 'This challenge is unavailable.');
    }
    if (!room || advanceRoom(room, now()).phase === 'closed') return problem(c, 404, 'This challenge is unavailable.');
    return c.json({ host: room.players[0].name, mature: room.mature });
  });

  app.post('/api/duel/:code', async (c) => {
    const id = platform.id(c);
    if (!id) return problem(c, 401, 'Sign in to play live.');
    const code = relCode(c.req.param('code'));
    if (!codePattern.test(code)) return problem(c, 400, 'Enter the ten-character room code.');
    const body = await json(c);
    if (!body || !['view', 'join', 'buzz', 'answer', 'trade', 'ready', 'leave', 'rematch'].includes(body.type)) return problem(c, 400, 'Choose a duel action.');
    const key = roomKey(code);
    const existing = await store.read(key);
    if (!existing) return problem(c, 404, 'That room has closed or expired.');
    if (existing.mature && !await canUseMature(c, body)) return problem(c, 403, 'This is an After Dark room. Enable 18+ content on Reddit and confirm the warning.');
    const joining = body.type === 'join' ? await platform.user(c) : null;

    const inboxKey = 'inbox:' + id;
    function apply(room, inbox) {
      if (!room) return change(null);
      const stamp = now();
      const current = advanceRoom(room, stamp);
      const next = joining ? admit(current, joining, stamp) : roomAction(current, id, body, stamp);
      if (!next.players.some((player) => player.id === id)) return change(null);
      if (next === room && !joining) return change({ room: next, changed: false });
      const writes = [set(key, next, day)];
      if (joining) {
        writes.push(set(activeKey(id), code, day));
        if (inbox?.some((entry) => entry.code === code)) {
          writes.push(set(inboxKey, inbox.filter((entry) => entry.code !== code), roomIdleMs));
        }
      }
      return change({ room: next, changed: room !== next }, ...writes);
    }
    const existingMember = existing.players.some((player) => player.id === id);
    if (body.type === 'view' && existingMember && advanceRoom(existing, now()) === existing) {
      return c.json({ room: roomView(existing, id, now()) });
    }
    const result = await store.update(joining ? [key, inboxKey] : [key], ([room, inbox]) => apply(room, inbox));
    if (!result) return problem(c, 403, 'This room is full, expired, or reserved for another player.');
    if (result.changed) await announce(result.room);
    return c.json({ room: roomView(result.room, id, now()) });
  });

  app.get('/api/drop', (c) => c.json({ date: dateFor(c), questions: dailyPack(dateFor(c), false).length }));
  return app;
}
