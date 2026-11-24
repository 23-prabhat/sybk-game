import { api, local, shareRoom, sharedCode, subscribe } from './transport.js';
import { duelReaction, soloReaction } from './reactions.js';

const screen = document.querySelector('#screen');
const notice = document.querySelector('#message');
const dialog = document.querySelector('#dialog');
const announcer = document.querySelector('#announcer');
screen.addEventListener('load', (event) => {
  if (event.target.matches('.color-frame')) event.target.classList.add('ready');
}, true);
const CLUE_LABELS = ['Opening clue', 'Free clue', 'Traded clue'];
const state = {
  page: 'boot', dark: false, busy: false, connected: false, scope: 'today',
  room: null, waiting: false, tiles: null, selection: null, invite: sharedCode()
};
let connection;
let lastPoll = 0;
let refreshing = false;
let lastInbox = 0;
let deadlinePoll = 0;
let audioContext;
let noticeTimer;

const clean = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const art = (name) => './art/' + clean(name) + '.webp';

function button(label, action, color = '', extra = '') {
  return `<button type="button" class="action ${color}" data-act="${action}" ${extra}>${label}</button>`;
}
function host(reaction, control = '') {
  const { text, mood = 'focus' } = typeof reaction === 'string' ? { text: reaction } : reaction;
  return `<div class="host" data-mood="${mood}"><img src="${art('pip')}" alt="">
    <div class="speech"><span class="host-name">Pip</span><p>${clean(text)}</p>${control}</div></div>`;
}
function revealPanel(result, reaction, points) {
  const credit = result?.credit;
  const original = result?.finishedArt
    ? `<figure class="clue-image finished-image"><img src="${art(result.finishedArt)}" alt="${clean(result.finishedAlt ?? 'Full meme image')}"></figure>` : '';
  return `<section class="clue reveal${result?.silhouette ? ' reveal-signal' : ''}" data-mood="${reaction.mood}">
    ${result?.silhouette ? silhouetteStage(result.silhouette, result) : ''}
    <div class="reveal-tags"><span class="earned">${clean(points)}</span>
    ${reaction.stamp ? `<span class="hit-stamp">${clean(reaction.stamp)}</span>` : ''}</div>
    <h2 tabindex="-1">${clean(result?.answer)}</h2><p>${clean(result?.note)}</p>
    ${result?.silhouette ? '' : original}
    ${credit ? `<p class="photo-credit"><a href="${clean(credit.source)}" target="_blank" rel="noopener noreferrer">${clean(credit.by)}</a> · ${credit.license
      ? `<a href="${clean(credit.license)}" target="_blank" rel="noopener noreferrer">${clean(credit.terms)}</a>` : clean(credit.terms)}</p>` : ''}
  </section>`;
}
function nav() {
  for (const el of document.querySelectorAll('[data-nav]')) {
    const active = el.dataset.nav === state.page || (el.dataset.nav === 'duels' && ['room', 'invite'].includes(state.page));
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  }
}
function paint(html, stage) {
  screen.dataset.stage = stage;
  screen.dataset.rating = state.dark ? 'after-dark' : 'regular';
  screen.innerHTML = html;
  nav();
}
function flash(text) {
  clearTimeout(noticeTimer);
  notice.textContent = text;
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4400);
}
function focusScreen() { screen.querySelector('h1')?.focus({ preventScroll: true }); }

function silhouetteStage(hint, result) {
  return `<figure class="signal-stage${result ? ' signal-reveal' : ''}">
    <div class="signal-picture"><img class="shadow-frame" src="${art(hint.art)}" alt="${result ? '' : clean(hint.alt)}">
    ${result ? `<img class="color-frame" src="${art(result.finishedArt)}" alt="${clean(result.finishedAlt)}">` : ''}</div>
    <figcaption>${result ? 'Lights up!' : 'Who’s that meme?'}</figcaption>
  </figure>`;
}

