const line = (text) => ({ kind: 'text', text });
const quote = (text) => ({ kind: 'quote', text });
const emoji = (text, alt) => ({ kind: 'emoji', text, alt });
const image = (art, alt, zoom = 1) => ({ kind: 'image', art, alt, zoom });
const frames = (art, alt) => ({ kind: 'frames', art, alt });
const audio = (notes, alt) => ({ kind: 'audio', notes, alt });
const video = (clip, art, alt) => ({ kind: 'video', clip, art, alt });

function card(id, category, answer, decoys, hints, note, extra = {}) {
  return { id, category, answer, choices: [answer, ...decoys], hints, note, ...extra };
}

const cinema = image('cinema', 'An audience member throws both hands up in front of a cinema screen.');
const fire = (zoom = 1) => image('fire', 'A calm pigeon sits beside a hot drink while the room burns.', zoom);
const cook = image('cook', 'A chef presents a smoking laptop on a plate.');
const debate = image('debate', 'Two people at debate podiums with their microphone cords tangled.');
const chapel = image('chapel', 'A robed figure greets a cat beneath stained-glass windows.');
const anime = image('anime', 'An animated student sprints with toast hanging from their mouth.');
const goose = image('goose', 'Three goose heads wearing caps and one body in sandals.');
const sports = image('sports', 'A pigeon discusses highlights near a basketball hoop.');
const night = image('night', 'Two fully clothed adults at a late-night kitchen table, with one sock and a buzzing phone.');

