import type { ScenarioCard, PersonaBrainItem } from './scenarios';
import type { AnnaChatTurn, AnnaMood } from './anna-brain';
import { getKaliyonaPrefs } from './kaliyona-prefs';

export interface PersonaReply {
  script: string;
  kanglish: string;
  english: string;
  mood?: AnnaMood;
}

// =========================================================================
// PART A — NORMALIZE + NEGATION DETECTION
// =========================================================================

/**
 * Normalizes user text for matching:
 * Lowercases, collapses whitespace, removes special symbols except sentence/clause splits.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0C80-\u0CFF,.;!?'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether text contains standalone negation words or phrases:
 * 'not', "n't" (don't/won't/can't/no need), 'no ', 'nothing',
 * 'beda', 'beda!', 'venda', 'bekagilla', 'illa' (bare illa = no/don't),
 * 'cancel', 'stop', 'dont', 'dont want'
 */
export function detectNegation(text: string): boolean {
  if (!text) return false;
  const t = ` ${text.toLowerCase()} `;
  // Standalone word checks with boundaries or specific negation contractions
  if (
    /\b(not|no\s+need|no|nothing|beda|venda|bekagilla|illa|cancel|stop|dont\s+want|dont)\b/i.test(
      t
    ) ||
    /n't\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

// Module-level rotation store for round-robin persona negation lines (never repeats last)
const personaNegationRotation: Record<string, number> = {};

// Module-level rotation for English-only tips (rotate 3 variants, never stack)
let englishTipIndex = 0;
const ENGLISH_TIPS = [
  " (Tip: try 'eshtu?' for price)",
  " (Tip: say '...beku' to ask)",
  " (Tip: say 'namaskara' to greet)",
];

/**
 * Check if the text is purely English (contains no Kannada characters and no Kanglish tokens)
 */
function isEnglishOnlyText(raw: string): boolean {
  // If text has Kannada script characters
  if (/[\u0C80-\u0CFF]/.test(raw)) return false;

  const words = raw.toLowerCase().split(/\s+/);
  const commonKanglishTokens = new Set([
    'namaskara',
    'namaste',
    'hegiddira',
    'hegiddiya',
    'beku',
    'kodi',
    'illa',
    'beda',
    'eshtu',
    'elli',
    'hogbeku',
    'sari',
    'haudhu',
    'haudu',
    'guru',
    'anna',
    'boss',
    'thindi',
    'oota',
    'dose',
    'dosa',
    'idli',
    'kaapi',
    'neeru',
    'baadige',
    'duddu',
    'banni',
    'togoLLi',
    'kammi',
    'jaasti',
    'chennagi',
  ]);

  for (const w of words) {
    const cleanWord = w.replace(/[^\w]/g, '');
    if (commonKanglishTokens.has(cleanWord)) {
      return false;
    }
  }

  return true;
}

// =========================================================================
// SCRIPT & TRANSLATION DICTIONARY FOR FIXED PERSONA STRINGS
// =========================================================================

interface LineInfo {
  script: string;
  english: string;
}

const LINE_TRANSLATIONS: Record<string, LineInfo> = {
  // Darshini Negation Lines
  'Sari sir, bejaar madbedi! Innu enu beku — idli? dose?': {
    script: 'ಸರಿ ಸರ್, ಬೇಜಾರ್ ಮಾಡ್ಬೇಡಿ! ಇನ್ನು ಏನು ಬೇಕು — ಇಡ್ಲಿ? ದೋಸೆ?',
    english: "Alright sir, don't worry! What else do you want — idli? dosa?",
  },
  'Kalsabeda! Freshaagi banni yavaga beku aaga.': {
    script: 'ಕಳಸಬೇಡ! ಫ್ರೆಶ್ ಆಗಿ ಬನ್ನಿ ಯಾವಾಗ ಬೇಕು ಆಗ.',
    english: 'No problem! Come fresh whenever you want.',
  },
  'Okay boss! Bere enadru try maadi — vada chennagirutte!': {
    script: 'ಓಕೆ ಬಾಸ್! ಬೇರೆ ಏನಾದ್ರೂ ಟ್ರೈ ಮಾಡಿ — ವಡೆ ಚೆನ್ನಾಗಿರುತ್ತೆ!',
    english: 'Okay boss! Try something else — vada is very good!',
  },
  'Illa parvagilla sir! Neevu sumne koothkoli, heng?': {
    script: 'ಇಲ್ಲ ಪರವಾಗಿಲ್ಲ ಸರ್! ನೀವು ಸುಮ್ನೆ ಕೂತ್ಕೊಳ್ಳಿ, ಹೆಂಗ್?',
    english: 'No problem sir! You just relax and sit, how about that?',
  },
  'Sari sari! Coffee illa andre tea idde sir?': {
    script: 'ಸರಿ ಸರಿ! ಕಾಫಿ ಇಲ್ಲ ಅಂದ್ರೆ ಟೀ ಇದೆ ಸರ್?',
    english: 'Alright! If not coffee, tea is available sir?',
  },
  // Darshini Affirms & Fallbacks
  'Sari boss, eradu nimisha!': {
    script: 'ಸರಿ ಬಾಸ್, ಎರಡು ನಿಮಿಷ!',
    english: 'Alright boss, two minutes!',
  },
  'Haudhu sir, bring madtini!': {
    script: 'ಹೌದು ಸರ್, ಬ್ರಿಂಗ್ ಮಾಡ್ತೀನಿ!',
    english: 'Yes sir, bringing it right away!',
  },
  'Kannada thumba kashta aagide sir — swalpa simple aagi heli?': {
    script: 'ಕನ್ನಡ ತುಂಬಾ ಕಷ್ಟ ಆಗಿದೆ ಸರ್ — ಸ್ವಲ್ಪ ಸಿಂಪಲ್ ಆಗಿ ಹೇಳಿ?',
    english: 'Kannada is a bit hard sir — please say it a bit simply?',
  },

  // Auto Negations
  'Sari saar, beda andre bidi! Yavaga beku aaga call maadi.': {
    script: 'ಸರಿ ಸಾರ್, ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ! ಯಾವಾಗ ಬೇಕು ಆಗ ಕಾಲ್ ಮಾಡಿ.',
    english: 'Alright sir, if you don’t want leave it! Call whenever you need.',
  },
  'Aaytu sir, hogalla andre parvagilla. Naanu bere ride nodtini!': {
    script: 'ಆಯ್ತು ಸರ್, ಹೋಗಲ್ಲ ಅಂದ್ರೆ ಪರವಾಗಿಲ್ಲ. ನಾನು ಬೇರೆ ರೈಡ್ ನೋಡ್ತೀನಿ!',
    english: 'Okay sir, no problem if not going. I will look for another ride!',
  },
  'Illa sir, tension madkolbedi! Stand alliye irthini.': {
    script: 'ಇಲ್ಲ ಸರ್, ಟೆನ್ಷನ್ ಮಾಡ್ಕೊಳ್ಬೇಡಿ! ಸ್ಟ್ಯಾಂಡ್ ಅಲ್ಲೇ ಇರ್ತೀನಿ.',
    english: 'No sir, don’t take tension! I will be at the stand.',
  },
  'Sari boss, drop plan cancel! Matte yavagaadru hogona.': {
    script: 'ಸರಿ ಬಾಸ್, ಡ್ರಾಪ್ ಪ್ಲಾನ್ ಕ್ಯಾನ್ಸಲ್! ಮತ್ತೆ ಯಾವಾಗಾದ್ರೂ ಹೋಗೋಣ.',
    english: 'Alright boss, drop plan cancelled! Let’s go some other time.',
  },
  // Auto Affirms & Fallbacks
  'Sari saar, kootkoLLi! Meter haaki hogona.': {
    script: 'ಸರಿ ಸಾರ್, ಕೂತ್ಕೊಳ್ಳಿ! ಮೀಟರ್ ಹಾಕಿ ಹೋಗೋಣ.',
    english: 'Alright sir, please sit! We will go on meter.',
  },
  'Haudhu boss, bega banni, traffic jaasti aagutte!': {
    script: 'ಹೌದು ಬಾಸ್, ಬೇಗ ಬನ್ನಿ, ಟ್ರಾಫಿಕ್ ಜಾಸ್ತಿ ಆಗುತ್ತೆ!',
    english: 'Yes boss, come quickly, traffic will increase!',
  },
  'Artha aaglilla saar, route hesaru swalpa spaSTavaagi heli?': {
    script: 'ಅರ್ಥ ಆಗ್ಲಿಲ್ಲ ಸಾರ್, ರೂಟ್ ಹೆಸರು ಸ್ವಲ್ಪ ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ?',
    english: "Didn't understand sir, could you tell the route clearly?",
  },

  // BMTC / Bus Conductor
  'Beda andre munde hogi saar, bereyavrige jaaga kodi!': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ಮುಂದೆ ಹೋಗಿ ಸಾರ್, ಬೇರೆಯವರಿಗೆ ಜಾಗ ಕೊಡಿ!',
    english: "If you don't want move ahead sir, give way to others!",
  },
  'Ticket bedwa? Haagidre pass ideya nodi.': {
    script: 'ಟಿಕೆಟ್ ಬೇಡ್ವಾ? ಹಾಗಿದ್ರೆ ಪಾಸ್ ಇದೆಯಾ ನೋಡಿ.',
    english: "Don't want ticket? Then see if you have a bus pass.",
  },
  'Sari sari, illiye nilsalla, mundina stop alli nilsolla!': {
    script: 'ಸರಿ ಸರಿ, ಇಲ್ಲೇ ನಿಲ್ಸಲ್ಲ, ಮುಂದಿನ ಸ್ಟಾಪ್ ಅಲ್ಲಿ ನಿಲ್ಸಲ್ಲ!',
    english: "Alright alright, not stopping here, but at next stop!",
  },
  'Parvagilla, stop bandaga heli, bell hoditini.': {
    script: 'ಪರವಾಗಿಲ್ಲ, ಸ್ಟಾಪ್ ಬಂದಾಗ ಹೇಳಿ, ಬೆಲ್ ಹೊಡೀತೀನಿ.',
    english: 'No problem, tell me when your stop comes, I will ring the bell.',
  },
  'Haudhu saar, chillare kodi, ticket togoLLi!': {
    script: 'ಹೌದು ಸಾರ್, ಚಿಲ್ಲರೆ ಕೊಡಿ, ಟಿಕೆಟ್ ತಗೊಳ್ಳಿ!',
    english: 'Yes sir, give change and take the ticket!',
  },
  'Sari munde banni, jaaga ide kootkoli.': {
    script: 'ಸರಿ ಮುಂದೆ ಬನ್ನಿ, ಜಾಗ ಇದೆ ಕೂತ್ಕೊಳ್ಳಿ.',
    english: 'Alright move forward, there is room to sit.',
  },
  'Sound jaasti ide sir, yaava stop beku innondu sala heli?': {
    script: 'ಸೌಂಡ್ ಜಾಸ್ತಿ ಇದೆ ಸರ್, ಯಾವ ಸ್ಟಾಪ್ ಬೇಕು ಇನ್ನೊಂದು ಸಲ ಹೇಳಿ?',
    english: 'Too much noise sir, which stop do you need once again?',
  },

  // Market
  'Beda andre bidi amma! Naale fresh tharakaari baratte, banni.': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ ಅಮ್ಮ! ನಾಳೆ ಫ್ರೆಶ್ ತರಕಾರಿ ಬರುತ್ತೆ, ಬನ್ನಿ.',
    english: "If you don't want leave it madam! Fresh vegetables come tomorrow, visit.",
  },
  'Ayyo thagolbedi sir, bere stall alli nodi, aadre nam thara fresh sigalla!': {
    script: 'ಅಯ್ಯೋ ತಗೋಳ್ಬೇಡಿ ಸರ್, ಬೇರೆ ಸ್ಟಾಲ್ ಅಲ್ಲಿ ನೋಡಿ, ಆದ್ರೆ ನಮ್ ತರ ಫ್ರೆಶ್ ಸಿಗಲ್ಲ!',
    english: "Don't buy sir, check other stalls, but won't find fresh like ours!",
  },
  'Sari sari, beda andre illa! Bere enu beku — soppu? eerulli?': {
    script: 'ಸರಿ ಸರಿ, ಬೇಡ ಅಂದ್ರೆ ಇಲ್ಲ! ಬೇರೆ ಏನು ಬೇಕು — ಸೊಪ್ಪು? ಈರುಳ್ಳಿ?',
    english: "Alright, if you don't want no problem! What else — greens? onions?",
  },
  'Parvagilla saar, bejaar illa. Quality mathra super ide!': {
    script: 'ಪರವಾಗಿಲ್ಲ ಸಾರ್, ಬೇಜಾರ್ ಇಲ್ಲ. ಕ್ವಾಲಿಟಿ ಮಾತ್ರ ಸೂಪರ್ ಇದೆ!',
    english: 'No problem sir, no hard feelings. Quality is top-notch!',
  },
  'Haudhu saar, cover alli haaki kodtini, thagoli!': {
    script: 'ಹೌದು ಸಾರ್, ಕವರ್ ಅಲ್ಲಿ ಹಾಕಿ ಕೊಡ್ತೀನಿ, ತಗೋಳಿ!',
    english: 'Yes sir, putting it in a cover, please take!',
  },
  'Sari sir, fresh item, pack maadidini!': {
    script: 'ಸರಿ ಸರ್, ಫ್ರೆಶ್ ಐಟಮ್, ಪ್ಯಾಕ್ ಮಾಡಿದೀನಿ!',
    english: 'Alright sir, fresh items, packed for you!',
  },
  'Swalpa gattiyagi heli saar, yav tharakari beku?': {
    script: 'ಸ್ವಲ್ಪ ಗಟ್ಟಿಯಾಗಿ ಹೇಳಿ ಸಾರ್, ಯಾವ್ ತರಕಾರಿ ಬೇಕು?',
    english: 'Please say a bit louder sir, which vegetable do you need?',
  },

  // Landlord Aunty
  'Mane bedwa? Parvagilla, bere tenants queue nalli iddare!': {
    script: 'ಮನೆ ಬೇಡ್ವಾ? ಪರವಾಗಿಲ್ಲ, ಬೇರೆ ಟೆನೆಂಟ್ಸ್ ಕ್ಯೂನಲ್ಲಿ ಇದ್ದಾರೆ!',
    english: "Don't want the house? No problem, other tenants are in queue!",
  },
  'Rules ishta aaglilla andre bere kade nodkoli thammudu.': {
    script: 'ರೂಲ್ಸ್ ಇಷ್ಟ ಆಗ್ಲಿಲ್ಲ ಅಂದ್ರೆ ಬೇರೆ ಕಡೆ ನೋಡ್ಕೊಳ್ಳಿ ತಮ್ಮುಡು.',
    english: "If you don't like the rules look elsewhere brother.",
  },
  'Sari sari, advance kasto andre swalpa adjust madona.': {
    script: 'ಸರಿ ಸರಿ, ಅಡ್ವಾನ್ಸ್ ಕಷ್ಟ ಅಂದ್ರೆ ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡೋಣ.',
    english: 'Alright, if advance is tough let us adjust a bit.',
  },
  'Aaytu, beda andre bidi! Namma building nalli thumba peace ide.': {
    script: 'ಆಯ್ತು, ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ! ನಮ್ಮ ಬಿಲ್ಡಿಂಗ್ ನಲ್ಲಿ ತುಂಬಾ ಪೀಸ್ ಇದೆ.',
    english: 'Okay, if not leave it! Our building is very peaceful.',
  },
  'Haudhu, 1st date olage rent kottidre thumba olledu!': {
    script: 'ಹೌದು, ೧ ನೇ ತಾರೀಖು ಒಳಗೆ ರೆಂಟ್ ಕೊಟ್ಟಿದ್ರೆ ತುಂಬಾ ಒಳ್ಳೇದು!',
    english: 'Yes, paying rent before 1st is very good!',
  },
  'Sari, agreement ready maadtini, Aadhaar card kodi.': {
    script: 'ಸರಿ, ಅಗ್ರಿಮೆಂಟ್ ರೆಡಿ ಮಾಡ್ತೀನಿ, ಆಧಾರ್ ಕಾರ್ಡ್ ಕೊಡಿ.',
    english: 'Alright, preparing the agreement, provide Aadhaar card.',
  },
  'Mane vishaya artha aaglilla, rent bagge na athava water bagge na?': {
    script: 'ಮನೆ ವಿಷಯ ಅರ್ಥ ಆಗ್ಲಿಲ್ಲ, ರೆಂಟ್ ಬಗ್ಗೆನಾ ಅಥವಾ ನೀರ್ ಬಗ್ಗೆನಾ?',
    english: "Didn't understand house query, is it about rent or water?",
  },

  // Neighbor Uncle
  'Hogbedi bidri! Park nalli swalpa rest maadi, yaake ashtu tension?': {
    script: 'ಹೋಗ್ಬೇಡಿ ಬಿಡ್ರಿ! ಪಾರ್ಕ್ ನಲ್ಲಿ ಸ್ವಲ್ಪ ರೆಸ್ಟ್ ಮಾಡಿ, ಯಾಕೆ ಅಷ್ಟು ಟೆನ್ಷನ್?',
    english: "Don't go yet friend! Rest in park, why so much tension?",
  },
  'Beda andre bidi kano! Naavella retired janagalu, aramavagi iddivi.': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ ಕಣೋ! ನಾವೆಲ್ಲ ರಿಟೈರ್ಡ್ ಜನಗಳು, ಆರಾಮವಾಗಿ ಇದ್ದೀವಿ.',
    english: "Leave it if not friend! We are retired folks, relaxing peacefully.",
  },
  'Ayyo adjust madbeda guru! Bengaluru weather enjoy maadu sumne.': {
    script: 'ಅಯ್ಯೋ ಅಡ್ಜಸ್ಟ್ ಮಾಡ್ಬೇಡ ಗುರು! ಬೆಂಗಳೂರು ವೆದರ್ ಎಂಜಾಯ್ ಮಾಡು ಸುಮ್ನೆ.',
    english: "Don't overthink friend! Just enjoy the Bengaluru weather.",
  },
  'Sari sari, coffee bedwa? Haagidre weather bagge mathadona banni!': {
    script: 'ಸರಿ ಸರಿ, ಕಾಫಿ ಬೇಡ್ವಾ? ಹಾಗಿದ್ರೆ ವೆದರ್ ಬಗ್ಗೆ ಮಾತಾಡೋಣ ಬನ್ನಿ!',
    english: "Alright, don't want coffee? Then come let's talk about weather!",
  },
  'Haudhu kanree, namma kaaladalli Bengaluru innu super aagittu!': {
    script: 'ಹೌದು ಕಣ್ರೀ, ನಮ್ಮ ಕಾಲದಲ್ಲಿ ಬೆಂಗಳೂರು ಇನ್ನು ಸೂಪರ್ ಆಗಿತ್ತು!',
    english: 'Yes friend, in our time Bengaluru was even more wonderful!',
  },
  'Khanditha, cricket match mathra bittubidbarda!': {
    script: 'ಖಂಡಿತ, ಕ್ರಿಕೆಟ್ ಮ್ಯಾಚ್ ಮಾತ್ರ ಬಿಟ್ಟುಬಿಡ್ಬಾರ್ದು!',
    english: 'Certainly, one must never miss the cricket match!',
  },
  'Kivi swalpa doora aagide young man, innondu sala heli?': {
    script: 'ಕಿವಿ ಸ್ವಲ್ಪ ದೂರ ಆಗಿದೆ ಯಂಗ್ ಮ್ಯಾನ್, ಇನ್ನೊಂದು ಸಲ ಹೇಳಿ?',
    english: 'My hearing is a bit weak young man, could you say it again?',
  },

  // Traffic Police
  'Fine bedwa? Haagidre rules follow maadi, helmet yaake haakilla?': {
    script: 'ಫೈನ್ ಬೇಡ್ವಾ? ಹಾಗಿದ್ರೆ ರೂಲ್ಸ್ ಫಾಲೋ ಮಾಡಿ, ಹೆಲ್ಮೆಟ್ ಯಾಕೆ ಹಾಕಿಲ್ಲ?',
    english: "Don't want fine? Then follow rules, why wasn't helmet worn?",
  },
  'Argue madbedi! Side ge gaadi nilsi, documents thorisi.': {
    script: 'ಆರ್ಗ್ಯೂ ಮಾಡ್ಬೇಡಿ! ಸೈಡ್ ಗೆ ಗಾಡಿ ನಿಲ್ಸಿ, ಡಾಕ್ಯುಮೆಂಟ್ಸ್ ತೋರಿಸಿ.',
    english: "Don't argue! Pull vehicle to the side and show documents.",
  },
  'Beda andre aagalla, Bangalore traffic rules ellarigu onde!': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ಆಗಲ್ಲ, ಬೆಂಗಳೂರು ಟ್ರಾಫಿಕ್ ರೂಲ್ಸ್ ಎಲ್ಲರಿಗೂ ಒಂದೇ!',
    english: "Refusal won't work, Bengaluru traffic rules apply to everyone!",
  },
  'Sari, ee sala warning kodtini, matte repeat aagbaardu!': {
    script: 'ಸರಿ, ಈ ಸಲ ವಾರ್ನಿಂಗ್ ಕೊಡ್ತೀನಿ, ಮತ್ತೆ ರಿಪೀಟ್ ಆಗ್ಬಾರ್ದು!',
    english: 'Alright, giving warning this time, must not repeat!',
  },
  'Sari, online challan receipt togoLLi, safe aagi odisi.': {
    script: 'ಸರಿ, ಆನ್‌ಲೈನ್ ಚಲನ್ ರಶೀದಿ ತಗೊಳ್ಳಿ, ಸೇಫ್ ಆಗಿ ಓಡಿಸಿ.',
    english: 'Alright, take the online challan receipt, drive safely.',
  },
  'Haudhu, zebra crossing munde gaadi nilsi.': {
    script: 'ಹೌದು, ಜೀಬ್ರಾ ಕ್ರಾಸಿಂಗ್ ಮುಂದೆ ಗಾಡಿ ನಿಲ್ಸಿ.',
    english: 'Yes, stop vehicle before the zebra crossing.',
  },
  'Enu heltidira? DL mathu RC book munde idi modalu!': {
    script: 'ಏನು ಹೇಳ್ತಿದ್ದೀರಾ? ಡಿಎಲ್ ಮತ್ತು ಆರ್‌ಸಿ ಬುಕ್ ಮುಂದೆ ಇಡಿ ಮೊದಲು!',
    english: 'What are you saying? Present DL and RC book first!',
  },

  // Pharmacy Bhaiya
  'Tablet bedwa? Parvagilla sir, swalpa bisi neeru kudi, aaraam aagatte.': {
    script: 'ಟ್ಯಾಬ್ಲೆಟ್ ಬೇಡ್ವಾ? ಪರವಾಗಿಲ್ಲ ಸರ್, ಸ್ವಲ್ಪ ಬಿಸಿ ನೀರು ಕುಡಿ, ಆರಾಮ್ ಆಗತ್ತೆ.',
    english: "Don't want tablet? Drink warm water sir, you will feel better.",
  },
  'Aaytu sir, tonic beda andre bidi. Prescription ideya check maadi.': {
    script: 'ಆಯ್ತು ಸರ್, ಟಾನಿಕ್ ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ. ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಇದೆಯಾ ಚೆಕ್ ಮಾಡಿ.',
    english: "Okay sir, leave the tonic if not needed. Check if you have prescription.",
  },
  'Beda andre thagolbedi! Side-effects enu illa, but rest thogoLLi.': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ತಗೋಳ್ಬೇಡಿ! ಸೈಡ್-ಎಫೆಕ್ಟ್ಸ್ ಏನು ಇಲ್ಲ, ಬಟ್ ರೆಸ್ಟ್ ತಗೊಳ್ಳಿ.',
    english: "Don't take if you don't want! No side-effects, but take rest.",
  },
  'Sari sari, beda andre cancel! Doctor ge thorisi aamele banni.': {
    script: 'ಸರಿ ಸರಿ, ಬೇಡ ಅಂದ್ರೆ ಕ್ಯಾನ್ಸಲ್! ಡಾಕ್ಟರ್ ಗೆ ತೋರಿಸಿ ಆಮೇಲೆ ಬನ್ನಿ.',
    english: 'Alright, cancel if not needed! Consult doctor and return.',
  },
  'Haudhu sir, 10 tablets ide, oota aadmele thagoli.': {
    script: 'ಹೌದು ಸರ್, ೧೦ ಮಾತ್ರೆ ಇದೆ, ಊಟ ಆದ್ಮೇಲೆ ತಗೋಳಿ.',
    english: 'Yes sir, contains 10 tablets, take after meals.',
  },
  'Sari, cover alli haaki kodtini, bill ₹30.': {
    script: 'ಸರಿ, ಕವರ್ ಅಲ್ಲಿ ಹಾಕಿ ಕೊಡ್ತೀನಿ, ಬಿಲ್ ₹೩೦.',
    english: 'Alright, packing in cover, bill is ₹30.',
  },
  'Maathre hesaru spaSTavaagi heLtira sir? Prescription kodi nodona.': {
    script: 'ಮಾತ್ರೆ ಹೆಸರು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳ್ತೀರಾ ಸರ್? ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಕೊಡಿ ನೋಡೋಣ.',
    english: 'Can you state medicine name clearly sir? Show prescription.',
  },

  // PG Owner
  'Room bedwa? No problem sir, admission thumba fast aagi fill aagutte.': {
    script: 'ರೂಮ್ ಬೇಡ್ವಾ? ನೋ ಪ್ರಾಬ್ಲಮ್ ಸರ್, ಅಡ್ಮಿಷನ್ ತುಂಬಾ ಫಾಸ್ಟ್ ಆಗಿ ಫಿಲ್ ಆಗುತ್ತೆ.',
    english: "Don't want room? No problem sir, admissions fill very fast.",
  },
  'Oota beda andre swalpa rent kammi aagolla, package ide!': {
    script: 'ಊಟ ಬೇಡ ಅಂದ್ರೆ ಸ್ವಲ್ಪ ರೆಂಟ್ ಕಮ್ಮಿ ಆಗೊಲ್ಲ, ಪ್ಯಾಕೇಜ್ ಇದೆ!',
    english: "Rent won't decrease if skipping food, it is a package!",
  },
  'Late aagi barbedi andre artha maadkoli, gate lock aagutte.': {
    script: 'ಲೇಟ್ ಆಗಿ ಬರ್ಬೇಡಿ ಅಂದ್ರೆ ಅರ್ಥ ಮಾಡ್ಕೊಳ್ಳಿ, ಗೇಟ್ ಲಾಕ್ ಆಗುತ್ತೆ.',
    english: "Please understand don't come late, gate gets locked.",
  },
  'Sari sir, bejaar beda! Notice period 30 days irutte.': {
    script: 'ಸರಿ ಸರ್, ಬೇಜಾರ್ ಬೇಡ! ನೋಟಿಸ್ ಪೀರಿಯಡ್ ೩೦ ದಿನ ಇರುತ್ತೆ.',
    english: "Alright sir, don't worry! Notice period is 30 days.",
  },
  'Sari, room key togoLLi, biometric fingerprint kodtini.': {
    script: 'ಸರಿ, ರೂಮ್ ಕೀ ತಗೊಳ್ಳಿ, ಬಯೋಮೆಟ್ರಿಕ್ ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ ಕೊಡ್ತೀನಿ.',
    english: 'Alright, take room key, will configure biometric fingerprint.',
  },
  'Haudhu sir, 3 hotthu oota super aagi irutte!': {
    script: 'ಹೌದು ಸರ್, ೩ ಹೊತ್ತು ಊಟ ಸೂಪರ್ ಆಗಿ ಇರುತ್ತೆ!',
    english: 'Yes sir, 3 daily meals are delicious!',
  },
  'PG vishaya enu kelthiddira? Room na athava food bagge na?': {
    script: 'ಪಿಜಿ ವಿಷಯ ಏನು ಕೇಳ್ತಿದ್ದೀರಾ? ರೂಮ್ ಬಗ್ಗೆನಾ ಅಥವಾ ಊಟ ಬಗ್ಗೆನಾ?',
    english: 'What are you asking about PG? About room or food?',
  },

  // Kirana Shopkeeper
  'Beda andre bidi anna! Innu bere enu beku — tea powder? bisleri?': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ ಅಣ್ಣ! ಇನ್ನು ಬೇರೆ ಏನು ಬೇಕು — ಟೀ ಪೌಡರ್? ಬಿಸ್ಲೇರಿ?',
    english: "If not leave it brother! What else — tea powder? water?",
  },
  'Illa sir, carry bag bedwa? Kaiyalli thagond hogbovdu!': {
    script: 'ಇಲ್ಲ ಸರ್, ಕ್ಯಾರಿ ಬ್ಯಾಗ್ ಬೇಡ್ವಾ? ಕೈಯಲ್ಲಿ ತಗೊಂಡು ಹೋಗ್ಬೋದು!',
    english: "Don't want carry bag sir? Can carry by hand!",
  },
  'Aaytu beda andre cancel! Fresh stock sanje baratte.': {
    script: 'ಆಯ್ತು ಬೇಡ ಅಂದ್ರೆ ಕ್ಯಾನ್ಸಲ್! ಫ್ರೆಶ್ ಸ್ಟಾಕ್ ಸಂಜೆ ಬರುತ್ತೆ.',
    english: 'Okay cancelled if not needed! Fresh stock arrives this evening.',
  },
  'Parvagilla sir, change illa andre GPay maadi, no tension!': {
    script: 'ಪರವಾಗಿಲ್ಲ ಸರ್, ಚೇಂಜ್ ಇಲ್ಲ ಅಂದ್ರೆ ಜಿಪೇ ಮಾಡಿ, ನೋ ಟೆನ್ಷನ್!',
    english: 'No problem sir, if no change do GPay, no tension!',
  },
  'Haudhu anna, cover nalli haakidini, total amout kodi!': {
    script: 'ಹೌದು ಅಣ್ಣ, ಕವರ್ ನಲ್ಲಿ ಹಾಕಿದೀನಿ, ಟೋಟಲ್ ಅಮೌಂಟ್ ಕೊಡಿ!',
    english: 'Yes brother, packed in cover, please pay total amount!',
  },
  'Sari anna, QR code counter nalli ide, scan maadi.': {
    script: 'ಸರಿ ಅಣ್ಣ, ಕ್ಯೂಆರ್ ಕೋಡ್ ಕೌಂಟರ್ ನಲ್ಲಿ ಇದೆ, ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
    english: 'Alright brother, QR code is at the counter, please scan.',
  },
  'Yav saamanu beku anna? List swalpa clear aagi heli.': {
    script: 'ಯಾವ್ ಸಾಮಾನು ಬೇಕು ಅಣ್ಣ? ಲಿಸ್ಟ್ ಸ್ವಲ್ಪ ಕ್ಲಿಯರ್ ಆಗಿ ಹೇಳಿ.',
    english: 'Which groceries brother? Please state list clearly.',
  },

  // Anna Default
  'Sari guru, bejaar madbedi! Innu bere enadru try maadi.': {
    script: 'ಸರಿ ಗುರು, ಬೇಜಾರ್ ಮಾಡ್ಬೇಡಿ! ಇನ್ನು ಬೇರೆ ಏನಾದ್ರೂ ಟ್ರೈ ಮಾಡಿ.',
    english: "Alright friend, don't worry! Try something else.",
  },
  'Beda andre bidi, aramavagi relax maadi!': {
    script: 'ಬೇಡ ಅಂದ್ರೆ ಬಿಡಿ, ಆರಾಮವಾಗಿ ರಿಲ್ಯಾಕ್ಸ್ ಮಾಡಿ!',
    english: "Leave it if not, relax peacefully!",
  },
  'Illa parvagilla guru, nimage ishta aagiddanna kaliyiri.': {
    script: 'ಇಲ್ಲ ಪರವಾಗಿಲ್ಲ ಗುರು, ನಿಮಗೆ ಇಷ್ಟ ಆಗಿದ್ದನ್ನ ಕಲಿಯಿರಿ.',
    english: 'No problem friend, learn whatever you enjoy.',
  },
  'Sari sari, tension beda! Naanu sada nimm jothege idde.': {
    script: 'ಸರಿ ಸರಿ, ಟೆನ್ಷನ್ ಬೇಡ! ನಾನು ಸದಾ ನಿಮ್ಮ ಜೊತೆಗೆ ಇದ್ದೇನೆ.',
    english: "Alright, no tension! I'm always with you.",
  },
  'Super guru! Haage munduvariyiri!': {
    script: 'ಸೂಪರ್ ಗುರು! ಹಾಗೆ ಮುಂದುವರಿಯಿರಿ!',
    english: 'Super friend! Keep going like that!',
  },
  'Haudhu! Neavu thumba bega kaliyutiddira!': {
    script: 'ಹೌದು! ನೀವು ತುಂಬಾ ಬೇಗ ಕಲಿಯುತ್ತಿದ್ದೀರಾ!',
    english: 'Yes! You are learning very fast!',
  },
  'Kannada thumba kashta aagide guru — swalpa simple aagi heli?': {
    script: 'ಕನ್ನಡ ತುಂಬಾ ಕಷ್ಟ ಆಗಿದೆ ಗುರು — ಸ್ವಲ್ಪ ಸಿಂಪಲ್ ಆಗಿ ಹೇಳಿ?',
    english: 'Kannada is feeling tough friend — say it a bit simply?',
  },
};

