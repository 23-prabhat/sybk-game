import { HINT_COST, QUESTION_POINTS, dailyPack, duelPack, gradeAnswer, pinnedDailyPack, publicQuestion, questionFor, revealDetails } from './content.js';

const questionPoints = (traded) => QUESTION_POINTS - (traded ? HINT_COST : 0);

export function newSolo(date, mature, theme, pinned) {
  const pack = (!mature && pinnedDailyPack(pinned)) || dailyPack(date, mature, theme);
  return { pack, index: 0, stage: 0, score: 0, results: [], phase: 'clue', version: 0 };
}

export function soloAction(run, action) {
  if (action?.version !== run.version || run.phase === 'complete') return run;
  const type = action.type;
  const version = run.version + 1;
  if (type === 'next' && run.phase === 'reveal') {
    if (run.index + 1 === run.pack.length) return { ...run, phase: 'complete', version };
    return { ...run, index: run.index + 1, stage: 0, phase: 'clue', version };
  }
  if (run.phase !== 'clue') return run;
  if (type === 'hint' && run.stage === 0) return { ...run, stage: 1, version };
  if (type === 'trade' && run.stage === 1) return { ...run, stage: 2, version };
  if (!['answer', 'skip'].includes(type)) return run;
  const question = questionFor(run.pack[run.index]);
  const correct = type === 'skip' ? false : gradeAnswer(question, run.stage, action.answer, 'solo');
  if (correct === null) return run;
  const points = correct ? questionPoints(run.stage === 2) : 0;
  const outcome = correct ? 'correct' : type === 'skip' ? 'skip' : 'miss';
  return {
    ...run, version, phase: 'reveal', score: run.score + points,
    results: [...run.results, { ...revealDetails(question), points, hintStage: run.stage, outcome }]
  };
}

export function soloView(run) {
  const { index, stage, score, version, phase, results } = run;
  return {
    index, stage, score, version, phase, results, count: run.pack.length,
    availablePoints: questionPoints(stage === 2), hintCost: HINT_COST,
    question: phase === 'clue' ? publicQuestion(questionFor(run.pack[index]), stage, 'solo', true) : null
  };
}

const countdownMs = 3_000;
const buzzMs = 24_000;
const freeHintMs = 8_000;
const answerMs = 7_000;
const revealMs = 3_500;
const silhouetteRevealMs = 5_000;
export const roomIdleMs = 15 * 60_000;

export function newRoom(code, host, mature, now, invited = null) {
  return {
    code, mature, invited, pack: duelPack(mature), phase: 'lobby',
    players: [{ ...host, ready: false, score: 0 }], index: 0, stage: 0, revision: 0,
    attempts: [], results: [], createdAt: now, touchedAt: now, deadline: null, round: 1
  };
}

export function admit(room, player, now) {
  if (room.players.some(({ id }) => id === player.id)) return room;
  if (room.phase !== 'lobby' || room.players.length > 1 || (room.invited && room.invited !== player.id)) return room;
  return revised(room, { players: [...room.players, { ...player, ready: false, score: 0 }] }, now);
}

function revised(room, change, now) {
  return { ...room, ...change, touchedAt: now, revision: room.revision + 1 };
}

function reveal(room, now, player = null) {
  const question = questionFor(room.pack[room.index]);
  const points = player ? questionPoints(room.traded === true) : 0;
  const hintStage = room.traded ? 2 : Math.min(1, room.stage);
  return revised(room, {
    phase: 'reveal', claim: null, deadline: now + (question.revealArt ? silhouetteRevealMs : revealMs),
    players: room.players.map((entry) => entry.id === player ? { ...entry, score: entry.score + points } : entry),
    results: [...room.results, { ...revealDetails(question), player, points, hintStage }]
  }, now);
}

function miss(room, now) {
  if (room.attempts.length === room.players.length || room.remaining <= 0) return reveal(room, now);
  return revised(room, {
    phase: 'open', claim: null, deadline: now + room.remaining, lastMiss: true, traded: false
  }, now);
}