const general = [
  card('fine', 'Certified classic', 'This is fine', ['Let him cook', 'Everything is awesome', 'We’re so back'],
    [fire(2), fire(), quote('This is _____.')], 'The reaction for calmly insisting everything is normal while things are visibly on fire.', { aliases: ['this is fine.'] }),
  card('parliament', 'Politics', 'The filibuster', ['A recount', 'The exit poll', 'A landslide'],
    [debate, line('Someone keeps talking so the vote can’t happen.'), quote('The longest possible “I’ll keep this brief.”')], 'A filibuster is the joke when a committee meeting starts to feel like an endurance sport.'),
  card('toast', 'Anime', 'Late for school with toast', ['The training arc', 'The tournament arc', 'The beach episode'],
    [video('arrival', 'anime', anime.alt), emoji('🍞 🏃 🏫', 'Toast, runner, school'), line('What trope combines breakfast with sprinting out the door?')], 'A classic anime shorthand for a chaotic morning and the start of a new story.'),
  card('cooked', 'Deep fried', 'Let him cook', ['Touch grass', 'Ship it', 'This is fine'],
    [cook, line('Give them time to finish their suspiciously ambitious plan.'), quote('Let him ____.')], 'You use it to give someone the floor and see where their idea goes.'),
  card('cinema', 'Reaction image', 'Absolute cinema', ['Peak fiction', 'Directed by Michael Bay', 'In the credits'],
    [{ ...cinema, kind: 'tile', tiles: [2, 0, 3, 1] }, cinema, quote('Absolute ______.')], 'The reaction for a moment so good, dramatic or ridiculous it deserves a screen of its own.'),
  card('back', 'Certified classic', 'Back', ['Cooked', 'Early', 'Lost'],
    [quote('We’re so ____.'), quote('It’s so over. We’re so ____.'), line('The comeback worked. What word completes the second half?')], '“We’re so back” flips the despair of “it’s so over” into absurd optimism.'),
  card('canon', 'Fandom', 'Canon event', ['Post-credit scene', 'Unreliable narrator', 'The tournament arc'],
    [frames('anime', 'Three zoom levels show the protagonist racing through the same unavoidable late morning.'), line('The friend group agrees they need this embarrassing experience for character development.'), quote('I can’t interfere. It’s a _____ event.')], 'A canon event became shorthand for a formative mistake everyone has to make themselves.'),
  card('thoughts', 'Politics', 'Thoughts and prayers', ['Strongly worded letter', 'A motion to adjourn', 'An exit poll'],
    [image('debate', 'People at a televised debate in front of cameras.'), line('The press office sends sympathy while announcing zero concrete action.'), quote('Thoughts and _______.')], 'Meme captions use the phrase to satirize performative responses.'),
  card('prayer', 'Religion', 'Prayer circle', ['Sunday best', 'The dinner bell', 'The group project'],
    [chapel, emoji('🕯️ 🕯️ 🐈 🕯️', 'Candles arranged around a cat'), line('What do fans call a group ritual for willing their favorite character back into the show?')], 'Online fandoms borrow the phrase for a hopeful ritual over things they cannot control.'),
  card('horn', 'Sports', 'Air horn', ['The halftime whistle', 'A referee review', 'A sad trombone'],
    [audio([390, 375, 390], 'Three sharp, brassy blasts, two short and one long.'), sports, line('Three loud blasts used to hype up a sports highlight.')], 'The quick brassy sound became a staple of exaggerated highlight edits.'),
  card('grass', 'Internet etiquette', 'Touch grass', ['Log off forever', 'Get real', 'Chase the sun'],
    [emoji('🤚 🌱', 'An open hand and a green sprout'), line('Your replies suggest leaving your keyboard and getting outside.'), quote('Touch _____.')], 'An instruction to reconnect with the physical world after too much time online.'),
  card('brainrot', 'Deep fried', 'Italian brainrot', ['Goose game', 'Gymcel arc', 'NPC stream'],
    [goose, frames('goose', 'The same surreal three-headed goose shown from tight crop to full body.'), line('Name the genre of surreal animal mashups and sing-song nonsense names.')], 'Surreal animals, unlikely props, and rhythmically silly names are the format’s signature.'),
  card('batman', 'Desi internet', 'Aayein? Baigan.', ['Paisa hi paisa hoga', 'Moye moye', 'Rasode mein kaun tha'],
    [emoji('❓ 🍆', 'A question mark and an eggplant'), line('A blank reaction followed by the Hindi word for eggplant.'), quote('Aayein? ______.')], 'A classic format for responding to a question with pure, deadpan confusion.', { aliases: ['aayein baigan', 'aayein? baigan', 'baigan', 'baingan'] }),
  card('replay', 'Sports', 'Ball don’t lie', ['The floor is lava', 'Bring the noise', 'Generational talent'],
    [sports, line('A disputed call is followed by a missed free throw. What does the internet say?'), quote('Ball don’t ___.')], 'The phrase turns a missed shot into the universe’s unofficial review of a bad call.', { aliases: ["ball don't lie", 'ball dont lie'] }),
  card('divine', 'Religion', 'Divine intervention', ['Sunday best', 'Last rites', 'A blessing in disguise'],
    [chapel, line('The final boss freezes at one HP exactly as your controller dies.'), line('Two words for an outcome so lucky it feels like higher powers stepped in.')], 'It’s a playful way to credit impossible luck with a little help from above.'),
  card('patch', 'Deep cut', 'Works on my machine', ['Have you tried turning it off?', 'Ship it', 'Just clear your cache'],
    [cook, line('A developer swears the bug only happens on everyone else’s computer.'), quote('Works on my _______.')], 'The classic excuse that gives a production outage a punchline.', { prompt: 'What does the developer say?' }),
  card('resume', 'Politics', 'The spin room', ['A polling booth', 'The ballot box', 'The campaign trail'],
    [debate, line('The debate just ended and every spokesperson is explaining why their side clearly won.'), quote('The ____ room.')], 'The backstage press scrum is a reliable template for rewriting what just happened.'),
  card('orange', 'Fandom', 'Filler episode', ['The pilot', 'The recap', 'The spin-off'],
    [anime, line('The big arc is on hold while the cast spends a whole episode doing laundry.'), quote('_____ episode.')], 'Fans use this for a detour that pauses the main plot, sometimes affectionately.'),
  card('rot', 'Deep fried', 'Cooked', ['Locked in', 'Built different', 'Main character'],
    [emoji('🍳 💀', 'A frying pan and a skull'), line('You took a two-hour nap before the exam. The exam was two hours ago.'), quote('I’m absolutely ______.')], '“Cooked” describes a situation that is already past saving.'),
  card('goat', 'Sports', 'GOAT', ['MVP', 'GOON', 'W',],
    [emoji('🐐 🏆', 'A goat and championship trophy'), sports, line('Greatest of all time.')], 'Sports debates turned an acronym into an animal emoji you can drop anywhere.')
];