/**
 * Returns script and english info for any text.
 * Falls back to sensible defaults.
 */
function getLineDetails(kanglish: string): LineInfo {
  if (LINE_TRANSLATIONS[kanglish]) {
    return LINE_TRANSLATIONS[kanglish];
  }
  return {
    script: kanglish,
    english: kanglish,
  };
}

// =========================================================================
// DEFAULT ANNA BRAIN (Used when activePersona is null or Anna directly)
// =========================================================================

const DEFAULT_ANNA_BRAIN = {
  items: [
    {
      keys: ['kannada', 'learn', 'words', 'speak'],
      name: 'Kannada Learning',
      nameKn: 'ಕನ್ನಡ ಕಲಿಕೆ',
      price: 'Free with Anna!',
    },
    {
      keys: ['tips', 'bengaluru', 'routes', 'darshini'],
      name: 'Bengaluru Survival Tips',
      nameKn: 'ಬೆಂಗಳೂರು ಟಿಪ್ಸ್',
      price: 'Priceless',
    },
  ],
  negationLines: [
    'Sari guru, bejaar madbedi! Innu bere enadru try maadi.',
    'Beda andre bidi, aramavagi relax maadi!',
    'Illa parvagilla guru, nimage ishta aagiddanna kaliyiri.',
    'Sari sari, tension beda! Naanu sada nimm jothege idde.',
  ],
  affirmLines: [
    'Super guru! Haage munduvariyiri!',
    'Haudhu! Neavu thumba bega kaliyutiddira!',
  ],
  dontUnderstand:
    'Kannada thumba kashta aagide guru — swalpa simple aagi heli?',
};

