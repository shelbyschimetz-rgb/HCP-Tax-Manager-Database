/*
 * Contest skins. Each person picks one from the top bar (saved in their prefs).
 * A skin re-themes the app (colors via body.skin-<id> in skins.css, fonts,
 * stage and nav names on screen; exports and data keep the real names) and
 * adds its Game tab. Points and badges are the same for every skin; only the
 * names change.
 */

import { useStore } from './store.js';

export const BADGE_IDS = ['ontime', 'filer', 'early', 'firstpass', 'reviewer', 'clean'];

export const SKINS = {
  fellowship: {
    name: 'The Fellowship', dark: false,
    fonts: 'family=Cinzel:wght@500;700&family=EB+Garamond:wght@400;500;600;700',
    points: 'mithril', game: 'Hall of Heroes', title: 'Tax Manager · The Fellowship of the Return',
    blurb: 'The Fellowship walks the road to Mount Doom together. Every point the team earns moves us closer.',
    goal: 'The road to Mount Doom',
    nav: { home: 'The Shire', inbox: 'Messengers', 'my-tasks': 'Quests', 'peer-review': 'The Council', projects: 'Journeys' },
    stages: {
      IN_QUEUE: 'The Shire', IN_QUEUE_ESCALATED: 'The Shire (urgent)', DOC_GATHERING: 'Rivendell', PREP: 'The Mines', WFP: 'Lothlórien',
      QA: "Helm's Deep", CLIENT_REVIEW: 'Rohan', FILING_DELIVERY: 'Mount Doom', COMPLETE: 'Grey Havens', BLOCKED: 'Lost in the Marshes',
    },
    badges: {
      ontime: ['Ranger', '10 tasks done on time'], filer: ['Ring-bearer', '5 returns filed'], early: ['Swift as Shadowfax', '3 returns filed 2+ weeks early'],
      firstpass: ["Wizard's Eye", '3 returns passed peer review first try'], reviewer: ['Council of Elrond', '5 peer reviews completed'], clean: ['Shieldmaiden', 'No overdue tasks right now'],
    },
  },
  halloween: {
    name: 'The Haunted Ledger', dark: true,
    fonts: 'family=Creepster&family=Nunito:wght@400;600;800',
    points: 'candy', game: 'Pumpkin Patch', title: 'The Haunted Ledger',
    blurb: 'Every 100 candy grows your pumpkin a size. Biggest pumpkin when the contest ends wins.',
    goal: 'The team candy bucket',
    nav: { 'my-tasks': 'My Tasks', 'peer-review': 'Peer Review' },
    stages: {
      IN_QUEUE: 'The Crypt', IN_QUEUE_ESCALATED: 'The Crypt (urgent)', DOC_GATHERING: 'Trick-or-Treat', PREP: 'The Cauldron', WFP: 'At the Door',
      QA: 'Haunted Inspection', CLIENT_REVIEW: 'The Haunting', FILING_DELIVERY: 'Full Moon', COMPLETE: 'R.I.P. (Return Is Perfect)', BLOCKED: 'Cursed',
    },
    badges: {
      ontime: ['Witching Hour', '10 tasks done on time'], filer: ['Full Moon Filer', '5 returns filed'], early: ['Early Bat', '3 returns filed 2+ weeks early'],
      firstpass: ['Spellcheck', '3 returns passed peer review first try'], reviewer: ['Crystal Ball', '5 peer reviews completed'], clean: ['Ghostbuster', 'No overdue tasks right now'],
    },
  },
  aliens: {
    name: 'Aliens vs. Auditors', dark: true, teams: ['Aliens', 'Auditors'],
    fonts: 'family=Orbitron:wght@600;800&family=Exo+2:wght@400;600;700',
    points: 'energy', game: 'Battle Station', title: 'ALIENS VS. AUDITORS',
    blurb: 'Two teams, one tractor beam. Every point pulls the beam toward your side.',
    goal: 'Combined energy',
    nav: { inbox: 'Incoming Signals', 'my-tasks': 'Missions', 'peer-review': 'The Probe' },
    stages: {
      IN_QUEUE: 'Signal Detected', IN_QUEUE_ESCALATED: 'Distress Signal', DOC_GATHERING: 'Abduction', PREP: 'The Lab', WFP: 'Awaiting Mothership',
      QA: 'The Probe', CLIENT_REVIEW: 'First Contact', FILING_DELIVERY: 'Launch', COMPLETE: 'Landed', BLOCKED: 'Lost in Space',
    },
    badges: {
      ontime: ['Orbit Keeper', '10 tasks done on time'], filer: ['Mission Control', '5 returns filed'], early: ['Warp Speed', '3 returns filed 2+ weeks early'],
      firstpass: ['Clean Landing', '3 returns passed peer review first try'], reviewer: ['Probe Master', '5 peer reviews completed'], clean: ['Tractor Beam', 'No overdue tasks right now'],
    },
  },
  cozy: {
    name: 'Cozy Cats', dark: false,
    fonts: 'family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700',
    points: 'treats', game: 'Cat Café', title: 'Cozy Cats Tax Club',
    blurb: 'Every treat you earn levels up your cat. New level every 100 treats.',
    goal: 'The café treat jar',
    nav: { 'my-tasks': 'My Tasks' },
    stages: {
      IN_QUEUE: 'Napping', IN_QUEUE_ESCALATED: 'Meowing (urgent)', DOC_GATHERING: 'Gathering Yarn', PREP: 'Kneading', WFP: 'By the Door',
      QA: 'Grooming', CLIENT_REVIEW: 'Show & Tell', FILING_DELIVERY: 'Pounce', COMPLETE: 'Purrfect', BLOCKED: 'Stuck in a Box',
    },
    badges: {
      ontime: ['Biscuit Maker', '10 tasks done on time'], filer: ['Top Cat', '5 returns filed'], early: ['Zoomies', '3 returns filed 2+ weeks early'],
      firstpass: ['Clean Whiskers', '3 returns passed peer review first try'], reviewer: ['Grooming Pro', '5 peer reviews completed'], clean: ['Loaf Mode', 'No overdue tasks right now'],
    },
  },
  arcade: {
    name: 'Tax Arcade', dark: true,
    fonts: 'family=Press+Start+2P&family=VT323',
    points: 'pts', game: 'High Scores', title: 'TAX ARCADE',
    blurb: 'Climb the high-score table. Every return filed is a level cleared.',
    goal: 'Team high score',
    nav: { home: 'Home', 'my-tasks': 'Quests' },
    stages: {
      IN_QUEUE: '1 · Insert Coin', IN_QUEUE_ESCALATED: '1 · Insert Coin!', DOC_GATHERING: '2 · Power-ups', PREP: '3 · Build', WFP: '4 · Pause',
      QA: '5 · Bonus Round', CLIENT_REVIEW: '6 · Player 2', FILING_DELIVERY: '7 · Final Boss', COMPLETE: '8 · Game Clear', BLOCKED: 'Game Over',
    },
    badges: {
      ontime: ['Combo x10', '10 tasks done on time'], filer: ['Level Clear', '5 returns filed'], early: ['Speedrun', '3 returns filed 2+ weeks early'],
      firstpass: ['Flawless', '3 returns passed peer review first try'], reviewer: ['Co-op', '5 peer reviews completed'], clean: ['Extra Life', 'No overdue tasks right now'],
    },
  },
  heist: {
    name: 'The 1040 Job', dark: true,
    fonts: 'family=Bebas+Neue&family=Archivo:wght@400;600;700',
    points: 'loot', game: 'The Vault', title: 'THE 1040 JOB',
    blurb: 'The crew is cracking the vault together. Hit the target before the contest ends and everyone wins.',
    goal: 'The vault',
    nav: { inbox: 'New Marks', 'my-tasks': 'The Plan' },
    stages: {
      IN_QUEUE: 'Recon', IN_QUEUE_ESCALATED: 'Recon (hot)', DOC_GATHERING: 'Gathering Intel', PREP: 'Cracking the Safe', WFP: 'The Inside Man',
      QA: 'The Double-Check', CLIENT_REVIEW: 'The Pitch', FILING_DELIVERY: 'The Getaway', COMPLETE: 'Clean Getaway', BLOCKED: 'Busted',
    },
    badges: {
      ontime: ['Like Clockwork', '10 tasks done on time'], filer: ['Safecracker', '5 returns filed'], early: ['Getaway Driver', '3 returns filed 2+ weeks early'],
      firstpass: ['Clean Hands', '3 returns passed peer review first try'], reviewer: ['The Eye', '5 peer reviews completed'], clean: ['Inside Job', 'No overdue tasks right now'],
    },
  },
  seance: {
    name: 'The Séance', dark: true,
    fonts: 'family=IM+Fell+English+SC&family=Cormorant+Garamond:wght@400;500;600;700',
    points: 'omens', game: 'The Spirit Board', title: 'THE SÉANCE',
    blurb: 'Hands on the planchette. Every omen the circle earns lights another letter on the board. Light them all to summon the prize.',
    goal: 'The spirit board',
    nav: { home: 'The Parlor', inbox: 'Knocks at the Door', 'my-tasks': 'Rituals', 'peer-review': 'The Medium' },
    stages: {
      IN_QUEUE: 'Light the Candles', IN_QUEUE_ESCALATED: 'A Cold Draft (urgent)', DOC_GATHERING: 'Gathering Offerings', PREP: 'Hands on the Planchette', WFP: 'Awaiting a Sign',
      QA: 'The Medium Reads', CLIENT_REVIEW: 'Is Anyone There?', FILING_DELIVERY: 'YES', COMPLETE: 'GOODBYE', BLOCKED: 'The Spirits Are Silent',
    },
    badges: {
      ontime: ['Midnight Sharp', '10 tasks done on time'], filer: ['The Medium', '5 returns filed'], early: ['Premonition', '3 returns filed 2+ weeks early'],
      firstpass: ['Clear Message', '3 returns passed peer review first try'], reviewer: ['Spirit Guide', '5 peer reviews completed'], clean: ['Restless No More', 'No overdue tasks right now'],
    },
  },
};
Object.keys(SKINS).forEach((id) => { SKINS[id].id = id; });

export const SKIN_ORDER = ['fellowship', 'halloween', 'aliens', 'cozy', 'arcade', 'heist', 'seance'];

/** The active skin definition for these prefs, or null. */
export function activeSkin(prefs, config) {
  if (!prefs || !prefs.skin || (config && config.game_enabled === false)) return null;
  return SKINS[prefs.skin] || null;
}

/** Hook: the signed-in person's skin (a stable object), or null. */
export function useSkin() {
  return useStore((s) => activeSkin(s.prefs, s.config));
}

/** On-screen stage name under the active skin (exports and data keep the real names). */
export function stageName(skin, value, fallback) {
  return (skin && skin.stages[value]) || fallback;
}

const loadedFonts = new Set();
export function loadSkinFonts(skin) {
  if (!skin || !skin.fonts || loadedFonts.has(skin.id) || typeof document === 'undefined') return;
  loadedFonts.add(skin.id);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' + skin.fonts + '&display=swap';
  document.head.appendChild(l);
}
