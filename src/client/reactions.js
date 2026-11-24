const firstHits = [
  'YOO! First hit. You knew that frame cold.',
  'First hit! You clocked that instantly.',
  'No extra hints. Straight to 100.',
  'One look, one hit. That’s elite ball knowledge.',
  'First hit on the closer! Save the replay.'
];
const hintHits = [
  'That extra clue did it. You’re on the board.',
  'Yup, that’s it. You put the clues together.',
  'You got there. That one had layers.'
];
const nextQuestions = [
  'What’s your read on this one?',
  'Look closely. The internet has receipts.',
  'Let’s see how deep your feed goes.',
  'Lock in your guess when you’ve got it.'
];
const firstHit = (result) => result?.points === 100 && !result.hintStage;

export function soloReaction(run, returning = false) {
  const { phase, results, index, stage, score, count, question } = run;
  if (returning) {
    if (phase === 'complete') return { text: 'Yo, welcome back. Your scorecard’s right here.', mood: 'warm' };
    if (phase === 'reveal') return { ...soloReaction(run), text: 'Yo, welcome back. We were just looking at your last answer.', mood: 'warm' };
    return { text: `Yo, welcome back! Question ${index + 1} is still yours.`, mood: 'warm' };
  }
  if (phase === 'complete') {
    if (score === count * 100) return { text: 'A perfect card. Full points on every clue. You ran the whole show.', mood: 'hype' };
    if (score >= 350) return { text: 'Scorecard’s in. That’s a run worth sending to the group chat.', mood: 'hype' };
    return { text: 'That’s a wrap! Come back tomorrow and beat your card.', mood: 'warm' };
  }
  if (phase === 'reveal') {
    const result = results.at(-1);
    if (firstHit(result)) {
      let streak = 0;
      for (let i = results.length - 1; i >= 0 && firstHit(results[i]); i -= 1) streak += 1;
      return {
        stamp: streak > 1 ? `First-hit streak ×${streak}` : 'First hit',
        text: streak > 1 ? `${streak} first hits in a row. Who let you cook?` : firstHits[index % firstHits.length],
        mood: 'hype'
      };
    }
    if (result?.points === 100) return { text: 'You got it! Free clue, full points.', mood: 'hype' };
    if (result?.points > 0) return { text: hintHits[index % hintHits.length], mood: 'hype' };
    return result?.outcome === 'skip'
      ? { text: 'Calling it a skip? Here’s the reveal.', mood: 'warm' }
      : { text: 'Swing and a miss. Here comes the reveal.', mood: 'miss' };
  }
  if (stage === 1) return { text: 'Here’s your free nudge. Full points are still on the table.', mood: 'warm' };
  if (stage === 2) return { text: 'Deal. I’ve put up the stronger clue. Make your one guess count.', mood: 'warm' };
  if (question?.hint.kind === 'tile') return { text: 'The clip came in scrambled. Tap two pieces to swap them, then let me check it.', mood: 'focus' };
  if (question?.hint.kind === 'silhouette') {
    return { text: index === 0 ? 'Yo! Lights down. Can you name that silhouette?' : 'Lights out again. Take a shot from the outline.', mood: 'focus' };
  }
  if (index === 0) return { text: 'Yo, welcome to SYBK! You get one shot. Want a free nudge?', mood: 'warm' };
  return { text: nextQuestions[(index - 1) % nextQuestions.length], mood: 'focus' };
}

export function duelReaction(room, returning = false) {
  if (returning && room.phase !== 'closed') return { text: 'Yo, welcome back to the duel!', mood: 'warm' };
  switch (room.phase) {
    case 'lobby':
      return { text: room.players.length < 2 ? 'Get your rival in here. I’ve got five clues ready.' : 'Both players are here. Hit Ready when you’re locked in.', mood: 'warm' };
    case 'countdown': return { text: 'Hands on the buzzer. We’re live in three!', mood: 'focus' };
    case 'answering': return room.yours
      ? { text: room.stage === 2 ? 'Deal. Here’s your private hint. The clock’s still ticking!' : 'You have the floor. One guess. Lock it in before the clock runs out!', mood: 'hype' }
      : { text: 'Your opponent has the floor. Be ready for the steal.', mood: 'focus' };
    case 'open':
      if (room.steal) return room.canBuzz
        ? { text: 'Steal! They missed. Hit that buzzer!', mood: 'hype' }
        : { text: 'Missed it! They have the steal now.', mood: 'miss' };
      return { text: room.stage ? 'Free clue just dropped. Full points are still up for grabs.' : room.question?.hint.kind === 'silhouette' ? 'The lights are down. Buzz when you know the shape.' : 'Buzz if you know it!', mood: 'focus' };
    case 'reveal': {
      const result = room.results.at(-1);
      if (!result?.player) return { text: 'Nobody caught that one. Here’s the reveal.', mood: 'miss' };
      if (!result.you) return { text: 'They scored that one. Next clue, eyes up.', mood: 'focus' };
      if (room.steal) return { text: 'You stole it! That’s going on the highlight reel.', mood: 'hype', stamp: 'Steal' };
      const you = room.players.find((player) => player.you);
      const rival = room.players.find((player) => !player.you);
      if (you.score - result.points < rival.score && you.score >= rival.score) {
        return {
          text: you.score === rival.score ? 'YOO, you tied it up! We’re so back.' : 'YOO, you just took the lead! We’re so back.',
          mood: 'hype',
          stamp: 'Comeback'
        };
      }
      return firstHit(result)
        ? { text: 'First hit! You buzzed and nailed it.', mood: 'hype', stamp: 'First hit' }
        : { text: 'Locked in and on the board.', mood: 'hype' };
    }
    case 'complete': {
      const you = room.players.find((player) => player.you);
      const rival = room.players.find((player) => !player.you);
      if (you.score === rival.score) return { text: 'Dead even. Run it back?', mood: 'warm' };
      return you.score > rival.score
        ? { text: 'YOO! That’s your W. You own the highlight reel.', mood: 'hype' }
        : { text: 'They took this one. You want the rematch?', mood: 'warm' };
    }
    default: return { text: 'That room has closed. I’ll see you in the next one.', mood: 'warm' };
  }
}