const mature = [
  card('walk', 'After Dark', 'Walk of shame', ['A five-star review', 'A hard launch', 'A booty call'],
    [night, line('Yesterday’s clothes. A long ride home. Zero questions, please.'), quote('Walk of _____.')], 'The cliché is funniest when the audience knows exactly what happened without a word.'),
  card('find-out', 'After Dark', 'Fuck around and find out', ['Read the fine print', 'No one asked', 'We are so back'],
    [debate, line('Four words for the consequences arriving right on schedule.'), quote('Fuck around and ____ ___.')], 'The internet’s shortest warning label for a deeply avoidable outcome.', { aliases: ['fafo', 'fuck around find out'] }),
  card('thirst', 'After Dark', 'Thirst trap', ['Soft block', 'Hard launch', 'Close friends'],
    [emoji('🥵 📸', 'Overheated face and camera'), line('You call it good lighting. Everyone else knows exactly what you posted it for.'), quote('Thirst ____.')], 'A deliberately attention-grabbing post with strong plausible deniability.'),
  card('damned', 'After Dark · Religion', 'Straight to hell', ['Divine intervention', 'Bless this mess', 'Confession booth'],
    [chapel, line('What the group chat says after everyone laughs at the same wildly inappropriate joke.'), quote('Straight to ____.')], 'A familiar exaggerated reaction to laughing at something you know you shouldn’t.'),
  card('delete', 'After Dark', 'Post-nut clarity', ['Main character syndrome', 'Plot armor', 'Executive dysfunction'],
    [night, line('The late-night decision starts looking pretty damn different once the attraction wears off.'), quote('Post-nut ______.')], 'Adult slang for the abrupt moment when desire gives way to clear-headed judgment.'),
  card('mess', 'After Dark · Politics', 'Clusterfuck', ['Spin room', 'Damage control', 'Landslide'],
    [debate, line('Six spokespeople, three microphones, two overlapping apologies, and one very bad day.'), quote('An absolute cluster____.')], 'A blunt label for many small disasters happening together.')
];

const live = [
  card('plot-armor', 'Anime', 'Plot armor', ['Training montage', 'Time skip', 'Filler arc'],
    [frames('anime', 'Three increasingly wide views of a hero dashing through town.'), line('The protagonist survived a ridiculous fall because the story still needs them.'), quote('Plot _____.')], 'A joke about being too important to the story to get hurt.'),
  card('grass-live', 'Internet etiquette', 'Terminally online', ['Lurking', 'Doomscrolling', 'AFK'],
    [emoji('🛏️ 💻 📱', 'A bed, laptop and phone'), line('You know every comment thread in the dispute and missed your own birthday.'), quote('Terminally ______.')], 'This joke describes a life lived excessively through internet arguments.'),
  card('sad-horn', 'Sound bite', 'Sad trombone', ['Air horn', 'Goal horn', 'Referee whistle'],
    [audio([277, 233, 196], 'Three descending brass notes.'), line('The horns play when someone’s big plan collapses in public.'), quote('Sad ________.')], 'A falling brass phrase that turns a small failure into a punchline.'),
  card('booked', 'Religion', 'Biblically accurate angel', ['Guardian angel', 'A fallen angel', 'House of worship'],
    [goose, line('Internet comments say an unsettling many-eyed design looks more convincing than a cherub.'), quote('Biblically accurate _____.')], 'The caption pairs an uncanny design with a reference to unusual angel descriptions.'),
  card('kitchen-live', 'Certified classic', 'Chef’s kiss', ['Let him cook', 'Works on my machine', 'Take a bow'],
    [cook, emoji('👨‍🍳 🤌 💋', 'Chef, pinched fingers and a kiss'), line('Name the gesture used to say a detail is absolutely perfect.')], 'A small theatrical gesture for approving something especially well executed.'),
  card('debate-live', 'Politics', 'Debate bingo', ['Swing state', 'Exit poll', 'Speechwriter'],
    [debate, line('Everyone has a grid of predictable lines and marks them off during the debate.'), quote('Debate _____.')], 'Turning repeated rhetorical moves into a watch-party game.'),
  card('reverse', 'Internet classic', 'Reverse card', ['Mission failed', 'Wild card', 'Skip turn'],
    [emoji('↩️ 🃏', 'A turning arrow and a playing card'), line('The reply throws the same insult straight back at the sender.'), quote('Hit them with the _______ card.')], 'The card-game move became a shorthand for turning a joke or accusation back around.'),
  card('reaction-live', 'Reaction image', 'Wall of text', ['Touch grass', 'Copypasta', 'Pinned comment'],
    [image('sports', 'A host points to a torn highlights sheet.'), line('A giant block of prose without a single paragraph break.'), quote('A wall of ____.')], 'Usually a reply to a post whose formatting made it feel impossible to read.')
];