function openRound(room, now, index) {
  return revised(room, {
    phase: 'open', deadline: now + buzzMs, index, stage: 0, attempts: [], lastMiss: false, claim: null, traded: false
  }, now);
}

export function advanceRoom(room, now) {
  if (['complete', 'closed'].includes(room.phase)) return room;
  if (now - room.touchedAt >= roomIdleMs) return revised(room, { phase: 'closed', deadline: null }, now);
  if (room.deadline !== null && now >= room.deadline) {
    if (room.phase === 'countdown') return openRound(room, now, 0);
    if (room.phase === 'open') return reveal(room, now);
    if (room.phase === 'answering') return miss(room, now);
    if (room.index + 1 < room.pack.length) return openRound(room, now, room.index + 1);
    return revised(room, { phase: 'complete', deadline: null, players: room.players.map((player) => ({ ...player, ready: false })) }, now);
  }
  if (room.phase === 'open' && room.stage === 0 && room.deadline - now <= buzzMs - freeHintMs) {
    return revised(room, { stage: 1 }, now);
  }
  return room;
}

export function roomAction(room, userId, action, now) {
  const player = room.players.find(({ id }) => id === userId);
  if (!player || !action) return room;
  const type = action.type;
  if (type === 'leave' && !['closed', 'complete'].includes(room.phase)) {
    return revised(room, { phase: 'closed', deadline: null }, now);
  }
  if ((type === 'ready' && room.phase === 'lobby') || (type === 'rematch' && room.phase === 'complete')) {
    if (player.ready || action.round !== room.round) return room;
    const players = room.players.map((entry) => entry.id === userId ? { ...entry, ready: true } : entry);
    if (players.length < 2 || !players.every((entry) => entry.ready)) return revised(room, { players }, now);
    return revised(room, {
      players: players.map((entry) => ({ ...entry, score: 0 })), phase: 'countdown', deadline: now + countdownMs,
      index: 0, stage: 0, attempts: [], results: [], lastMiss: false, traded: false,
      pack: type === 'rematch' ? duelPack(room.mature) : room.pack,
      round: type === 'rematch' ? room.round + 1 : room.round
    }, now);
  }
  if (action.index !== room.index || action.round !== room.round) return room;
  const question = questionFor(room.pack[room.index]);
  if (type === 'buzz' && room.phase === 'open' && !room.attempts.includes(userId)) {
    const time = question.typedFirst ? 12_000 : answerMs;
    return revised(room, {
      phase: 'answering', claim: userId, remaining: room.deadline - now, deadline: now + time, answerTime: time / 1000,
      attempts: [...room.attempts, userId]
    }, now);
  }
  if (room.phase !== 'answering' || room.claim !== userId) return room;
  if (type === 'trade' && !room.traded) return revised(room, { traded: true }, now);
  if (type !== 'answer') return room;
  const grade = gradeAnswer(question, room.traded ? 2 : Math.min(1, room.stage), action.answer, 'duel');
  if (grade !== null) return grade ? reveal(room, now, userId) : miss(room, now);
  return room;
}

export function roomView(room, userId, now) {
  const { code, phase, index, deadline, revision, round, claim, results, mature } = room;
  const yours = claim === userId;
  const traded = yours && room.traded === true;
  const stage = traded ? 2 : Math.min(1, room.stage);
  const question = ['open', 'answering'].includes(phase)
    ? publicQuestion(questionFor(room.pack[index]), stage, 'duel', phase === 'answering' && claim === userId) : null;
  const players = room.players.map(({ id, name, ready, score }) => ({ you: id === userId, name, ready, score }));
  return {
    code, phase, stage, index, deadline, serverNow: now, revision, round, mature, players, question, count: room.pack.length,
    answerTime: phase === 'answering' ? room.answerTime ?? answerMs / 1000 : null,
    yours, canBuzz: phase === 'open' && !room.attempts.includes(userId),
    availablePoints: questionPoints(traded), hintCost: HINT_COST,
    steal: room.lastMiss, invited: Boolean(room.invited),
    results: results.map(({ player, ...entry }) => ({
      ...entry, player: players[room.players.findIndex(({ id }) => id === player)]?.name ?? null, you: player === userId
    }))
  };
}