function renderHint(hint) {
  switch (hint.kind) {
    case 'silhouette':
      return silhouetteStage(hint) + (hint.text ? `<p class="signal-hint">${clean(hint.text)}</p>` : '');
    case 'image':
      return `<figure class="clue-image${hint.photo ? ' photo' : ''}"><img src="${art(hint.art)}" alt="${clean(hint.alt)}" style="--scale:${hint.zoom ?? 1}"></figure>`;
    case 'video':
      return `<figure class="clue-video"><video controls playsinline preload="none" poster="${art(hint.art)}" aria-label="${clean(hint.alt)}" src="./art/${clean(hint.clip)}.mp4"></video><figcaption>${clean(hint.alt)}</figcaption></figure>`;
    case 'frames':
      return `<figure class="frames" aria-label="${clean(hint.alt)}">${[2.4, 1.6, 1].map((zoom) =>
        `<div><img src="${art(hint.art)}" alt="" style="--scale:${zoom}"></div>`).join('')}</figure>`;
    case 'audio':
      return `<div class="sound-hint">${button('Play audio clue', 'audio', 'gold')}<p>${clean(hint.alt)}</p></div>`;
    case 'tile':
      return `<p class="tile-help">Select two pieces to swap them.</p><div class="tiles" aria-label="${clean(hint.alt)}">${state.tiles.map((piece, position) =>
        `<button type="button" data-act="tile" data-value="${position}" aria-label="Piece ${piece + 1} in slot ${position + 1}" aria-pressed="${state.selection === position}" style="--tile-art:url(${art(hint.art)});--x:${piece % 2 * 100}%;--y:${Math.floor(piece / 2) * 100}%"></button>`).join('')}</div>`;
    case 'emoji':
      return `<p class="emoji-clue" aria-label="${clean(hint.alt)}">${clean(hint.text)}</p>`;
    default:
      return `<p class="clue-text ${hint.kind === 'quote' ? 'quote' : ''}">${clean(hint.text)}</p>`;
  }
}

function clue(question, stage) {
  if (question.hint.kind === 'tile') {
    const key = question.id + ':' + stage;
    if (state.tileKey !== key) {
      state.tileKey = key;
      state.tiles = [...question.hint.tiles];
      state.selection = null;
    }
  }
  const shadow = question.hint.kind === 'silhouette';
  return `<section class="clue${shadow ? ' signal-clue' : ''}" tabindex="-1">
    <div class="clue-top"><span>${clean(question.category)}</span><span>${CLUE_LABELS[stage]}</span></div>
    ${shadow ? '' : `<p class="clue-label">${clean(question.prompt)}</p>`}${renderHint(question.hint)}
  </section>`;
}
function choices(question, action) {
  const options = question.choices.map(({ label, id }, index) =>
    button(`<span class="letter">${'ABCD'[index]}</span>${clean(label)}`, action, 'choice', `data-value="${clean(id)}"`));
  return `<div class="choices">${options.join('')}</div>`;
}
function guessForm(type, hasChoices) {
  return `<form data-form="${type}" class="line-form guess-form">
    <label class="sr-only" for="typed">Name the meme</label>
    <input id="typed" name="text" maxlength="100" required autocomplete="off" enterkeyhint="go" placeholder="${hasChoices ? 'Or type the name' : 'Type the meme name…'}">
    <button class="action gold" type="submit">Lock it in</button>
  </form>`;
}