const liveMature = [
  card('damn-live', 'After Dark', 'Goddamn', ['Bless you', 'Good heavens', 'No shot'],
    [chapel, line('The group chat hits one profanity when someone posts a jaw-dropping screenshot.'), quote('God____.')], 'A familiar exclamation for a surprising or ridiculous screenshot.'),
  card('booty-live', 'After Dark', 'Booty call', ['House call', 'Hard launch', 'Soft block'],
    [night, quote('“You up?” at 2 a.m.'), quote('Booty ____.')], 'A late-night message with an intent that barely needs spelling out.'),
  card('shitty-live', 'After Dark', 'Shitpost', ['Hot take', 'A press release', 'A receipt'],
    [goose, line('An intentionally absurd, low-context post whose only job is to derail a thread.'), quote('Shit____.')], 'A word for posting absurdity mostly for the reaction.'),
  card('dick-live', 'After Dark', 'Big dick energy', ['Main character syndrome', 'Stage fright', 'The talking stage'],
    [sports, line('The internet’s three-word compliment for quiet, unforced confidence.'), quote('Big ____ energy.')], 'A vulgar phrase about self-assurance and ease.'),
  card('hell-live', 'After Dark', 'Hell in a handbasket', ['A bad day at the polls', 'On thin ice', 'A spin room'],
    [fire(), line('A bleakly funny idiom for a whole situation going downhill.'), quote('Hell in a __________.')], 'A dramatic way to describe collective failure.')
];

const photo = (number, alt, zoom = 1) => ({ ...image('meme-photo-' + number, alt, zoom), photo: true });

const farmer = (zoom) => photo(1, 'A farmer in a gray cap and blue overalls stands in a field.', zoom);
const olympics = photo(2, 'An Olympic gymnast and a man in a dark suit fold their arms and make the same sideways frown.');
const lolcat = photo(3, 'A striped cat sits and stares directly at the camera on a painted street.');
const joever = photo(4, 'A man in a blue suit sits with his head down and his hand at his chin.');
const freeman = photo(5, 'A grayscale cutout portrait of Morgan Freeman looking to the left.');

