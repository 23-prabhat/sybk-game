import { api, openGame, sharedCode } from './transport.js';

const launch = document.querySelector('#launch');
const label = launch.firstChild;
launch.addEventListener('click', openGame);
const invite = sharedCode();
if (invite) label.textContent = 'Open challenge ';
else api('bootstrap').then(({ progress, archived }) => {
  if (progress?.phase === 'complete') label.textContent = 'View results ';
  else if (progress) label.textContent = 'Resume round ';
  else if (archived) label.textContent = 'Play archive round ';
}).catch(() => {});
