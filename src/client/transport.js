import * as devvit from '@devvit/web/client';

export const query = new URLSearchParams(location.search);
export const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
export const player = query.get('player');
export async function api(path, body) {
  const headers = {};
  if (local && player) headers['X-SYBK-Preview-Player'] = player;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reach the stage.');
  return data;
}
export function openGame(event) {
  if (local) {
    location.href = './index.html' + location.search;
    return;
  }
  devvit.requestExpandedMode(event, 'game', { title: 'SYBK · Show Your Ball Knowledge' });
}
export function sharedCode() {
  if (local) return query.get('room');
  try { return JSON.parse(devvit.getShareData() || 'null')?.room; }
  catch { return null; }
}
export async function shareRoom(code, mature) {
  if (local) {
    const link = new URL('index.html', location.href);
    link.searchParams.set('room', code);
    return navigator.clipboard.writeText(link.href);
  }
  await devvit.showShareSheet({
    title: 'SYBK Live Duel',
    text: `Buzz in against me on SYBK${mature ? ' · After Dark (18+)' : ''}. Room code ${code}.`,
    data: JSON.stringify({ room: code })
  });
}
export function subscribe(code, callbacks) {
  if (local) return Promise.resolve();
  return devvit.connectRealtime({ channel: 'sybk-' + code, ...callbacks });
}