const photos = [
  card('photo-farmer', 'Photo meme', 'It ain’t much, but it’s honest work', ['They’re good dogs, Brent', 'I have no idea what I’m doing', 'We have food at home'],
    [farmer(1.18), farmer(1), quote('It ain’t much, but it’s _____ work.')], 'A USDA photo of Ohio farmer David Brandt became a humble-brag reaction for getting a small job done.',
    { aliases: ['honest work', 'it aint much but its honest work'], credit: { by: 'Dianne Johnson / USDA', source: 'https://commons.wikimedia.org/wiki/File:Ohio_farmer_David_Brandt.jpg', terms: 'U.S. public domain' } }),
  card('photo-olympics', 'Sports photo', 'Not impressed', ['Absolutely speechless', 'That’s a win', 'Expectation vs. reality'],
    [olympics, line('The gymnast’s face at a medal ceremony became a reaction to underwhelming news.'), quote('Not _________.')], 'McKayla Maroney’s Olympic expression became a meme. She and Barack Obama recreated it for this White House photo.',
    { aliases: ['mckayla is not impressed'], credit: { by: 'Pete Souza / White House', source: 'https://commons.wikimedia.org/wiki/File:Barack_Obama_with_artistic_gymnastic_McKayla_Maroney_2.jpg', terms: 'U.S. public domain' } }),
  card('photo-cat', 'Old internet', 'I can has cheezburger?', ['Invisible bike', 'Keyboard Cat', 'Ceiling Cat'],
    [lolcat, line('This early LOLcat caption requests a fast-food item in deliberately broken English.'), quote('I can has _________?')], 'This 2007 example of the LOLcat format uses the catchphrase that gave the meme site its name.',
    { aliases: ['i can haz cheeseburger', 'i can has cheeseburger', 'cheezburger', 'cheeseburger'], credit: { by: 'Or Hiltch', source: 'https://commons.wikimedia.org/wiki/File:I_can_has_cheezburger.jpg', terms: 'CC BY 2.0 · Caption cropped', license: 'https://creativecommons.org/licenses/by/2.0/' } }),
  card('photo-joever', 'Politics', 'It’s Joever', ['Thanks, Obama', 'Let’s go, Joe', 'Dark Brandon'],
    [joever, line('The pun turns a U.S. politician’s first name into a way to say it’s all over.'), quote('It’s ______.')], 'Biden’s dejected pose anchors the “It’s Joever” reaction, a pun on “it’s over.”',
    { aliases: ['joever', 'its joe over'], credit: { by: 'LBJ Library', source: 'https://commons.wikimedia.org/wiki/File:Joever_meme.jpg', terms: 'U.S. public domain · Caption cropped' } })
];

const livePhoto = card('photo-true', 'Discord classic', 'True', ['Based', 'Cope', 'Real'],
  [freeman, line('The black-and-white Discord reaction uses one word to tell someone that they’re right.'), quote('Tr__.')], 'The portrait, originally photographed by Ed Campion, was adapted into Discord’s deadpan “True” reaction.',
  { credit: { by: 'Ed Campion / NASA · edit by Star Manatee', source: 'https://commons.wikimedia.org/wiki/File:Morgan_Freeman_%22true%22_meme.jpg', terms: 'CC BY 2.0 · Caption cropped', license: 'https://creativecommons.org/licenses/by/2.0/' } });

const crewCredit = {
  by: 'AI-generated meme art · compilation by DevonRex368',
  source: 'https://commons.wikimedia.org/wiki/File:Italian_brainrot_characters.png',
  terms: 'CC BY-SA 4.0 · Extracted and silhouette adapted',
  license: 'https://creativecommons.org/licenses/by-sa/4.0/'
};

function silhouette(number, category, answer, decoys, outline, nudge, last, appearance, note, aliases, credit) {
  const art = 'shadow-' + number;
  return card('shadow-' + number, category, answer, decoys, [
    { kind: 'silhouette', art, alt: outline },
    { kind: 'silhouette', art, alt: outline, text: nudge },
    { kind: 'silhouette', art, alt: outline, text: last }
  ], note, { typedFirst: true, revealArt: 'signal-' + number, revealAlt: appearance, aliases, credit });
}

