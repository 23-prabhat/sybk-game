import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './app.js';
import { dailyPack, duelPack, gradeAnswer, pinnedDailyPack, publicQuestion, questionFor } from './content.js';
import { newRoom, admit, advanceRoom, roomAction, roomView } from './game.js';
import { previewStore } from './store.js';
import { duelReaction, soloReaction } from '../client/reactions.js';

const date = '2026-11-22';
const initial = Date.parse(date + 'T09:00:00Z');
function correctAnswer(view) {
  if (view.hint.kind === 'tile') return { tiles: [0, 1, 2, 3] };
  const answer = questionFor(view.id).answer;
  return view.typed ? { text: answer } : { choice: view.choices.find((option) => option.label === answer).id };
}

function harness() {
  let clock = initial;
  const user = (id) => id ? { id, name: id } : null;
  const app = createApp({
    store: previewStore(),
    now: () => clock, id: (context) => context.req.header('x-player'),
    user: (context) => user(context.req.header('x-player')), lookup: user,
    adult: (context) => ['Alice', 'Bob'].includes(context.req.header('x-player')),
    postDate: (context) => context.req.header('x-date')
  });
  const call = async (path, id, body, postDate) => {
    const headers = { 'Content-Type': 'application/json' };
    if (id) headers['x-player'] = id;
    if (postDate) headers['x-date'] = postDate;
    const response = await app.request('/api/' + path, { method: body ? 'POST' : 'GET', headers, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  return { call, tick: (milliseconds) => { clock += milliseconds; } };
}

test('ranked runs resume at the saved clue and a duplicated finish scores once', async () => {
  const { call } = harness();
  const payload = (type, run, answer) => ({ type, version: run.version, answer });
  let { run } = (await call('solo', 'Alice', { type: 'start' })).data;
  const initialClue = run.question;
  const noAnswerLeak = Object.hasOwn(initialClue, 'answer');
  assert.equal(noAnswerLeak, false);
  run = (await call('solo', 'Alice', payload('hint', run))).data.run;
  const resumed = (await call('bootstrap', 'Alice')).data.progress;
  assert.equal(resumed.question.id, initialClue.id);
  assert.equal(resumed.stage, 1);
  for (let i = 0; i < 5; i += 1) {
    run = (await call('solo', 'Alice', payload('answer', run, correctAnswer(run.question)))).data.run;
    assert.equal(run.phase, 'reveal');
    if (i < 4) run = (await call('solo', 'Alice', payload('next', run))).data.run;
  }
  const final = payload('next', run);
  const endings = await Promise.all([call('solo', 'Alice', final), call('solo', 'Alice', final)]);
  assert.ok(endings.every((entry) => entry.data.run.phase === 'complete'));
  const day = (await call('leaderboard', 'Alice')).data;
  const week = (await call('leaderboard?scope=week', 'Alice')).data;
  assert.equal(day.rows[0].score, 500);
  assert.equal(week.rows[0].score, 500);
  assert.equal(day.rows[0].rank, 1);
  assert.equal(day.total, 1);
  await call('theme', 'Alice', { choice: 'fandom' });
  await call('theme', 'Alice', { choice: 'fandom' });
  await call('theme', 'Alice', { choice: 'satire' });
  const ballot = (await call('theme', 'Alice')).data;
  assert.equal(ballot.choice, 'satire');
  assert.equal(ballot.choices.find((entry) => entry.id === 'fandom').votes, 0);
  assert.equal(ballot.choices.find((entry) => entry.id === 'satire').votes, 1);
});

test('live matchmaking admits two real identities and only one concurrent buzzer claim', async () => {
  const { call, tick } = harness();
  const first = await call('duel/queue', 'Alice', {});
  assert.equal(first.data.waiting, true);
  const { code } = (await call('duel/queue', 'Bob', {})).data;
  assert.equal((await call('duel/queue', 'Alice', { poll: true })).data.code, code);
  const act = (user, type, extra = {}) => call('duel/' + code, user, { type, round: 1, index: 0, ...extra });
  await act('Alice', 'ready');
  const countdown = (await act('Bob', 'ready')).data.room;
  assert.equal(countdown.phase, 'countdown');
  assert.equal((await act('Carol', 'view')).status, 403);
  tick(3000);
  const concurrent = await Promise.all([act('Alice', 'buzz'), act('Bob', 'buzz')]);
  assert.equal(concurrent.filter((entry) => entry.data.room.yours).length, 1);
  assert.equal(concurrent.filter((entry) => entry.data.room.question.typed).length, 1);
  assert.ok(concurrent.every((entry) => entry.data.room.question.choices.length === 0));
  const winner = concurrent[0].data.room.yours ? 'Alice' : 'Bob';
  const other = winner === 'Alice' ? 'Bob' : 'Alice';
  tick(12_000);
  assert.equal((await act(winner, 'view')).data.room.canBuzz, false);
  const steal = (await act(other, 'buzz')).data.room;
  const revealed = (await act(other, 'answer', { answer: correctAnswer(steal.question) })).data.room;
  assert.equal(revealed.results[0].points, 100);
  assert.equal(revealed.results[0].player, other);
});

test('targeted rooms and After Dark validate membership, age setting and confirmation', async () => {
  const { call } = harness();
  assert.equal((await call('solo', 'Child', { type: 'start', mature: true, confirm: true })).status, 403);
  assert.equal((await call('solo', 'Alice', { type: 'start', mature: true })).status, 403);
  assert.match((await call('solo', 'Alice', { type: 'start', mature: true, confirm: true })).data.run.question.category, /^After Dark/);
  assert.equal((await call('leaderboard', 'Alice')).data.total, 0);
  await call('duel/preferences', 'Bob', { accepts: true });
  const hosted = (await call('duel/create', 'Alice', { target: 'Bob', mature: true, confirm: true })).data;
  assert.equal(hosted.delivered, true);
  const { code } = hosted.room;
  const invite = (await call('duel', 'Bob')).data.invites[0];
  assert.equal(invite.code, code);
  assert.equal((await call('duel/preview/' + code, 'Bob')).data.host, 'Alice');
  assert.equal((await call('duel/preview/' + code, 'Carol')).status, 404);
  assert.equal((await call('duel/' + code, 'Carol', { type: 'join', confirm: true })).status, 403);
  assert.equal((await call('duel/' + code, 'Bob', { type: 'join' })).status, 403);
  assert.equal((await call('duel/' + code, 'Bob', { type: 'join', confirm: true })).data.room.players.length, 2);
});

test('a tile puzzle and daily variations validate authored answers', () => {
  const q = questionFor('cinema');
  assert.equal(gradeAnswer(q, 0, { tiles: [2, 0, 3, 1] }, 'solo'), false);
  assert.equal(gradeAnswer(q, 0, { tiles: [0, 1, 2, 3] }, 'solo'), true);
  assert.equal(new Set(dailyPack(date, false)).size, 5);
  assert.notDeepEqual(dailyPack(date, false), dailyPack('2026-11-23', false));
});

test('a stale action cannot buzz into a later duel turn', () => {
  let room = newRoom('0123456789', { id: 'a', name: 'Alice' }, false, initial);
  room = admit(room, { id: 'b', name: 'Bob' }, initial);
  room = roomAction(room, 'a', { type: 'ready', round: 1 }, initial);
  room = roomAction(room, 'b', { type: 'ready', round: 1 }, initial);
  room = advanceRoom(room, initial + 3000);
  assert.ok(roomView(room, 'a', initial + 3000).canBuzz);
  assert.equal(roomAction(room, 'a', { type: 'buzz', index: 1, round: 1 }, initial + 3000), room);
});

test('a live match records five questions and both players can rematch', async () => {
  const { call, tick } = harness();
  const { code } = (await call('duel/create', 'Alice', {})).data.room;
  const act = (user, type, extra = {}) => call('duel/' + code, user, { type, round: 1, index: 0, ...extra });
  await act('Bob', 'join');
  await act('Alice', 'ready');
  await act('Bob', 'ready');
  tick(3000);
  for (let index = 0; index < 5; index += 1) {
    const room = (await act('Alice', 'buzz', { index })).data.room;
    assert.equal(room.yours, true);
    const { room: revealed } = (await act('Alice', 'answer', { index, answer: correctAnswer(room.question) })).data;
    assert.equal(revealed.phase, 'reveal');
    assert.equal(revealed.results.length, index + 1);
    tick(revealed.deadline - revealed.serverNow);
  }
  const result = (await act('Bob', 'view')).data.room;
  assert.equal(result.phase, 'complete');
  assert.equal(result.players.find((player) => player.name === 'Alice').score, 500);
  await act('Alice', 'rematch');
  const rematch = (await act('Bob', 'rematch')).data.room;
  assert.equal(rematch.round, 2);
  assert.equal(rematch.phase, 'countdown');
  assert.deepEqual(rematch.results, []);
});

test('regular rounds rotate image silhouettes and hold the full original until reveal', async () => {
  const { call } = harness();
  const answerIds = new Set();
  for (let day = 22; day <= 27; day += 1) {
    const pack = dailyPack(`2026-11-${day}`, false);
    assert.equal(questionFor(pack[0]).hints[0].kind, 'silhouette');
    assert.equal(pack.filter((id) => questionFor(id).revealArt).length, 3);
    assert.deepEqual(pinnedDailyPack(pack), pack);
    answerIds.add(pack[0]);
  }
  assert.equal(answerIds.size, 6);
  assert.equal(questionFor(duelPack(false)[0]).hints[0].kind, 'silhouette');
  const start = (await call('solo', 'Alice', { type: 'start' })).data.run;
  assert.equal(start.question.credit, undefined);
  assert.equal(start.question.hint.text, undefined);
  assert.deepEqual(start.question.choices, []);
  const source = questionFor(start.question.id);
  assert.notEqual(source.revealArt, start.question.hint.art);
  assert.ok(!JSON.stringify(start.question).includes(source.revealArt));
  assert.ok(!JSON.stringify(start.question).includes(source.answer));
  const nudge = (await call('solo', 'Alice', { type: 'hint', version: start.version })).data.run;
  assert.equal(nudge.question.hint.art, start.question.hint.art);
  assert.ok(nudge.question.hint.text);
  assert.deepEqual(nudge.question.choices, []);
  assert.equal(nudge.availablePoints, 100);
  const noSecondFreeHint = (await call('solo', 'Alice', { type: 'hint', version: nudge.version })).data.run;
  assert.equal(noSecondFreeHint.version, nudge.version);
  const rescue = (await call('solo', 'Alice', { type: 'trade', version: nudge.version })).data.run;
  assert.equal(rescue.availablePoints, 70);
  assert.equal(rescue.score, nudge.score);
  assert.equal(rescue.question.choices.length, 4);
  const resumed = (await call('bootstrap', 'Alice')).data.progress;
  assert.equal(resumed.availablePoints, 70);
  const reveal = (await call('solo', 'Alice', { type: 'answer', version: rescue.version, answer: { text: source.aliases[0] } })).data.run;
  assert.equal(reveal.results[0].points, 70);
  assert.equal(reveal.results[0].credit.source, source.credit.source);
  assert.equal(reveal.results[0].finishedArt, source.revealArt);
  assert.equal(reveal.results[0].silhouette.art, start.question.hint.art);
  const choice = rescue.question.choices.find((item) => item.label === source.answer).id;
  assert.equal(gradeAnswer(source, 0, { choice }, 'solo'), null);
  assert.equal(gradeAnswer(source, 2, { choice }, 'solo'), true);
  assert.equal(publicQuestion(source, 0, 'duel', false).typed, false);
  const legacy = ['photo-farmer', 'fine', 'cooked', 'back', 'cinema'];
  assert.deepEqual(pinnedDailyPack(legacy), legacy);
});

test('a valid Solo miss closes the question immediately and cannot be retried', async () => {
  const { call } = harness();
  const act = async (type, version, answer) => (await call('solo', 'Alice', { type, version, answer })).data.run;
  const start = await act('start');
  const invalid = await act('answer', start.version, { text: '   ' });
  assert.equal(invalid.version, start.version);
  const missed = await act('answer', start.version, { text: 'a wrong guess' });
  assert.equal(missed.phase, 'reveal');
  assert.equal(missed.results[0].outcome, 'miss');
  assert.equal(missed.score, 0);
  const triedAgain = await act('answer', missed.version, correctAnswer(start.question));
  assert.deepEqual(triedAgain, missed);
  const next = await act('next', missed.version);
  const skipped = await act('skip', next.version);
  assert.equal(skipped.results.at(-1).outcome, 'skip');
});

test('the shared Duel hint is free and a trade only helps and charges the current claimant', async () => {
  const { call, tick } = harness();
  const { code } = (await call('duel/create', 'Alice', {})).data.room;
  const act = async (user, type, index = 0, answer) =>
    (await call('duel/' + code, user, { type, index, answer, round: 1 })).data.room;
  await act('Bob', 'join');
  await act('Alice', 'ready');
  await act('Bob', 'ready');
  tick(3000);
  await act('Alice', 'view');
  tick(16_000);
  const shared = await act('Alice', 'view');
  assert.equal(shared.stage, 1);
  assert.equal(shared.availablePoints, 100);
  const claim = await act('Alice', 'buzz');
  assert.equal(claim.yours, true);
  assert.equal((await act('Bob', 'trade')).revision, claim.revision);
  const traded = await act('Alice', 'trade');
  assert.equal(traded.availablePoints, 70);
  assert.equal(traded.deadline, claim.deadline);
  assert.equal((await act('Alice', 'trade')).revision, traded.revision);
  const rival = await act('Bob', 'view');
  assert.equal(rival.stage, 1);
  assert.equal(rival.availablePoints, 100);
  assert.equal(rival.question.choices.length, 0);
  await act('Alice', 'answer', 0, { text: 'a wrong guess' });
  assert.equal((await act('Alice', 'buzz')).canBuzz, false);
  const steal = await act('Bob', 'buzz');
  const won = await act('Bob', 'answer', 0, correctAnswer(steal.question));
  assert.equal(won.results[0].points, 100);
  tick(won.deadline - won.serverNow);
  const next = await act('Alice', 'buzz', 1);
  assert.equal(next.availablePoints, 100);
  const tradedAgain = await act('Alice', 'trade', 1);
  const solved = await act('Alice', 'answer', 1, correctAnswer(tradedAgain.question));
  assert.equal(solved.results[1].points, 70);
});

test('Pip distinguishes first hits, streaks, saved runs, and duel steals', () => {
  const base = { phase: 'reveal', index: 0, results: [{ points: 100 }] };
  assert.match(soloReaction(base).text, /YOO! First hit/);
  assert.equal(soloReaction({ ...base, results: [{ points: 100 }, { points: 100 }] }).stamp, 'First-hit streak ×2');
  assert.equal(soloReaction({ ...base, results: [{ points: 70 }] }).stamp, undefined);
  const free = soloReaction({ ...base, results: [{ points: 100, hintStage: 1 }] });
  assert.match(free.text, /Free clue, full points/);
  assert.equal(free.stamp, undefined);
  assert.match(soloReaction({ phase: 'clue', index: 1 }, true).text, /welcome back.*Question 2/);
  const reveal = { phase: 'reveal', steal: true, results: [{ player: 'Alice', points: 70, you: true }] };
  assert.equal(duelReaction(reveal).stamp, 'Steal');
  assert.equal(duelReaction({ ...reveal, results: [{ player: 'Alice', points: 70, you: false }] }).stamp, undefined);
  assert.equal(duelReaction({ ...reveal, steal: false, players: [{ you: true, score: 170 }, { you: false, score: 140 }] }).stamp, 'Comeback');
});