// =========================================================================
// PART B — CLAUSE ANALYSIS & INTENT PIPELINE
// =========================================================================

export type PersonaIntent =
  | 'NEGATION_INTENT'
  | 'AFFIRM'
  | 'GREETING'
  | 'PRICE_QUERY'
  | 'ORDER_ITEM'
  | 'REQUEST'
  | 'LOCATION'
  | 'TIME'
  | 'THANKS'
  | 'BYE'
  | 'NAME'
  | 'FALLBACK';

interface AnalysisResult {
  isNegated: boolean;
  orderedItems: PersonaBrainItem[];
  negatedItems: PersonaBrainItem[];
  intent: PersonaIntent;
  matchedItemForPrice?: PersonaBrainItem;
}

/**
 * Finds menu items matching the text from a persona's brain.
 */
function findMatchingItems(
  text: string,
  items: PersonaBrainItem[]
): PersonaBrainItem[] {
  const norm = ` ${normalize(text)} `;
  const matches: PersonaBrainItem[] = [];
  for (const item of items) {
    for (const key of item.keys) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${escaped}\\b`, 'i');
      if (reg.test(norm)) {
        if (!matches.some((m) => m.name === item.name)) {
          matches.push(item);
        }
        break;
      }
    }
  }
  return matches;
}

/**
 * Performs clause-based analysis on the cleaned input:
 * Splits on commas, periods, semicolons, and conjunctions ("but", "aadre").
 * Separates items into negated vs ordered.
 */
function analyzeClausesAndIntent(
  rawText: string,
  brainItems: PersonaBrainItem[]
): AnalysisResult {
  const normFull = normalize(rawText);

  // Split into clauses by punctuation or conjunctions
  const clauses = normFull
    .split(/[,.;!?]|\b(but|aadre|aadare|adre)\b/i)
    .map((c) => (c || '').trim())
    .filter((c) => c.length > 0);

  const orderedItems: PersonaBrainItem[] = [];
  const negatedItems: PersonaBrainItem[] = [];
  let anyClauseNegated = false;

  for (const clause of clauses) {
    const isClauseNeg = detectNegation(clause);
    if (isClauseNeg) anyClauseNegated = true;

    const matched = findMatchingItems(clause, brainItems);
    for (const item of matched) {
      if (isClauseNeg) {
        if (!negatedItems.some((n) => n.name === item.name)) {
          negatedItems.push(item);
        }
      } else {
        if (!orderedItems.some((o) => o.name === item.name)) {
          orderedItems.push(item);
        }
      }
    }
  }

  // Filter out any ordered items that were explicitly negated.
  // If there was any negation in the sentence, an item in a non-negated clause is only an order
  // if that clause contains affirmative ordering words (e.g. one, ondu, beku, kodi, order, etc.)
  // Otherwise, the item was part of the query being negated (e.g. "Majestic hogbeka? Illa beda.")
  const finalOrderedItems = orderedItems.filter((item) => {
    if (negatedItems.some((n) => n.name === item.name)) return false;
    if (anyClauseNegated) {
      const clauseWithItem = clauses.find(
        (c) => !detectNegation(c) && findMatchingItems(c, [item]).length > 0
      );
      if (clauseWithItem) {
        const hasAffirmativeOrderWord =
          /\b(one|ondu|eradu|two|mooru|three|beku|kodi|kotri|order|give|want|need|bring|tari|pack)\b/i.test(
            clauseWithItem
          );
        if (!hasAffirmativeOrderWord) {
          if (!negatedItems.some((n) => n.name === item.name)) {
            negatedItems.push(item);
          }
          return false;
        }
      }
    }
    return true;
  });

  // Overall text negation check
  const fullTextNegated = detectNegation(normFull) || anyClauseNegated;

  // RULE: if isNegated on a single clause with no positive items, NO item-order intent may fire
  const isOverallNegated =
    fullTextNegated && finalOrderedItems.length === 0;

  // 1. NEGATION_INTENT (isNegated true) — always wins over everything
  if (isOverallNegated) {
    // If no clause-level item was caught, check if the full text mentions a negated item
    if (negatedItems.length === 0) {
      const fullMatches = findMatchingItems(normFull, brainItems);
      negatedItems.push(...fullMatches);
    }
    return {
      isNegated: true,
      orderedItems: [],
      negatedItems,
      intent: 'NEGATION_INTENT',
    };
  }

  // 2. AFFIRM
  if (
    /^(yes|ok|okay|sari|haudhu|haudu|sure|fine|howdu|sari\s+boss|correct)\b/i.test(
      normFull
    )
  ) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'AFFIRM',
    };
  }

  // 3. GREETING
  if (
    /^(hi|hello|hey|namaste|namaskara|good\s+morning|good\s+evening)\b/i.test(
      normFull
    ) ||
    normFull.includes('namaskara') ||
    normFull.includes('namaste')
  ) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'GREETING',
    };
  }

  // 4. PRICE_QUERY (AND NOT isNegated)
  if (
    /(eshtu|how\s+much|price|rate|charge|rent|bill|cost|kitna|eshta)/i.test(
      normFull
    )
  ) {
    const itemMatches = findMatchingItems(normFull, brainItems);
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'PRICE_QUERY',
      matchedItemForPrice: itemMatches[0],
    };
  }

  // 5. ORDER_ITEM (active persona menu item keywords AND NOT isNegated)
  if (finalOrderedItems.length > 0) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'ORDER_ITEM',
    };
  }

  // 6. REQUEST (AND NOT isNegated)
  if (
    /(beku|kodi|kotri|want|need|give|ondu|one\s+|bring|tari|tarri|order)/i.test(
      normFull
    )
  ) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'REQUEST',
    };
  }

  // 7. LOCATION
  if (
    /(elli|where|route|stop|bus|direction|daari|hege|doora|far|mumbai|bombay|majestic|koramangala|airport|station)/i.test(
      normFull
    )
  ) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'LOCATION',
    };
  }

  // 8. TIME
  if (
    /(yavaga|when|timing|time|open|close|bega|how\s+long)/i.test(normFull)
  ) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'TIME',
    };
  }

  // 9. THANKS
  if (/(dhanyavada|thanks|thank)/i.test(normFull)) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'THANKS',
    };
  }

  // 10. BYE
  if (
    /(bye|hoguttene|see\s+you|matte\s+bartini|bande\s+bartini|hogi\s+bartini|sigona)/i.test(
      normFull
    )
  ) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'BYE',
    };
  }

  // 11. NAME
  if (/(hesaru|your\s+name|who\s+are\s+you|yaaru)/i.test(normFull)) {
    return {
      isNegated: false,
      orderedItems: finalOrderedItems,
      negatedItems,
      intent: 'NAME',
    };
  }

  // 12. FALLBACK
  return {
    isNegated: false,
    orderedItems: finalOrderedItems,
    negatedItems,
    intent: 'FALLBACK',
  };
}

// =========================================================================
// PART D — INTENT → RESPONSE GENERATOR
// =========================================================================

/**
 * Picks the next negation line in round-robin sequence without repeating back-to-back.
 */
function getNextNegationLine(personaId: string, lines: string[]): string {
  if (!lines || lines.length === 0) {
    return 'Sari sir, bejaar madbedi! Innu enu beku?';
  }
  const lastIdx = personaNegationRotation[personaId] ?? -1;
  let nextIdx = (lastIdx + 1) % lines.length;
  if (lines.length > 1 && nextIdx === lastIdx) {
    nextIdx = (nextIdx + 1) % lines.length;
  }
  personaNegationRotation[personaId] = nextIdx;
  return lines[nextIdx];
}

/**
 * Builds the appropriate persona reply given intent and active character domain.
 */
export function replyTo(
  persona: ScenarioCard | null,
  cleanedText: string,
  _history: AnnaChatTurn[] = []
): PersonaReply {
  const norm = normalize(cleanedText);
  const pId = persona?.id || 'anna';
  const brain = persona?.brain || DEFAULT_ANNA_BRAIN;

  const analysis = analyzeClausesAndIntent(cleanedText, brain.items);
  const { intent, orderedItems, negatedItems, matchedItemForPrice } = analysis;

  // Add a single rotating nudge if user asked exclusively in English and tips preference is enabled
  const isEnglishOnly = isEnglishOnlyText(cleanedText);
  const tipsEnabled = getKaliyonaPrefs().tips;
  const englishNudge =
    isEnglishOnly && tipsEnabled
      ? ENGLISH_TIPS[englishTipIndex++ % ENGLISH_TIPS.length]
      : '';

  // -------------------------------------------------------------------------
  // 1. NEGATION INTENT: Always wins, rotation guaranteed, relieves item if mentioned
  // -------------------------------------------------------------------------
  if (intent === 'NEGATION_INTENT') {
    const isDarshini = pId === 'darshini' || pId === 'darshini-waiter';
    const hasCoffeeNegation = negatedItems.some(
      (item) =>
        item.keys.includes('coffee') ||
        item.keys.includes('kaapi') ||
        item.name.toLowerCase().includes('coffee')
    );

    // Special item relieving: user said "I don't want coffee" -> waiter suggests tea
    if (isDarshini && hasCoffeeNegation) {
      return {
        script: 'ಸರಿ ಸರಿ! ಕಾಫಿ ಇಲ್ಲ ಅಂದ್ರೆ ಟೀ ಇದೆ ಸರ್?',
        kanglish: `Sari sari! Coffee illa andre tea idde sir?${englishNudge}`,
        english: 'Alright! If no coffee, tea is available sir?',
        mood: 'happy',
      };
    }

    // Standard round-robin negation rotation
    const rawLine = getNextNegationLine(pId, brain.negationLines);
    const lineDetails = getLineDetails(rawLine);

    return {
      script: lineDetails.script,
      kanglish: `${rawLine}${englishNudge}`,
      english: lineDetails.english,
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 2. AFFIRM: persona affirm line
  // -------------------------------------------------------------------------
  if (intent === 'AFFIRM') {
    const affirmLine =
      brain.affirmLines[0] || 'Sari boss, eradu nimisha!';
    const lineDetails = getLineDetails(affirmLine);

    return {
      script: lineDetails.script,
      kanglish: `${affirmLine}${englishNudge}`,
      english: lineDetails.english,
      mood: 'excited',
    };
  }

  // -------------------------------------------------------------------------
  // 3. GREETING
  // -------------------------------------------------------------------------
  if (intent === 'GREETING') {
    if (persona?.introLines && persona.introLines.length > 0) {
      const intro = persona.introLines[0];
      return {
        script: intro.script,
        kanglish: `${intro.kanglish}${englishNudge}`,
        english: `Namaste! I am ${persona.title}. How can I help you?`,
        mood: 'happy',
      };
    }

    return {
      script: 'ನಮಸ್ಕಾರ ಗುರು! ಹೆಗಿದ್ದೀರಾ? ನಾನು ಅಣ್ಣ, ನಿಮ್ಮ ಬೆಂಗಳೂರು ಬಡ್ಡಿ!',
      kanglish: `Namaskara guru! Hegiddira? Naanu Anna, nimma Bengaluru buddy!${englishNudge}`,
      english: "Namaskara friend! How are you? I'm Anna, your Bengaluru buddy!",
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 4. PRICE QUERY: item-specific OR lists 2-3 prices
  // -------------------------------------------------------------------------
  if (intent === 'PRICE_QUERY') {
    if (matchedItemForPrice) {
      return {
        script: `${matchedItemForPrice.nameKn} ${matchedItemForPrice.price} ಸರ್!`,
        kanglish: `${matchedItemForPrice.name} ${matchedItemForPrice.price} sir!${englishNudge}`,
        english: `${matchedItemForPrice.name} is ${matchedItemForPrice.price} sir!`,
        mood: 'happy',
      };
    }

    // Show 2-3 prices from menu
    if (pId === 'darshini' || pId === 'darshini-waiter') {
      return {
        script: 'ಇಡ್ಲಿ ₹30, ದೋಸೆ ₹50, ಕಾಫಿ ₹20 ಸರ್!',
        kanglish: `Idli ₹30, dose ₹50, kaapi ₹20 sir!${englishNudge}`,
        english: 'Idli ₹30, dosa ₹50, coffee ₹20 sir!',
        mood: 'happy',
      };
    }
    if (pId === 'auto') {
      return {
        script: 'ಬೇಸ್ ₹40, ಕಿಮೀ ₹15, ಮೆಜೆಸ್ಟಿಕ್ ₹120 ಸರ್!',
        kanglish: `Base ₹40, per km ₹15, Majestic ₹120 sir!${englishNudge}`,
        english: 'Base ₹40, per km ₹15, Majestic ₹120 sir!',
        mood: 'happy',
      };
    }
    if (pId === 'bmtc' || pId === 'bus-conductor') {
      return {
        script: 'ಲೋಕಲ್ ₹10, ಮೆಜೆಸ್ಟಿಕ್ ₹25, ಡೈಲಿ ಪಾಸ್ ₹70 ಸರ್!',
        kanglish: `Local ₹10, Majestic ₹25, Daily pass ₹70 sir!${englishNudge}`,
        english: 'Local ₹10, Majestic ₹25, Daily pass ₹70 sir!',
        mood: 'happy',
      };
    }
    if (pId === 'market') {
      return {
        script: 'ಟೊಮೇಟೊ ₹40/ಕೆಜಿ, ಈರುಳ್ಳಿ ₹35/ಕೆಜಿ, ಆಲೂಗಡ್ಡೆ ₹30/ಕೆಜಿ ಸರ್!',
        kanglish: `Tomato ₹40/kg, onion ₹35/kg, potato ₹30/kg sir!${englishNudge}`,
        english: 'Tomato ₹40/kg, onion ₹35/kg, potato ₹30/kg sir!',
        mood: 'happy',
      };
    }
    if (pId === 'landlord-aunty') {
      return {
        script: 'ಬಾಡಿಗೆ ತಿಂಗಳಿಗೆ ₹12,000, ಅಡ್ವಾನ್ಸ್ ₹50,000, ನೀರು ₹500 ಆಂಟಿ!',
        kanglish: `Rent ₹12,000, advance ₹50,000, water ₹500 aunty!${englishNudge}`,
        english: 'Rent ₹12,000, advance ₹50,000, water ₹500 aunty!',
        mood: 'thinking',
      };
    }
    if (pId === 'traffic-police') {
      return {
        script: 'ಹೆಲ್ಮೆಟ್ ಇಲ್ಲದ್ದಕ್ಕೆ ₹500, ಸಿಗ್ನಲ್ ಜಂಪ್ ₹1,000 ಫೈನ್ ಸರ್!',
        kanglish: `Helmet fine ₹500, signal jump ₹1,000 sir!${englishNudge}`,
        english: 'Helmet fine ₹500, signal jump fine ₹1,000 sir!',
        mood: 'thinking',
      };
    }
    if (pId === 'pharmacy-bhaiya') {
      return {
        script: 'ಡೋಲೋ ₹30, ಪ್ಯಾರಸಿಟಮಾಲ್ ₹15, ಬ್ಯಾಂಡೇಜ್ ₹30 ಸರ್!',
        kanglish: `Dolo ₹30, paracetamol ₹15, bandage ₹30 sir!${englishNudge}`,
        english: 'Dolo ₹30, paracetamol ₹15, bandage ₹30 sir!',
        mood: 'happy',
      };
    }
    if (pId === 'pg-owner') {
      return {
        script: 'ಟೂ-ಶೇರಿಂಗ್ ₹8,000, ಸಿಂಗಲ್ ₹12,000, ಮೂರು ಹೊತ್ತು ಊಟ ಸೇರಿ ಸರ್!',
        kanglish: `2-sharing ₹8,000, single ₹12,000, food included sir!${englishNudge}`,
        english: '2-sharing ₹8,000, single ₹12,000, food included sir!',
        mood: 'happy',
      };
    }
    if (pId === 'shopkeeper') {
      return {
        script: 'ಹಾಲು ₹28, ಅಕ್ಕಿ ₹60/ಕೆಜಿ, ಸಕ್ಕರೆ ₹45/ಕೆಜಿ ಅಣ್ಣ!',
        kanglish: `Milk ₹28, rice ₹60/kg, sugar ₹45/kg anna!${englishNudge}`,
        english: 'Milk ₹28, rice ₹60/kg, sugar ₹45/kg brother!',
        mood: 'happy',
      };
    }

    // Generic price response
    const top3 = brain.items.slice(0, 3);
    const kanglishList = top3.map((i) => `${i.name} ${i.price}`).join(', ');
    const scriptList = top3.map((i) => `${i.nameKn} ${i.price}`).join(', ');
    return {
      script: `${scriptList} ಸರ್!`,
      kanglish: `${kanglishList} sir!${englishNudge}`,
      english: `${kanglishList} sir!`,
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 5. ORDER ITEM: confirms THAT item + price
  // -------------------------------------------------------------------------
  if (intent === 'ORDER_ITEM') {
    if (orderedItems.length === 1) {
      const item = orderedItems[0];
      return {
        script: `ಒಂದು ${item.nameKn} ${item.price}, ಎರಡು ನಿಮಿಷ ಸರ್!`,
        kanglish: `Ondu ${item.name} ${item.price}, eradu nimisha sir!${englishNudge}`,
        english: `One ${item.name} ${item.price}, two minutes sir!`,
        mood: 'excited',
      };
    }

    // Multiple items
    const namesKn = orderedItems.map((i) => `ಒಂದು ${i.nameKn} ${i.price}`).join(' ಮತ್ತು ');
    const namesKang = orderedItems.map((i) => `Ondu ${i.name} ${i.price}`).join(' mathu ');
    return {
      script: `${namesKn}, ಎರಡು ನಿಮಿಷ ಸರ್!`,
      kanglish: `${namesKang}, eradu nimisha sir!${englishNudge}`,
      english: `${orderedItems.map((i) => `one ${i.name} ${i.price}`).join(' and ')}, two minutes sir!`,
      mood: 'excited',
    };
  }

  // -------------------------------------------------------------------------
  // 6. REQUEST (General want / need / kodi)
  // -------------------------------------------------------------------------
  if (intent === 'REQUEST') {
    if (pId === 'darshini' || pId === 'darshini-waiter') {
      return {
        script: 'ಆಯ್ತು ಬಾಸ್! ಎರಡು ನಿಮಿಷದಲ್ಲಿ ಬಿಸಿ ಬಿಸಿ ತರ್ತೀನಿ.',
        kanglish: `Aaytu boss! Eradu nimishadalli bisi bisi tartini.${englishNudge}`,
        english: 'Done boss! In two minutes I will bring it piping hot.',
        mood: 'excited',
      };
    }
    if (pId === 'auto') {
      return {
        script: 'ಕೂತ್ಕೊಳ್ಳಿ ಸರ್, ಬೇಗ ಹೋಗೋಣ!',
        kanglish: `KootkoLLi sir, bega hogona!${englishNudge}`,
        english: 'Please sit sir, lets go quickly!',
        mood: 'happy',
      };
    }
    if (pId === 'bmtc' || pId === 'bus-conductor') {
      return {
        script: 'ತಗೊಳ್ಳಿ ಟಿಕೆಟ್, ಚಿಲ್ಲರೆ ಕೈಯಲ್ಲಿ ಇಟ್ಕೊಳ್ಳಿ.',
        kanglish: `TogoLLi ticket, chillare kaiyalli itkoLLi.${englishNudge}`,
        english: 'Take ticket, keep change in hand.',
        mood: 'happy',
      };
    }
    if (pId === 'pharmacy-bhaiya') {
      return {
        script: 'ಇಲ್ಲಿದೆ ಸರ್, ದಿನಕ್ಕೆ ಎರಡು ಸಲ ಊಟದ ನಂತರ ತಗೊಳ್ಳಿ.',
        kanglish: `Illide sir, dinakke eradu sala ootada nanthara togoLLi.${englishNudge}`,
        english: 'Here it is sir, take it twice a day after meals.',
        mood: 'happy',
      };
    }
    if (pId === 'market' || pId === 'shopkeeper') {
      return {
        script: 'ಖಂಡಿತ ಅಣ್ಣ, ಕವರ್‌ನಲ್ಲಿ ಹಾಕಿ ಕೊಡ್ತೀನಿ.',
        kanglish: `Khanditha anna, cover-nalli haaki kodtini.${englishNudge}`,
        english: 'Certainly brother, I will pack it in a cover.',
        mood: 'happy',
      };
    }
    return {
      script: 'ಸರಿ ಗುರು! ಏನು ಬೇಕೋ ಖುಷಿಯಿಂದ ಕೇಳಿ, "ಕೊಡಿ" ಅಂದ್ರೆ ಗೌರವ.',
      kanglish: `Sari guru! Enu beko khushiyinda keli, "kodi" andre gourava.${englishNudge}`,
      english: 'Alright friend! Ask freely, saying "kodi" shows respect.',
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 7. LOCATION / ROUTE / MUMBAI
  // -------------------------------------------------------------------------
  if (intent === 'LOCATION') {
    // Playful special case: Mumbai redirect
    if (norm.includes('mumbai') || norm.includes('bombay')) {
      if (pId === 'auto') {
        return {
          script: 'ಮುಂಬೈಗೆ ಆಟೋ ಹೋಗಲ್ಲ ಸಾರ್! ಕೆಂಪೇಗೌಡ ಬಸ್ ಸ್ಟೇಷನ್‌ಗೆ ಹೋಗಿ ಟ್ರೈನ್ ಹಿಡೀರಿ!',
          kanglish: 'Mumbai ge auto hogalla saar! Kempegowda Bus Station ge hogi train hidiri!',
          english: "Auto doesn't go to Mumbai sir! Go to Kempegowda Bus Station and catch a train!",
          mood: 'excited',
        };
      }
      if (pId === 'bus-conductor' || pId === 'bmtc') {
        return {
          script: 'ಇದು ಬಿಎಂಟಿಸಿ ಲೋಕಲ್ ಬಸ್ ಸಾರ್! ಮುಂಬೈಗೆ ಮೆಜೆಸ್ಟಿಕ್‌ನಲ್ಲಿ ಕೆಎಸ್‌ಆರ್‌ಟಿಸಿ ಸ್ಲೀಪರ್ ತಗೋಬೇಕು.',
          kanglish: 'Idhu BMTC local bus saar! Mumbai ge Majestic-nalli KSRTC sleeper togobeku.',
          english: 'This is BMTC local bus sir! For Mumbai you must take KSRTC sleeper at Majestic.',
          mood: 'thinking',
        };
      }
      if (pId === 'traffic-police') {
        return {
          script: 'ಮುಂಬೈನಾ? ಮೊದಲು ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಟ್ರಾಫಿಕ್ ದಾಟಿ ಆಮೇಲೆ ಯೋಚನೆ ಮಾಡಿ!',
          kanglish: 'Mumbai na? Modalu Silk Board traffic daati aamele yochane maadi!',
          english: 'Mumbai? First cross Silk Board traffic and then think about it!',
          mood: 'excited',
        };
      }
      if (pId === 'darshini' || pId === 'darshini-waiter') {
        return {
          script: 'ಮುಂಬೈ ವಡಾ ಪಾವ್ ಬಿಡಿ ಬಾಸ್, ಇಲ್ಲಿ ಬಿಸಿ ಬಿಸಿ ಮಸಾಲೆ ದೋಸೆ ತಿನ್ನಿ!',
          kanglish: 'Mumbai vada pav bidi boss, illi bisi bisi masale dose thinni!',
          english: 'Leave Mumbai vada pav boss, have piping hot masala dosa here!',
          mood: 'excited',
        };
      }
      if (pId === 'landlord-aunty' || pId === 'pg-owner') {
        return {
          script: 'ಮುಂಬೈಗೆ ಹೋಗ್ಬೇಡಿ, ಬೆಂಗಳೂರೇ ಬೆಸ್ಟ್! ಇಲ್ಲಿ ಕಾವೇರಿ ನೀರು ಮತ್ತು ಸೂಪರ್ ವೆದರ್ ಇದೆ.',
          kanglish: 'Mumbai ge hogbedi, Bengalure best! Illi Cauvery neeru mathu super weather ide.',
          english: "Don't go to Mumbai, Bengaluru is the best! We have Cauvery water and great weather.",
          mood: 'happy',
        };
      }
      return {
        script: 'ಮುಂಬೈಗೆ ಆಟೋ ಹೋಗಲ್ಲ ಗುರು! ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಿ ಕೆಎಸ್‌ಆರ್‌ಟಿಸಿ ಬಸ್ ಹಿಡೀರಿ.',
        kanglish: 'Mumbai ge auto hogalla guru! Majestic ge hogi KSRTC bus hidiri.',
        english: "Auto doesn't go to Mumbai friend! Go to Majestic and catch a KSRTC bus.",
        mood: 'excited',
      };
    }

    if (pId === 'auto') {
      return {
        script: 'ನೇರವಾಗಿ ಹೋಗಿ ರೈಟ್ ತಗೊಂಡ್ರೆ ಬರುತ್ತೆ ಸರ್, ಕೂತ್ಕೊಳ್ಳಿ ಹೋಗೋಣ.',
        kanglish: `Neravaagi hogi right thogondre baratte sir, kootkoLLi hogona.${englishNudge}`,
        english: 'Go straight and take right it will come sir, sit down lets go.',
        mood: 'happy',
      };
    }
    if (pId === 'bus-conductor' || pId === 'bmtc') {
      return {
        script: 'ಮುಂದಿನ ಸ್ಟಾಪ್ ಅಲ್ಲೇ ಇಳೀಬೇಕು ನೀವು. ಬೆಲ್ ಹೊಡೀತೀನಿ ರೆಡಿ ಇರಿ.',
        kanglish: `Mundina stop alle iLeebeku neevu. Bell hodeethini ready iri.${englishNudge}`,
        english: 'You need to get down at the very next stop. I will ring the bell, be ready.',
        mood: 'happy',
      };
    }
    if (pId === 'traffic-police') {
      return {
        script: 'ಇದು ಒನ್-ವೇ ರಸ್ತೆ! ಯು-ಟರ್ನ್ ತಗೊಂಡು ಮೇನ್ ರೋಡ್‌ನಲ್ಲಿ ಹೋಗಿ.',
        kanglish: `Idhu one-way raste! U-turn thagondu main road-nalli hogi.${englishNudge}`,
        english: 'This is a one-way road! Take a U-turn and go on the main road.',
        mood: 'thinking',
      };
    }
    if (pId === 'neighbor-uncle') {
      return {
        script: 'ಇಲ್ಲೇ ಹತ್ತಿರದಲ್ಲಿದೆ ಕಣ್ರೀ, ವಾಕಬಲ್ ಡಿಸ್ಟೆನ್ಸ್ ಅಷ್ಟೇ.',
        kanglish: `Ille hatthiradallide kanree, walkable distance ashte.${englishNudge}`,
        english: 'It is right nearby friend, just walkable distance.',
        mood: 'happy',
      };
    }
    return {
      script: 'ಹೋಗೋ ದಾರಿ ಗೊತ್ತಿಲ್ಲ ಅಂದ್ರೆ "ಎಲ್ಲಿ ಹೋಗ್ಬೇಕು?" ಅಥವಾ "ಹೇಗೆ ಹೋಗ್ಬೇಕು?" ಅಂತ ಕೇಳಿ!',
      kanglish: `Hogo daari gottilla andre "Elli hogbeku?" athava "Hege hogbeku?" antha keli!${englishNudge}`,
      english: "If you don't know the route, ask 'Elli hogbeku?' or 'Hege hogbeku?'",
      mood: 'excited',
    };
  }

  // -------------------------------------------------------------------------
  // 8. TIME
  // -------------------------------------------------------------------------
  if (intent === 'TIME') {
    if (pId === 'darshini' || pId === 'darshini-waiter') {
      return {
        script: 'ಬಿಸಿ ಬಿಸಿ ತಿಂಡಿ ಸದಾ ರೆಡಿ ಇರುತ್ತೆ ಬಾಸ್, ಬೇಗ ಬನ್ನಿ!',
        kanglish: `Bisi bisi thindi sada ready irutte boss, bega banni!${englishNudge}`,
        english: 'Piping hot snacks are always ready boss, come quickly!',
        mood: 'happy',
      };
    }
    if (pId === 'bmtc' || pId === 'bus-conductor') {
      return {
        script: 'ಪ್ರತಿ ೧೦ ನಿಮಿಷಕ್ಕೆ ಒಂದು ಬಸ್ ಬರುತ್ತೆ ಸಾರ್!',
        kanglish: `Prathi 10 nimishakke ondu bus baratte saar!${englishNudge}`,
        english: 'Every 10 minutes a bus arrives sir!',
        mood: 'happy',
      };
    }
    if (pId === 'landlord-aunty') {
      return {
        script: 'ಕಾವೇರಿ ನೀರು ಬೆಳಗ್ಗೆ ೬ ಗಂಟೆಗೆ ಬರುತ್ತೆ, ಗೇಟ್ ೧೦:೩೦ ಕ್ಕೆ ಲಾಕ್ ಆಗುತ್ತೆ.',
        kanglish: `Cauvery neeru beLagge 6 gantege baratte, gate 10:30 kke lock.${englishNudge}`,
        english: 'Cauvery water comes at 6 AM, gate locks at 10:30 PM.',
        mood: 'happy',
      };
    }
    if (pId === 'pg-owner') {
      return {
        script: 'ಊಟ ಬೆಳಗ್ಗೆ ೮-೧೦, ರಾತ್ರಿ ೮-೧೦ ಸರ್, ಗೇಟ್ ೧೦:೩೦ ಲಾಕ್!',
        kanglish: `Breakfast 8-10 AM, dinner 8-10 PM sir, gate locks at 10:30!${englishNudge}`,
        english: 'Breakfast 8-10 AM, dinner 8-10 PM sir, gate locks at 10:30!',
        mood: 'happy',
      };
    }
    return {
      script: 'ಟೈಮಿಂಗ್ ಬಗ್ಗೆ ಕೇಳೋಕೆ "ಯಾವಾಗ?" ಅಥವಾ "ಎಷ್ಟು ಹೊತ್ತು?" ಅಂತ ಕೇಳ್ತಾರೆ.',
      kanglish: `Timing bagge keloke "Yaavaga?" athava "Eshtu hottu?" antha heLtare.${englishNudge}`,
      english: 'To ask timing, they ask "Yaavaga?" (When?) or "Eshtu hottu?" (How long?).',
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 9. THANKS
  // -------------------------------------------------------------------------
  if (intent === 'THANKS') {
    if (pId === 'auto') {
      return {
        script: 'ವೆಲ್‌ಕಮ್ ಸರ್! ರೇಟಿಂಗ್ ೫ ಸ್ಟಾರ್ ಕೊಡಿ ಆ್ಯಪ್‌ನಲ್ಲಿ!',
        kanglish: `Welcome sir! Rating 5 star kodi app-nalli!${englishNudge}`,
        english: 'Welcome sir! Give a 5 star rating in the app!',
        mood: 'happy',
      };
    }
    if (pId === 'darshini' || pId === 'darshini-waiter') {
      return {
        script: 'ಥ್ಯಾಂಕ್ಸ್ ಬಾಸ್, ಮತ್ತೆ ಬನ್ನಿ! ಫಿಲ್ಟರ್ ಕಾಫಿ ಸದಾ ರೆಡಿ ಇರುತ್ತೆ.',
        kanglish: `Thanks boss, matte banni! Filter coffee sada ready irutte.${englishNudge}`,
        english: 'Thanks boss, come again! Filter coffee is always ready.',
        mood: 'happy',
      };
    }
    if (pId === 'neighbor-uncle') {
      return {
        script: 'ಅಯ್ಯೋ ಮೆನ್ಷನ್ ಮಾಡ್ಬೇಡಿ ಕಣ್ರೀ, ನಾವೆಲ್ಲ ಒಂದೇ ಏರಿಯಾ ಅಲ್ವಾ!',
        kanglish: `Ayyo mention maadbedi kanree, naavella onde area alva!${englishNudge}`,
        english: "Ayyo don't mention friend, we are all from the same area right!",
        mood: 'happy',
      };
    }
    return {
      script: 'ತುಂಬಾ ಧನ್ಯವಾದ ಗುರು! ಕನ್ನಡ ಕಲಿಯೋಕೆ ನಿಮ್ಮ ಉತ್ಸಾಹ ಸೂಪರ್!',
      kanglish: `Thumba dhanyavada guru! Kannada kaliyoke nimma utsaaha super!${englishNudge}`,
      english: 'Thank you very much friend! Your enthusiasm to learn Kannada is super!',
      mood: 'excited',
    };
  }

  // -------------------------------------------------------------------------
  // 10. BYE
  // -------------------------------------------------------------------------
  if (intent === 'BYE') {
    if (persona?.exitLine) {
      return {
        script: persona.exitLine.script,
        kanglish: `${persona.exitLine.kanglish}${englishNudge}`,
        english: 'See you again!',
        mood: 'happy',
      };
    }
    return {
      script: 'ಸರಿ ಗುರು, ಮತ್ತೆ ಸಿಗೋಣ! ಹುಷಾರಾಗಿ ಹೋಗಿ ಬನ್ನಿ.',
      kanglish: `Sari guru, matte sigona! Hushaaraagi hogi banni.${englishNudge}`,
      english: 'Alright friend, see you again! Take care and come back.',
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 11. NAME
  // -------------------------------------------------------------------------
  if (intent === 'NAME') {
    if (persona) {
      return {
        script: `ನಾನು ${persona.title}! ${persona.tagline}. ನಿಮಗೆ ಸಹಾಯ ಮಾಡ್ತೀನಿ.`,
        kanglish: `Naanu ${persona.title}! ${persona.tagline}. Nimage sahaaya maadtini.${englishNudge}`,
        english: `I am ${persona.title}! ${persona.tagline}. I am here to help you.`,
        mood: 'happy',
      };
    }
    return {
      script: 'ನನ್ನ ಹೆಸರು ಅಣ್ಣ! ನಿಮ್ಮ ಬೆಂಗಳೂರು ಲೋಕಲ್ ಫ್ರೆಂಡ್.',
      kanglish: `Nanna hesaru Anna! Nimma Bengaluru local friend.${englishNudge}`,
      english: 'My name is Anna! Your Bengaluru local friend.',
      mood: 'happy',
    };
  }

  // -------------------------------------------------------------------------
  // 12. FALLBACK: Persona-specific dontUnderstand line
  // -------------------------------------------------------------------------
  const dontUnderstandLine = brain.dontUnderstand;
  const lineDetails = getLineDetails(dontUnderstandLine);

  return {
    script: lineDetails.script,
    kanglish: `${dontUnderstandLine}${englishNudge}`,
    english: lineDetails.english,
    mood: 'thinking',
  };
}