const shadows = [
  silhouette(1, 'TikTok deep cut', 'Tung Tung Tung Sahur',
    ['Cappuccino Assassino', 'Brr Brr Patapim', 'Lirili Larila'],
    'A tall figure with a round head and a bat held low by its feet.',
    'Listen for the wooden drum. This one comes from Indonesian Ramadan wake-up calls.',
    'Three knocks, then the name of the pre-dawn meal.',
    'A wide-eyed wooden figure holding a bat on a street at night.',
    'The meme turns the sound of an Indonesian pre-dawn wake-up call into a wooden creature.',
    ['tung tung tung', 'tung tung sahur', 'tung tung tung suhoor', 'tung tung sahoor', 'tung tung tung sahoor', 'tung tung tung sahur anomaly'],
    { by: 'noxaasht · AI-generated image', source: 'https://commons.wikimedia.org/wiki/File:Full_image_of_Tung_Tung_Tung_Sahur.png', terms: 'Public domain where applicable · Silhouette adapted' }),
  silhouette(2, 'Viral news archive', 'Ever Given',
    ['Evergreen', 'Costa Concordia', 'Ever Forward'],
    'A long rectangular shape with a pointed end, angled diagonally.',
    'Think back to the week a tiny excavator became the internet’s project manager.',
    'Name the ship that blocked the Suez Canal in 2021. The big lettering on the side was the operator.',
    'A satellite photo of a container ship wedged diagonally between the banks of the Suez Canal.',
    'The Ever Given got stuck sideways in the Suez Canal. A tiny excavator working beside it became an image for making a tiny dent in a massive problem.',
    ['evergiven', 'the ever given', 'mv ever given', 'suez canal ship', 'suez canal blocked'],
    { by: 'NASA JSC ISS image library', source: 'https://commons.wikimedia.org/wiki/File:Ever_Given_in_Suez_Canal_viewed_from_ISS.jpg', terms: 'U.S. public domain · Cropped and silhouette adapted' }),
  silhouette(3, 'Pre-YouTube archive', 'Numa Numa',
    ['Star Wars Kid', 'Chocolate Rain', 'The Evolution of Dance'],
    'A person seated front-on, shown from the chest up.',
    'Before YouTube, Newgrounds had a webcam lip-sync to O-Zone’s Dragostea Din Tei.',
    'Name Gary Brolsma’s webcam dance. Two identical words.',
    'A photo of Gary Brolsma smiling at the camera.',
    'Gary Brolsma’s webcam dance was a Newgrounds hit. This later photo shows the person behind it.',
    ['numa numa dance', 'numa numa guy', 'gary brolsma', 'numa numa song'],
    { by: 'Andrew Baron', source: 'https://commons.wikimedia.org/wiki/File:Gary_Brolsma.jpg', terms: 'CC BY-SA 2.0 · Silhouette adapted', license: 'https://creativecommons.org/licenses/by-sa/2.0/' }),
  silhouette(4, 'Brainrot character', 'Tralalero Tralala',
    ['Bombardiro Crocodilo', 'Brr Brr Patapim', 'Boneca Ambalabu'],
    'A streamlined creature with a dorsal fin and three sneaker-shaped feet.',
    'Three sneakers. Imagine how expensive his shoe rotation is.',
    'Name the shark whose chant sounds like a sing-song “tra-la-la.”',
    'A shark wearing three bright blue sneakers on a beach.',
    'The sneaker-wearing shark is one of the recurring characters from the Italian brainrot wave.',
    ['tralalero', 'tralalero tralalà', 'tralallero trallala', 'trallallero trallalla', 'tralalero trallala', 'tralalero tralala shark'],
    crewCredit),
  silhouette(5, 'Brainrot character', 'Brr Brr Patapim',
    ['Tralalero Tralala', 'Lirili Larila', 'Frigo Camelo'],
    'A hunched figure with a long curved nose, bulky shoulders, and oversized bare feet.',
    'Look at those roots. This forest guy has the nose and feet doing all the work.',
    'His name begins with two shivers. Brr Brr…',
    'A green, long-nosed creature with tree roots and giant feet stands in a forest.',
    'The root-covered forest creature is the one with oversized feet and the two-part shiver in its name.',
    ['patapim', 'brr brr patapim', 'br br patapim', 'brr brr patapin', 'brrbrrpatapim'],
    crewCredit),
  silhouette(6, 'Brainrot character', 'Bombardiro Crocodilo',
    ['Bombombini Gusini', 'Tralalero Tralala', 'Cappuccino Assassino'],
    'A propeller plane whose nose ends in a long open jaw.',
    'That nose isn’t a painted decal. It has teeth.',
    'The name combines a bomber with the animal that gave it those jaws.',
    'A crocodile head merged with a propeller plane in flight.',
    'The crocodile-plane mashup is a different character from the goose-plane Bombombini Gusini.',
    ['bombardiro', 'bombardilo crocodilo', 'bombardino crocodilo', 'bombardiro cocodrilo', 'bombardiro crocodillo', 'bombardiro crocodile'],
    crewCredit)
];