function renderSolo() {
  const run = state.solo;
  if (!run) return;
  const reaction = soloReaction(run, state.soloReturning);
  const label = state.dark ? 'After Dark' : state.boot.archived ? 'Archive round' : 'Daily Solo';
  const title = `<div class="stage-heading"><div><h1 tabindex="-1">${label}</h1><span>${clean(state.boot.date)}${state.dark ? ' · 18+' : ''}</span></div><b class="score">${run.score}<small> pts</small></b></div>`;
  const progress = `<div class="round-progress" aria-label="Question ${run.index + 1} of ${run.count}"><span>Question ${run.index + 1} / ${run.count}</span><div class="segments">${Array.from({ length: run.count }, (_, i) => `<i class="${i < run.index ? 'past' : i === run.index ? 'active' : ''}"></i>`).join('')}</div></div>`;
  if (run.phase === 'complete') {
    paint(`${title}${host(reaction)}<div class="result"><div><h2>That’s a wrap.</h2><p><strong>${run.score} / ${run.count * 100}</strong></p>
      ${state.rank?.you ? `<p class="ranking-summary">Daily rank #${state.rank.you.rank}</p>` : ''}
      <div class="result-marks" aria-label="Points by question">${run.results.map(({ points }) => `<span>${points}</span>`).join('')}</div>
      <div class="actions">${state.dark || !state.boot.ranked ? '' : button('See leaderboard', 'ranks', 'gold')}${button('Challenge a friend', 'duels')}${button('Copy result', 'copy-score')}${state.dark || !state.boot.ranked ? '' : button('Vote on next theme', 'theme', 'quiet')}${state.dark ? button('Back to Daily Solo', 'daily') : button('After Dark · 18+', 'dark')}</div>
      <p class="next-drop">${state.boot.archived ? 'Archive round' : 'New daily drop at 00:00 UTC'}</p></div></div>`, 'solo');
    return;
  }
  if (run.phase === 'reveal') {
    const result = run.results.at(-1) ?? state.guestLast;
    const cue = button(run.index + 1 === run.count ? 'See results' : 'Next question', 'next', 'gold host-action');
    paint(`${title}${progress}${host(reaction, cue)}
      ${revealPanel(result, reaction, '+' + (result?.points ?? 0) + ' points')}
      <div class="actions">${button('Report clue', 'report', 'quiet')}</div>`, 'solo');
    return;
  }
  const q = run.question;
  const questionClue = clue(q, run.stage);
  let coaching = reaction;
  if (q.hint.kind === 'tile' && state.selection !== null) {
    coaching = { text: 'Got that piece. Tap the one you want to swap it with.', mood: 'focus' };
  } else if (q.hint.kind === 'tile' && state.tiles.every((piece, index) => piece === index)) {
    coaching = { text: 'That looks clean. Hit “Check the image” and I’ll score it.', mood: 'warm' };
  }
  const coach = [
    button('Ask Pip for a free hint', 'hint', 'host-action'),
    button(`Trade ${run.hintCost} pts for another hint`, 'trade', 'host-action'),
    ''
  ][run.stage];
  const answers = q.hint.kind === 'tile' ? button('Check the image', 'check-tiles', 'gold') : q.choices.length ? choices(q, 'guess') : '';
  const typed = q.typed ? guessForm('guess', q.choices.length) : '';
  paint(`${title}${progress}${host(coaching, coach)}${questionClue}
    <div class="answer-console">
      <strong class="available-points">+${run.availablePoints} points up for grabs</strong>
      <span class="guess-limit">One guess</span>${answers}${typed}
    </div>
    <div class="actions solo-extra">${button('Skip and reveal', 'skip', 'quiet')}${button('Report clue', 'report', 'quiet')}${state.dark ? button('Back to Daily Solo', 'daily', 'quiet') : button('After Dark · 18+', 'dark', 'quiet')}</div>`, 'solo');
}
async function openSolo(mature = false) {
  const reply = await api('solo', { type: 'start', mature, confirm: mature });
  stopRoom();
  state.page = 'solo';
  state.dark = mature;
  state.tileKey = null;
  state.guestLast = null;
  state.soloDate = reply.date;
  state.solo = reply.run;
  state.soloReturning = reply.run.version > 0;
  state.rank = reply.ranked && reply.run.phase === 'complete' ? await api('leaderboard').catch(() => null) : null;
  renderSolo();
  focusScreen();
  if (!mature && reply.run.version === 0 && !hasSeenPip()) pipIntro();
}
async function playSolo(type, answer) {
  const old = state.solo;
  const draft = ['hint', 'trade'].includes(type) ? screen.querySelector('#typed')?.value : undefined;
  const reply = await api('solo', {
    type, answer, date: state.soloDate, mature: state.dark, confirm: state.dark, version: old.version,
    index: old.index, stage: old.stage, score: old.score, phase: old.phase
  });
  const run = reply.run;
  if (!state.boot.signedIn) {
    if (run.phase === 'reveal') state.guestLast = run.results.at(-1);
    run.results = [...old.results, ...run.results];
  }
  state.solo = run;
  state.soloReturning = false;
  if (reply.ranked && run.phase === 'complete') state.rank = await api('leaderboard').catch(() => null);
  renderSolo();
  const entry = screen.querySelector('#typed');
  if (entry && draft !== undefined && old.index === run.index) entry.value = draft;
  if (run.version !== old.version) {
    announcer.textContent = run.phase === 'reveal'
      ? soloReaction(run).text + ' ' + run.results.at(-1).answer + ' · ' + run.results.at(-1).points + ' points'
      : run.phase === 'clue' ? `Question ${run.index + 1}. ${CLUE_LABELS[run.stage]}. ${run.availablePoints} points available.` : 'Daily round complete.';
  }
  if (run.version === old.version) return;
  if (run.phase === 'reveal') screen.querySelector('.reveal h2')?.focus({ preventScroll: true });
  else if (type === 'next') focusScreen();
  else screen.querySelector('.clue')?.focus({ preventScroll: true });
}
function renderRanks(board) {
  const rows = board.rows.map(({ rank, name, score, you }) =>
    `<li><strong>${rank}</strong><span>${you ? 'You · ' : ''}u/${clean(name)}</span><b>${score}</b></li>`).join('');
  paint(`<div class="stage-heading"><h1 tabindex="-1">Elite Ball Knowledge</h1></div>
    ${host('The receipts are in.')}
    <div class="actions">${button('Today', 'today', state.scope === 'today' ? 'gold' : '')}${button('This week', 'week', state.scope === 'week' ? 'gold' : '')}</div>
    <section class="paper leaderboard">${board.total ? `<ol>${rows}</ol><p>${board.total} ranked player${board.total === 1 ? '' : 's'}${board.you ? ` · You’re #${board.you.rank} with ${board.you.score} pts` : ''}</p>` : '<h2>The board is empty.</h2><p>Finish today’s round to set the score to beat.</p>'}</section>`, 'solo');
}
async function openRanks(scope = 'today') {
  stopRoom();
  state.dark = false;
  state.page = 'ranks';
  state.scope = scope;
  renderRanks(await api('leaderboard?scope=' + scope));
  focusScreen();
}

function renderDuels() {
  const hub = state.hub;
  const inviteList = hub?.invites.map(({ code, from, mature }) =>
    `<li><span>u/${clean(from)}${mature ? ' · After Dark' : ''}</span><div>${button('Open', 'open-invite', 'gold', `data-value="${clean(code)}"`)} ${button('Dismiss', 'dismiss-invite', 'quiet', `data-value="${clean(code)}"`)}</div></li>`).join('');
  paint(`<div class="stage-heading"><div><h1 tabindex="-1">Live Duels</h1><span>Two players. One buzzer.</span></div></div>
    ${host(state.waiting ? 'Looking for another player…' : 'Get a friend on the line or take on Reddit.')}
    ${state.boot.signedIn ? `
      <section class="paper duel-hub">
        <div class="hub-primary"><h2>Find an opponent</h2><p>${state.dark ? 'After Dark queue · 18+' : 'Live matchmaking'}.</p>
        ${state.waiting ? button('Cancel search', 'cancel') : button('Find an opponent', 'queue', 'gold')}</div>
        <div class="hub-friend"><h2>Challenge a friend</h2><form data-form="create" class="line-form">
          <label class="sr-only" for="target">Optional Reddit username</label><input id="target" name="target" placeholder="Reddit username (optional)" maxlength="22"><button class="action" type="submit">Create room</button>
        </form><form data-form="join" class="line-form"><label class="sr-only" for="room">Room code</label><input id="room" name="code" placeholder="Room code" minlength="10" maxlength="10" required><button class="action" type="submit">Join</button></form></div>
      </section>
      <section class="lobby-extra">
        ${hub?.active ? button('Rejoin recent room', 'rejoin', '', `data-value="${clean(hub.active)}"`) : ''}
        ${state.dark ? button('Use regular packs', 'regular-duel') : button('After Dark · 18+', 'dark')}
        <label class="toggle"><input type="checkbox" data-setting="invites" ${hub?.accepts ? 'checked' : ''}> Allow in-game invites</label>
      </section>
      ${inviteList ? `<section class="paper inbox"><h2>Challenges</h2><ul>${inviteList}</ul></section>` : ''}
    ` : '<section class="paper"><h2>Sign in to play live</h2><p>Open the post with a signed-in Reddit account to join a duel.</p></section>'}`, 'duel');
}
async function openDuels(dark = false) {
  stopRoom();
  state.page = 'duels';
  state.dark = dark;
  state.hub = state.boot.signedIn ? await api('duel') : null;
  renderDuels();
  focusScreen();
}
function renderRoom(reaction) {
  const room = state.room;
  const players = room.players.map(({ name, you, score, ready }) =>
    `<div><span>${you ? 'You' : 'u/' + clean(name)}${room.phase === 'lobby' && ready ? ' · Ready' : ''}</span><b>${score}</b></div>`);
  if (players.length === 1) players.push('<div><span>Waiting for player</span><b>–</b></div>');
  const coach = room.phase === 'lobby' ? button('Pip, show me the buzzer', 'practice', 'host-action')
    : room.phase === 'answering' && room.yours && room.stage < 2
      ? button(`Trade ${room.hintCost} pts for a hint`, 'duel-trade', 'host-action') : '';
  const title = `<div class="stage-heading"><div><h1 tabindex="-1">Buzzer Duel</h1><span>${room.mature ? 'After Dark · 18+' : 'Live head-to-head'}</span></div>${room.deadline ? '<b id="clock" class="clock">—</b>' : ''}</div>
    <div class="scoreboard">${players.join('')}</div>
    ${room.question || room.phase === 'reveal' ? `<div class="round-progress">Question ${room.index + 1} / ${room.count}${room.question ? ` · ${room.availablePoints} pts` : ''}</div>` : ''}
    ${host(reaction, coach)}`;
  let body;
  const you = room.players.find((player) => player.you);
  if (room.phase === 'lobby') {
    body = `<section class="paper room-lobby"><p>Room code</p><h2>${clean(room.code)}</h2><div class="actions">
      ${button('Share challenge', 'share', 'gold')}${button('Copy code', 'copy-code')}
      ${button(you.ready ? 'You’re ready' : 'Ready', 'ready', '', you.ready ? 'disabled' : '')}</div></section>`;
  } else if (room.question) {
    body = clue(room.question, room.stage);
    if (room.phase === 'answering' && room.yours) {
      body += room.question.choices.length ? choices(room.question, 'duel-answer') : '';
      if (room.question.typed) body += guessForm('duel-guess', room.question.choices.length);
    } else body += `<div class="buzzer-base">${button('BUZZ', 'buzz', 'buzzer', room.canBuzz ? '' : 'disabled')}</div>`;
  } else if (room.phase === 'reveal') {
    const result = room.results.at(-1);
    body = revealPanel(result, reaction, result?.player ? (result.you ? 'You' : 'u/' + result.player) + ' +' + result.points : 'No points');
  } else if (room.phase === 'complete') {
    const [a, b] = room.players;
    const winner = a.score === b.score ? 'It’s a tie.' : (a.score > b.score ? a : b).you ? 'You win!' : 'They win.';
    body = `<section class="paper duel-result"><h2>${winner}</h2><ol>${room.results.map(({ answer, player, points }) => `<li>${clean(answer)} <strong>${player ? clean(player) + ' +' + points : '–'}</strong></li>`).join('')}</ol>
      ${button(you.ready ? 'Waiting for rematch' : 'Rematch', 'rematch', 'gold', you.ready ? 'disabled' : '')}</section>`;
  } else {
    body = `<section class="paper center"><h2>${room.phase === 'closed' ? 'Room closed' : 'Get ready'}</h2><p>${room.phase === 'closed' ? 'Find a new opponent to play again.' : 'Question one is coming up.'}</p></section>`;
  }
  paint(`${title}${body}<div class="actions solo-extra">${button('Back to duels', 'duels', 'quiet')}${['complete', 'closed'].includes(room.phase) ? '' : button('Leave room', 'leave-confirm', 'quiet')}${room.question || room.phase === 'reveal' ? button('Report clue', 'report', 'quiet') : ''}</div>`, 'duel');
  updateClock();
}
function acceptRoom(room, returning = false) {
  if (state.room?.code === room.code && state.room.revision > room.revision) return;
  const takesFloor = room.yours && !state.room?.yours && state.room?.code === room.code;
  const boughtHint = room.yours && room.stage === 2 && state.room?.yours && state.room.stage !== 2;
  const draft = boughtHint ? screen.querySelector('#typed')?.value : undefined;
  const changed = state.room?.code !== room.code || state.room.revision !== room.revision;
  const stageChanged = state.room?.stage !== room.stage || state.room?.index !== room.index;
  state.offset = room.serverNow - Date.now();
  state.room = room;
  if (changed) {
    const reaction = duelReaction(room, returning);
    renderRoom(reaction);
    const typed = screen.querySelector('#typed');
    if (typed && draft !== undefined) typed.value = draft;
    if ((takesFloor || boughtHint) && !dialog.open) (typed ?? screen.querySelector('.choice'))?.focus({ preventScroll: true });
    announcer.textContent = room.phase === 'open' && stageChanged ? `Question ${room.index + 1}. ${CLUE_LABELS[room.stage]}. ${reaction.text}` : reaction.text;
  }
}
async function roomRequest(type, answer) {
  const room = state.room;
  const { room: fresh } = await api('duel/' + room.code, {
    type, answer, index: room.index, round: room.round, confirm: room.mature
  });
  if (state.page === 'room' && state.room?.code === room.code) acceptRoom(fresh);
}
async function showRoom(room, returning = false) {
  stopRoom();
  state.page = 'room';
  state.dark = room.mature;
  acceptRoom(room, returning);
  focusScreen();
  const code = room.code;
  try {
    const current = await subscribe(code, {
      onConnect: () => { if (state.room?.code === code) { state.connected = true; refreshRoom(); } },
      onDisconnect: () => { if (state.room?.code === code) state.connected = false; },
      onMessage: () => { if (state.room?.code === code) refreshRoom(); }
    });
    if (state.room?.code === code) connection = current;
    else await current?.disconnect();
  } catch { state.connected = false; }
}
function stopRoom() {
  Promise.resolve(connection?.disconnect()).catch(() => {});
  connection = undefined;
  state.connected = false;
  state.room = null;
  if (state.waiting) {
    api('duel/queue', { cancel: true, mature: state.dark, confirm: state.dark }).catch(() => {});
    state.waiting = false;
  }
}
async function joinRoom(code, mature = false, type = 'join', returning = false) {
  try {
    const { room } = await api('duel/' + code, { type, confirm: mature });
    await showRoom(room, returning);
  } catch (error) {
    if (!mature && error.message.includes('After Dark room')) {
      darkDialog(() => joinRoom(code, true, type, returning));
      return;
    }
    throw error;
  }
}
async function refreshRoom() {
  if (refreshing || state.page !== 'room' || document.hidden) return;
  refreshing = true;
  lastPoll = Date.now();
  try { await roomRequest('view'); }
  catch (error) { if (!state.busy) flash(error.message); }
  finally { refreshing = false; }
}
function updateClock() {
  const clock = document.querySelector('#clock');
  if (!clock || !state.room?.deadline) return;
  const left = Math.max(0, state.room.deadline - Date.now() - state.offset);
  clock.textContent = Math.ceil(left / 1000) + 's';
  const hintDue = state.room.phase === 'open' && state.room.stage === 0 && left <= 16_000;
  if ((left <= 0 || hintDue) && Date.now() - deadlinePoll > 800) {
    deadlinePoll = Date.now();
    refreshRoom();
  }
}
async function queue(poll = false) {
  const mature = state.dark;
  const result = await api('duel/queue', { mature, confirm: mature, poll });
  if (state.page !== 'duels' || (poll && !state.waiting)) return;
  if (result.code) await joinRoom(result.code, mature, 'view');
  else if (!state.waiting) { state.waiting = true; renderDuels(); }
}
async function refreshHub() {
  if (state.page !== 'duels' || document.hidden || document.activeElement?.closest('form')) return;
  const result = await api('duel');
  if (state.page === 'duels' && JSON.stringify(result) !== JSON.stringify(state.hub)) {
    state.hub = result;
    renderDuels();
  }
}

function openDialog(title, content) {
  dialog.className = '';
  dialog.innerHTML = `<h2 id="dialog-title">${title}</h2>${content}<form method="dialog"><button class="action">Close</button></form>`;
  dialog.showModal();
}
function hasSeenPip() {
  try { return state.metPip || localStorage.getItem('sybk:met-pip') === 'yes'; }
  catch { return state.metPip; }
}
function pipIntro() {
  const silhouette = state.solo.question?.hint.kind === 'silhouette';
  dialog.className = 'pip-intro';
  dialog.innerHTML = `<img src="${art('pip')}" alt="">
    <div><span class="host-name">Pip · Your host</span><h2 id="dialog-title">Yo! You’re on.</h2>
    <p>${silhouette ? 'I’ll kill the lights. You get one guess at the meme. Ask me for a free clue if you get stuck.' : 'I’ve got five clips for you. You get one guess per clip, and I’ve got a free clue if you need it.'}</p>
    <form method="dialog"><button class="action gold" autofocus>Roll the first clue</button></form></div>`;
  dialog.showModal();
}
dialog.addEventListener('close', () => {
  if (!dialog.classList.contains('pip-intro')) return;
  state.metPip = true;
  try { localStorage.setItem('sybk:met-pip', 'yes'); } catch { /* The coach is dismissed for this session. */ }
});
function darkDialog(callback) {
  openDialog('After Dark · 18+', '<p>Uncensored language, sexual jokes, and late-night political and religious satire. Available to Reddit accounts with 18+ content enabled.</p>' + button('Enter After Dark', 'confirm-dark', 'gold'));
  state.confirmDark = callback;
}
function activeQuestion() {
  if (state.page === 'room') return state.room.question ?? state.room.results.at(-1);
  return state.solo?.question ?? state.solo?.results.at(-1);
}
function playAudio() {
  const notes = activeQuestion()?.hint?.notes;
  if (!notes) return;
  audioContext ??= new AudioContext();
  audioContext.resume();
  notes.forEach((note, index) => {
    const start = audioContext.currentTime + 0.02 + index * 0.25;
    const end = start + (index === notes.length - 1 ? 0.36 : 0.16);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(note, start);
    gain.gain.setValueAtTime(0.05, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(end);
  });
}
function tileAt(position) {
  if (state.selection === position) state.selection = null;
  else if (state.selection === null) state.selection = position;
  else {
    [state.tiles[position], state.tiles[state.selection]] = [state.tiles[state.selection], state.tiles[position]];
    state.selection = null;
  }
  renderSolo();
  announcer.textContent = screen.querySelector('.speech p').textContent;
  screen.querySelector(`[data-act="tile"][data-value="${position}"]`)?.focus({ preventScroll: true });
}
async function copy(text, confirmation) {
  await navigator.clipboard.writeText(text);
  flash(confirmation);
}
const actions = {
  daily: () => openSolo(), duels: () => openDuels(), ranks: () => openRanks(),
  today: () => openRanks(), week: () => openRanks('week'),
  guess: (el) => playSolo('answer', { choice: el.dataset.value }),
  hint: () => playSolo('hint'), trade: () => playSolo('trade'), skip: () => playSolo('skip'), next: () => playSolo('next'),
  audio: playAudio, tile: (el) => tileAt(Number(el.dataset.value)),
  'check-tiles': () => playSolo('answer', { tiles: state.tiles }),
  queue: () => queue(),
  cancel: async () => {
    await api('duel/queue', { cancel: true, mature: state.dark, confirm: state.dark });
    state.waiting = false;
    renderDuels();
  },
  'open-invite': (el) => { state.invite = el.dataset.value; return renderInvite(); },
  'accept-invite': (el) => joinRoom(el.dataset.value),
  'dismiss-invite': async (el) => {
    await api('duel/inbox', { code: el.dataset.value });
    await refreshHub();
  },
  rejoin: (el) => joinRoom(el.dataset.value, state.dark, 'view', true),
  ready: () => roomRequest('ready'), buzz: () => roomRequest('buzz'), 'duel-trade': () => roomRequest('trade'),
  'duel-answer': (el) => roomRequest('answer', { choice: el.dataset.value }),
  rematch: () => roomRequest('rematch'), share: () => shareRoom(state.room.code, state.room.mature).then(() => { if (local) flash('Challenge link copied.'); }),
  'copy-code': () => copy(state.room.code, 'Room code copied.'),
  'copy-score': () => copy(`SYBK · ${state.solo.score}/500 · ` + state.solo.results.map(({ points }) => points === 100 ? '🟨' : points ? '🟩' : '⬜').join(''), 'Result copied.'),
  theme: async () => {
    const ballot = await api('theme');
    openDialog('Choose the weekend theme', `<p>Next featured set · ${clean(ballot.date)}</p><div class="theme-choices">${ballot.choices.map((entry) =>
      button(`${clean(entry.name)} · ${entry.votes}${ballot.choice === entry.id ? ' (your pick)' : ''}`, 'vote-theme', ballot.choice === entry.id ? 'gold' : '', `data-value="${clean(entry.id)}"`)).join('')}</div>`);
  },
  'vote-theme': async (el) => {
    await api('theme', { date: state.soloDate, choice: el.dataset.value });
    dialog.close();
    flash('Theme vote saved.');
  },
  'leave-confirm': () => openDialog('Leave this duel?', '<p>This closes the room for both players.</p>' + button('Leave room', 'leave', 'gold')),
  leave: async () => { dialog.close(); await roomRequest('leave'); await openDuels(); },
  practice: () => openDialog('Pip’s soundcheck', '<p>Hit the buzzer to claim the floor. I’ll give you a practice clue before you go live.</p>' + button('BUZZ', 'practice-buzz', 'buzzer')),
  'practice-buzz': () => { dialog.close(); openDialog('You have the floor', '<p>Finish the phrase “We’re so ____.”</p>' + guessForm('practice-guess', false)); },
  'regular-duel': () => openDuels(false),
  dark: () => darkDialog(state.page === 'duels' ? () => openDuels(true) : () => openSolo(true)),
  'confirm-dark': () => { dialog.close(); return state.confirmDark(); },
  help: () => openDialog('How to play', '<p><strong>Daily Solo.</strong> You get one guess per question. Pip’s first hint is free, so a correct guess still earns 100. Trading 30 points for a stronger hint makes that question worth 70.</p><p><strong>Buzzer Duel.</strong> A free clue drops for both of you after eight seconds. Buzz to get one guess. Once you have the floor, you can trade 30 points for a private hint. A miss gives the other player a chance to steal.</p>'),
  report: () => {
    state.reportQuestion = activeQuestion()?.id;
    openDialog('Report this clue', ['Content', 'Wrong answer', 'Broken clue'].map((reason) =>
      button(reason, 'send-report', '', `data-value="${reason}"`)).join(' '));
  },
  'send-report': async (el) => {
    await api('report', { question: state.reportQuestion, reason: el.dataset.value });
    dialog.close();
    flash('Clue reported.');
  },
  retry: boot
};
async function renderInvite() {
  state.page = 'invite';
  const code = state.invite;
  let details;
  try { details = await api('duel/preview/' + encodeURIComponent(code)); }
  catch { details = null; }
  if (state.page !== 'invite' || state.invite !== code) return;
  paint(`<div class="stage-heading"><h1 tabindex="-1">Duel challenge</h1></div>
    ${host(details ? 'Someone wants the smoke.' : 'Today’s clues are still on the air.')}
    <section class="paper"><h2>${details ? 'u/' + clean(details.host) + ' challenged you' : 'Challenge unavailable'}</h2>
    <p>${details ? 'Room ' + clean(code) + (details.mature ? ' · After Dark (18+)' : '') : 'This room is unavailable for your account.'}</p><div class="actions">
    ${details ? button('Accept challenge', 'accept-invite', 'gold', `data-value="${clean(code)}"`) : ''}${button('Play today’s round', 'daily')}</div></section>`, 'duel');
  focusScreen();
}
async function doAction(handler, buttonEl) {
  if (state.busy) return;
  state.busy = true;
  try { await handler(buttonEl); }
  catch (error) { flash(error.message || 'Try again.'); }
  finally { state.busy = false; }
}
document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled || !actions[el.dataset.act]) return;
  doAction(actions[el.dataset.act], el);
});
document.addEventListener('submit', (event) => {
  const type = event.target.dataset.form;
  if (!type) return;
  event.preventDefault();
  const values = new FormData(event.target);
  doAction(async () => {
    if (['guess', 'duel-guess', 'practice-guess'].includes(type)) {
      const answer = { text: values.get('text').trim() };
      if (!answer.text) { event.target.querySelector('input').focus(); return; }
      if (type === 'guess') await playSolo('answer', answer);
      if (type === 'duel-guess') await roomRequest('answer', answer);
      if (type === 'practice-guess') {
        const hit = /^back[.!]?$/i.test(answer.text);
        dialog.close();
        openDialog(hit ? 'Pip says you’re ready!' : 'Pip calls a steal!', hit
          ? '<p>We’re so back. That would’ve scored in a real duel.</p>'
          : '<p>The answer was “back.” In a real duel, the other player would get a chance to buzz.</p>');
      }
    }
    if (type === 'join') await joinRoom(values.get('code'), state.dark);
    if (type === 'create') {
      const target = values.get('target');
      const reply = await api('duel/create', { target, mature: state.dark, confirm: state.dark });
      await showRoom(reply.room);
      if (reply.delivered) flash('Challenge sent to their in-game inbox.');
    }
  });
});
document.addEventListener('change', (event) => {
  if (event.target.dataset.setting !== 'invites') return;
  doAction(async () => {
    const { accepts } = await api('duel/preferences', { accepts: event.target.checked });
    state.hub.accepts = accepts;
  });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshRoom(); });
setInterval(() => {
  const stamp = Date.now();
  if (state.page === 'room') {
    updateClock();
    if (stamp - lastPoll > (state.connected ? 4200 : 650)) refreshRoom();
  }
  if (state.page === 'duels' && !state.busy && !document.hidden && stamp - lastInbox > (state.waiting ? 1400 : 5000)) {
    lastInbox = stamp;
    if (state.waiting) doAction(() => queue(true));
    else if (state.boot.signedIn) refreshHub().catch(() => {});
  }
}, 220);
async function boot() {
  try {
    state.boot = await api('bootstrap');
    if (state.invite) await renderInvite();
    else await openSolo();
  } catch {
    paint(`<div class="boot"><img src="${art('pip')}" alt=""><h1>Couldn’t load the stage.</h1>${button('Try again', 'retry', 'gold')}</div>`, 'solo');
  }
}
boot();