const deepCuts = [
  card('deep-ohio', 'Imageboard archive', 'Wait, it’s all Ohio?', ['Always has been', 'Flat Earth', 'Ohio final boss'],
    [emoji('🧑‍🚀 🌎 🧑‍🚀', 'Two astronauts look down at Earth.'), line('Fill in the first astronaut’s line. The other one replies “Always has been.”'), quote('“Wait, it’s all ____?”')],
    'The Ohio version of the two-astronaut template has one astronaut realizing the whole planet is Ohio.',
    { typedFirst: true, aliases: ['wait its all ohio', 'its all ohio', 'all ohio', 'ohio'] }),
  card('deep-gregnant', 'Yahoo Answers archive', 'Gregnant', ['Pregante', 'Pregonate', 'Pergert'],
    [quote('“Can u get ____ from a pored rubber?”'), line('In the viral reading of misspelled pregnancy questions, this one sounds like a man named Greg.'), quote('“Can u get Gr_____ from a pored rubber?”')],
    'The viral Yahoo Answers reading is built around increasingly chaotic misspellings of “pregnant.” This blank is the one that sounds like Greg.',
    { typedFirst: true, aliases: ['gregnent'] }),
  card('deep-itachi', 'Anime edit culture', 'Itachi Uchiha', ['Sasuke Uchiha', 'Madara Uchiha', 'Kakashi Hatake'],
    [emoji('☝️ 👆 😑', 'Two fingers extended toward a forehead.'), line('Which red-cloud-cloak character turned a forehead poke into a goodbye in Naruto edits?'), quote('“Sorry, Sasuke…” Who says it?')],
    'Itachi’s forehead poke appears in sibling edits because the gesture carries a different meaning after their last encounter.',
    { typedFirst: true, aliases: ['itachi', 'uchiha itachi'] }),
  card('deep-rasode', 'Desi internet', 'Rasode mein kaun tha?', ['Paisa hi paisa hoga', 'Aayein? Baigan.', 'Kya karu main mar jaun?'],
    [emoji('🍳 🔥 🫙', 'A pan, flame, and an empty container.'), line('The cooker was empty. The 2020 musical remix turns an interrogation from Saath Nibhaana Saathiya into the hook.'), quote('“Rasode mein ____ tha?”')],
    'Yashraj Mukhate turned Kokilaben’s kitchen interrogation into a remix. The hook asks who was in the kitchen.',
    { typedFirst: true, aliases: ['rasode mein kon tha', 'rasode me kaun tha', 'rasode me kon tha', 'kaun', 'kon'] })
];

const bank = new Map([...general, ...photos, ...shadows, ...deepCuts, ...mature, ...live, livePhoto, ...liveMature].map((question) => [question.id, question]));
export const THEMES = {
  fandom: { name: 'Anime and fandom', ids: ['shadow-5', 'toast', 'deep-itachi', 'cinema', 'shadow-6'] },
  satire: { name: 'Politics and religion', ids: ['shadow-2', 'deep-ohio', 'photo-joever', 'shadow-1', 'prayer'] },
  court: { name: 'Courtside internet', ids: ['shadow-4', 'photo-olympics', 'horn', 'replay', 'deep-ohio'] }
};
const dayMs = 86_400_000;
export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const dateNumber = (date) => Math.floor(Date.parse(date + 'T00:00:00Z') / dayMs);
export function weekStart(date) {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return today(value);
}
export function upcomingSaturday(date) {
  const n = new Date(date + 'T00:00:00Z');
  const days = ((6 - n.getUTCDay() + 7) % 7) || 7;
  return today(n.getTime() + days * dayMs);
}
export function dailyPack(date, isMature, theme) {
  if (!isMature && Object.hasOwn(THEMES, theme)) return THEMES[theme].ids;
  const n = dateNumber(date);
  if (isMature) return Array.from({ length: 5 }, (_, i) => mature[(n + i) % mature.length].id);
  const opener = (n + shadows.length - 1) % shadows.length;
  return [
    shadows[opener].id,
    deepCuts[n % deepCuts.length].id,
    shadows[(opener + 2) % shadows.length].id,
    ['cinema', 'toast', 'horn', 'batman', 'canon', 'photo-cat'][n % 6],
    shadows[(opener + 5) % shadows.length].id
  ];
}
export function duelPack(isMature) {
  if (isMature) return shuffle(liveMature.map(({ id }) => id));
  const picks = shuffle(shadows.map(({ id }) => id));
  const quick = shuffle([...deepCuts, livePhoto, questionFor('sad-horn'), questionFor('plot-armor')].map(({ id }) => id));
  return [picks[0], quick[0], picks[1], quick[1], picks[2]];
}
function shuffle(ids) {
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
const generalIds = new Set([...general, ...photos, ...shadows, ...deepCuts].map(({ id }) => id));
export function pinnedDailyPack(value) {
  return Array.isArray(value) && value.length === 5 && new Set(value).size === 5 && value.every((id) => generalIds.has(id))
    ? value : null;
}
export const questionFor = (id) => bank.get(id);
export const QUESTION_POINTS = 100;
export const HINT_COST = 30;

export function publicQuestion(question, stage, mode, showChoices) {
  const hint = question.hints[stage];
  const move = [...question.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  const choices = question.choices.map((label, index) => ({ label, id: String((index + move) % 4) })).sort((a, b) => a.id.localeCompare(b.id));
  const visibleHint = hint.kind === 'tile' && mode === 'duel' ? { ...hint, kind: 'image' } : hint;
  return {
    id: question.id, category: question.category, hint: visibleHint,
    prompt: visibleHint.kind === 'tile' ? 'Rebuild the reaction' : question.prompt ?? 'Name the meme',
    choices: showChoices && (!question.typedFirst || stage === 2) && (mode === 'duel' || visibleHint.kind !== 'tile') ? choices : [],
    typed: showChoices && (question.typedFirst || (mode === 'solo' && stage < 2 && ['quote', 'text'].includes(hint.kind)))
  };
}

export function revealDetails(question) {
  const [first] = question.hints;
  return {
    id: question.id, answer: question.answer, note: question.note, credit: question.credit,
    finishedArt: question.revealArt ?? (first.kind === 'tile' || question.credit ? first.art : undefined),
    finishedAlt: question.revealAlt ?? first.alt,
    silhouette: first.kind === 'silhouette' ? first : undefined
  };
}

export function gradeAnswer(question, stage, answer, mode) {
  if (mode === 'solo' && question.hints[stage].kind === 'tile') {
    if (!Array.isArray(answer?.tiles) || answer.tiles.length !== 4 ||
      ![0, 1, 2, 3].every((piece) => answer.tiles.includes(piece))) return null;
    return answer.tiles.join(',') === '0,1,2,3';
  }
  const view = publicQuestion(question, stage, mode, true);
  if (typeof answer?.choice === 'string') {
    const choice = view.choices.find(({ id }) => id === answer.choice);
    return choice ? choice.label === question.answer : null;
  }
  if (!view.typed || typeof answer?.text !== 'string' || !answer.text.trim() || answer.text.length > 100) return null;
  const normalize = (value) => value.normalize('NFKD').toLowerCase().replace(/\p{Mark}/gu, '').replace(/[^\p{Letter}\p{Number}\s]/gu, '').replace(/\s+/g, ' ').trim();
  return [question.answer, ...(question.aliases ?? [])].some((entry) => normalize(entry) === normalize(answer.text));
}
