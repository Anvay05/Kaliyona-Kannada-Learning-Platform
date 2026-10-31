import { isSpeechRecognitionSupported, getKannadaScriptForText } from './speechUtils';
import { LEXICON } from './lexicon';
import {
  mulberry32,
  sampleUnique,
  normalizeForKey,
  canonicalQuestionKey,
  canonicalOptionKey,
  buildUniqueMcqOptions,
} from './sampler';

// ============================================================================
// 1. CURRICULUM SCHEMA & TYPES (30-Unit, 5-Phase Kanglish Curriculum)
// ============================================================================

export type CEFRLevel = 'A1' | 'A1+' | 'A2' | 'A2+' | 'B1';

export interface PhaseDef {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  cefr: CEFRLevel;
  units: string[];
}

export type CurriculumItemType = 'word' | 'phrase' | 'sentence';
export type CurriculumItemFlag = 'chunk' | 'recog' | null;

export interface CurriculumItem {
  kn: string; // Kanglish text (PRIMARY learning text — Romanized Kannada only)
  en: string; // English meaning
  type: CurriculumItemType; // "word" | "phrase" | "sentence"
  frame: boolean; // true = hero sentence pattern (shown as FIRST exercise)
  flag: CurriculumItemFlag; // "chunk" | "recog" | null
}

export type CurriculumLessonType = 'normal' | 'checkpoint';

export interface CurriculumLessonInput {
  id: string; // e.g. "u1l1"
  title: string; // e.g. "Greetings"
  type: CurriculumLessonType; // "normal" | "checkpoint"
  reviewFrom?: string[]; // only for checkpoints: unit ids to sample
  note?: string; // optional special drill instruction
  items?: CurriculumItem[];
}

export interface CurriculumUnitInput {
  id: string; // "u1" .. "u30"
  title: string; // e.g. "Self Introduction"
  icon: string; // e.g. "👋"
  phase: 1 | 2 | 3 | 4 | 5;
  lessons: CurriculumLessonInput[];
}

export interface CurriculumDataSchema {
  phases: PhaseDef[];
  units: CurriculumUnitInput[];
}

// ============================================================================
// LEGACY & ENGINE-COMPATIBLE INTERFACES (preserved for LessonSessionEngine)
// ============================================================================

export interface ExerciseOption {
  kannada: string;
  translit: string;
  meaning: string;
}

export type ExerciseType =
  | 'mcq'
  | 'reverse_mcq'
  | 'translate_bank'
  | 'listen'
  | 'speak'
  | 'match';

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  kannada: string;
  translit: string;
  meaning: string;
  options?: ExerciseOption[];
  answer: string;
  wordChips?: string[];
  pairs?: ExerciseOption[];
  audioText: string;
  isFrameHero?: boolean;
  note?: string;
  stageNarration?: string;
  itemType?: CurriculumItemType;
  itemFlag?: CurriculumItemFlag;
}

export interface Lesson {
  id: string;
  title: string;
  type?: CurriculumLessonType;
  reviewFrom?: string[];
  note?: string;
  items?: CurriculumItem[];
  exercises: Exercise[];
  questionPool?: Exercise[];
}

export interface Level {
  id: string;
  levelNumber: 1 | 2 | 3 | 4 | 5;
  name: string;
  lessons: Lesson[];
}

export type UnitColorKey = 'blue' | 'cyan' | 'amber' | 'green' | 'error';

export interface Unit {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  icon: string;
  phase: 1 | 2 | 3 | 4 | 5;
  colorKey: UnitColorKey;
  lessons: Lesson[];
  levels: Level[];
}

// ============================================================================
// 5 PHASES DEFINITION (A1 -> B1, u1 -> u30)
// ============================================================================

export const COURSE_PHASES: PhaseDef[] = [
  {
    id: 1,
    name: 'Foundation',
    cefr: 'A1',
    units: ['u1', 'u2', 'u3', 'u4'],
  },
  {
    id: 2,
    name: 'Words & Wants',
    cefr: 'A1+',
    units: ['u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11'],
  },
  {
    id: 3,
    name: 'Relations & Action',
    cefr: 'A2',
    units: ['u12', 'u13', 'u14', 'u15', 'u16', 'u17', 'u18'],
  },
  {
    id: 4,
    name: 'The Rickshaw Ride',
    cefr: 'A2',
    units: ['u19', 'u20', 'u21', 'u22', 'u23', 'u24', 'u25'],
  },
  {
    id: 5,
    name: 'Fluency Stretch',
    cefr: 'B1',
    units: ['u26', 'u27', 'u28', 'u29', 'u30'],
  },
];

/**
 * Raw curriculum data store.
 * Phase 1: Foundation (A1) — Units u1–u4 (20 lessons).
 */
export const RAW_COURSE_DATA: CurriculumDataSchema = {
  phases: COURSE_PHASES,
  units: [
    // ========================================================================
    // UNIT u1 · Self Introduction · icon 👋 · phase 1 · cefr A1
    // ========================================================================
    {
      id: 'u1',
      title: 'Self Introduction',
      icon: '👋',
      phase: 1,
      lessons: [
        {
          id: 'u1_l1',
          title: 'Greetings',
          type: 'normal',
          items: [
            {
              kn: 'namaskara',
              en: 'hello',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hegiddira?',
              en: 'how are you?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'chennagidini',
              en: 'I am fine',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u1_l2',
          title: 'Name',
          type: 'normal',
          items: [
            {
              kn: 'nanna hesaru',
              en: 'my name',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna hesaru ___',
              en: 'my name is ___',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'ninna hesaru enu?',
              en: 'what is your name?',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u1_l3',
          title: 'Yes, no, okay',
          type: 'normal',
          items: [
            {
              kn: 'haudu',
              en: 'yes',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illa',
              en: 'no',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'sari',
              en: 'okay',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u1_l4',
          title: 'Me and my place',
          type: 'normal',
          items: [
            {
              kn: 'naanu',
              en: 'I / me',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'neenu',
              en: 'you',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna ooru',
              en: 'my hometown',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna ooru ___',
              en: 'my hometown is ___',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u1_l5',
          title: 'Full intro combo',
          type: 'normal',
          items: [
            {
              kn: 'nanna hesaru ___, nanna ooru ___',
              en: 'my name is ___, my hometown is ___',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'tumba santosha',
              en: 'very happy / nice to meet you',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u2 · Politeness Pack · icon 🙏 · phase 1 · cefr A1
    // ========================================================================
    {
      id: 'u2',
      title: 'Politeness Pack',
      icon: '🙏',
      phase: 1,
      lessons: [
        {
          id: 'u2_l1',
          title: 'Thanks',
          type: 'normal',
          items: [
            {
              kn: 'dhanyavada',
              en: 'thank you',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'tumba dhanyavada',
              en: 'thank you very much',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u2_l2',
          title: 'Sorry',
          type: 'normal',
          items: [
            {
              kn: 'kshamisi',
              en: 'sorry / excuse me',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'parvagilla',
              en: "it's okay / no problem",
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u2_l3',
          title: 'Please lite',
          type: 'normal',
          items: [
            {
              kn: 'dayavittu',
              en: 'please',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'ondu minute',
              en: 'one minute',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u2_l4',
          title: 'Goodbyes',
          type: 'normal',
          items: [
            {
              kn: 'hogi bartini',
              en: "I'll go and come back",
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
            {
              kn: 'sigona',
              en: 'see you',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'banni',
              en: 'come / welcome',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u2_l5',
          title: 'Respect words',
          type: 'normal',
          items: [
            {
              kn: 'neevu',
              en: 'you (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ninna',
              en: 'your',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'guru',
              en: 'buddy (casual Bengaluru slang)',
              type: 'word',
              frame: false,
              flag: 'chunk',
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u3 · Question Words · icon ❓ · phase 1 · cefr A1
    // ========================================================================
    {
      id: 'u3',
      title: 'Question Words',
      icon: '❓',
      phase: 1,
      lessons: [
        {
          id: 'u3_l1',
          title: 'What',
          type: 'normal',
          items: [
            {
              kn: 'enu?',
              en: 'what?',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'idu',
              en: 'this',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'idu enu?',
              en: 'what is this?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u3_l2',
          title: 'Where',
          type: 'normal',
          items: [
            {
              kn: 'elli?',
              en: 'where?',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ide',
              en: 'is / there is',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'elli ide?',
              en: 'where is it?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u3_l3',
          title: 'Who',
          type: 'normal',
          items: [
            {
              kn: 'yaaru?',
              en: 'who?',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'neenu yaaru?',
              en: 'who are you?',
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'avanu yaaru?',
              en: 'who is he?',
              type: 'sentence',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u3_l4',
          title: 'How much',
          type: 'normal',
          items: [
            {
              kn: 'eshtu?',
              en: 'how much / how many?',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'eshtu aaytu?',
              en: 'how much is it?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u3_l5',
          title: 'When lite',
          type: 'normal',
          items: [
            {
              kn: 'yaavaga?',
              en: 'when?',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'iga',
              en: 'now',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'aaga',
              en: 'then',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u4 · Numbers 1–20 · icon 🔢 · phase 1 · cefr A1
    // ========================================================================
    {
      id: 'u4',
      title: 'Numbers 1–20',
      icon: '🔢',
      phase: 1,
      lessons: [
        {
          id: 'u4_l1',
          title: 'Numbers 1–5',
          type: 'normal',
          items: [
            { kn: 'ondu', en: '1', type: 'word', frame: false, flag: null },
            { kn: 'eradu', en: '2', type: 'word', frame: false, flag: null },
            { kn: 'mooru', en: '3', type: 'word', frame: false, flag: null },
            { kn: 'naalku', en: '4', type: 'word', frame: false, flag: null },
            { kn: 'aidu', en: '5', type: 'word', frame: false, flag: null },
          ],
        },
        {
          id: 'u4_l2',
          title: 'Numbers 6–10',
          type: 'normal',
          items: [
            { kn: 'aaru', en: '6', type: 'word', frame: false, flag: null },
            { kn: 'elu', en: '7', type: 'word', frame: false, flag: null },
            { kn: 'entu', en: '8', type: 'word', frame: false, flag: null },
            { kn: 'tombattu', en: '9', type: 'word', frame: false, flag: null },
            { kn: 'hattu', en: '10', type: 'word', frame: false, flag: null },
          ],
        },
        {
          id: 'u4_l3',
          title: 'Numbers 11–15',
          type: 'normal',
          items: [
            {
              kn: 'hannondondu',
              en: '11',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hanneradu',
              en: '12',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hadimooru',
              en: '13',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hadinaalku',
              en: '14',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hadinaidu',
              en: '15',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u4_l4',
          title: 'Numbers 16–20',
          type: 'normal',
          items: [
            {
              kn: 'hadinaaru',
              en: '16',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hadinelu',
              en: '17',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hadinentu',
              en: '18',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hattombattu',
              en: '19',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ippattu',
              en: '20',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u4_l5',
          title: 'Checkpoint & digit drill',
          type: 'checkpoint',
          reviewFrom: ['u1', 'u2', 'u3', 'u4'],
          note: 'include digit-matching drills — show the Kanglish number word and ask the learner to pick the correct digit (e.g. "hattu" → 10), and reverse (show digit 7 → pick "elu"). 12 exercises total, mixing these digit drills with review exercises sampled from u1–u4 items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u5 · Food Words · icon 🍛 · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u5',
      title: 'Food Words',
      icon: '🍛',
      phase: 2,
      lessons: [
        {
          id: 'u5_l1',
          title: 'Meals',
          type: 'normal',
          items: [
            {
              kn: 'oota',
              en: 'meal / food',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'anna',
              en: 'cooked rice',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'sambar',
              en: 'sambar',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u5_l2',
          title: 'Tiffin (snacks)',
          type: 'normal',
          items: [
            {
              kn: 'idli',
              en: 'idli',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'dose',
              en: 'dosa',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'vade',
              en: 'vada',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u5_l3',
          title: 'Non-veg & egg',
          type: 'normal',
          items: [
            {
              kn: 'chicken',
              en: 'chicken',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'mutton',
              en: 'mutton',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'motte',
              en: 'egg',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u5_l4',
          title: 'Fruit & veg',
          type: 'normal',
          items: [
            {
              kn: 'hannu',
              en: 'fruit',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'tarakari',
              en: 'vegetable',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'baalehannu',
              en: 'banana',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u5_l5',
          title: 'Tastes',
          type: 'normal',
          items: [
            {
              kn: 'sihi',
              en: 'sweet',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'khara',
              en: 'spicy',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'uppu',
              en: 'salt',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'khara jaasti',
              en: 'too spicy',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u6 · Drinks · icon ☕ · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u6',
      title: 'Drinks',
      icon: '☕',
      phase: 2,
      lessons: [
        {
          id: 'u6_l1',
          title: 'Water & milk',
          type: 'normal',
          items: [
            {
              kn: 'neeru',
              en: 'water',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'haalu',
              en: 'milk',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ondu neeru',
              en: 'one water / a water',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u6_l2',
          title: 'Hot drinks',
          type: 'normal',
          items: [
            {
              kn: 'coffee',
              en: 'coffee',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'tea',
              en: 'tea',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'bisi',
              en: 'hot',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'bisi coffee',
              en: 'hot coffee',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u6_l3',
          title: 'Cold drinks',
          type: 'normal',
          items: [
            {
              kn: 'juice',
              en: 'juice',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'majjige',
              en: 'buttermilk',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'thanna',
              en: 'cold',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u6_l4',
          title: 'Hot or cold',
          type: 'normal',
          items: [
            {
              kn: 'bisi neeru',
              en: 'hot water',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'thanna neeru',
              en: 'cold water',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'bisi ya thanna?',
              en: 'hot or cold?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u6_l5',
          title: 'Ordering style',
          type: 'normal',
          items: [
            {
              kn: 'ondu coffee',
              en: 'one coffee',
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
            {
              kn: 'eradu coffee',
              en: 'two coffees',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'ondu tea',
              en: 'one tea',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u7 · Places · icon 📍 · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u7',
      title: 'Places',
      icon: '📍',
      phase: 2,
      lessons: [
        {
          id: 'u7_l1',
          title: 'Home',
          type: 'normal',
          items: [
            {
              kn: 'mane',
              en: 'house / home',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'room',
              en: 'room',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna mane',
              en: 'my home',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u7_l2',
          title: 'Shops & food',
          type: 'normal',
          items: [
            {
              kn: 'angadi',
              en: 'shop',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hotel',
              en: 'restaurant',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'medical',
              en: 'pharmacy',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u7_l3',
          title: 'Work & study',
          type: 'normal',
          items: [
            {
              kn: 'office',
              en: 'office',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kelsa',
              en: 'work',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'college',
              en: 'college',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u7_l4',
          title: 'City spots',
          type: 'normal',
          items: [
            {
              kn: 'bus stand',
              en: 'bus stand',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'metro station',
              en: 'metro station',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'market',
              en: 'market',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u7_l5',
          title: 'Where combo',
          type: 'normal',
          items: [
            {
              kn: 'bus stand elli?',
              en: 'where is the bus stand?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'hotel elli?',
              en: 'where is the restaurant?',
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'Majestic elli?',
              en: 'where is Majestic?',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u8 · People · icon 👥 · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u8',
      title: 'People',
      icon: '👥',
      phase: 2,
      lessons: [
        {
          id: 'u8_l1',
          title: 'Parents',
          type: 'normal',
          items: [
            {
              kn: 'amma',
              en: 'mother',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'appa',
              en: 'father',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna amma',
              en: 'my mother',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u8_l2',
          title: 'Elder siblings',
          type: 'normal',
          items: [
            {
              kn: 'anna',
              en: 'elder brother',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'akka',
              en: 'elder sister',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna akka',
              en: 'my elder sister',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u8_l3',
          title: 'Younger siblings',
          type: 'normal',
          items: [
            {
              kn: 'thamma',
              en: 'younger brother',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'thangi',
              en: 'younger sister',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'nanna thangi',
              en: 'my younger sister',
              type: 'phrase',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u8_l4',
          title: 'Others',
          type: 'normal',
          items: [
            {
              kn: 'dost',
              en: 'friend',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'madam',
              en: 'madam',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'sir',
              en: 'sir',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u8_l5',
          title: 'People combo',
          type: 'normal',
          items: [
            {
              kn: 'avanu nanna dost',
              en: 'he is my friend',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'avalu nanna akka',
              en: 'she is my elder sister',
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanna amma appa',
              en: 'my mom and dad',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u9 · Want — Beku · icon 🙋 · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u9',
      title: 'Want — Beku',
      icon: '🙋',
      phase: 2,
      lessons: [
        {
          id: 'u9_l1',
          title: 'The magic word',
          type: 'normal',
          items: [
            {
              kn: 'beku',
              en: 'want / need',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage',
              en: 'to me',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u9_l2',
          title: 'First want sentence',
          type: 'normal',
          items: [
            {
              kn: 'nanage neeru beku',
              en: 'I want water',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'nanage oota beku',
              en: 'I want food',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u9_l3',
          title: 'Drink wants',
          type: 'normal',
          items: [
            {
              kn: 'nanage coffee beku',
              en: 'I want coffee',
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage tea beku',
              en: 'I want tea',
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage juice beku',
              en: 'I want juice',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u9_l4',
          title: 'Asking you',
          type: 'normal',
          items: [
            {
              kn: 'ninage',
              en: 'to you',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ninage beka?',
              en: 'do you want (it)?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'ninage coffee beka?',
              en: 'do you want coffee?',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u9_l5',
          title: 'Want drill',
          type: 'normal',
          reviewFrom: ['u5', 'u6', 'u7', 'u8'],
          note: 'drill lesson — generate exercises by plugging learned words from u5–u8 into the frame "nanage ___ beku" (e.g. "nanage dose beku", "nanage baalehannu beku"). These plugged variants may appear in MCQ, reverse MCQ, and speak exercises. No new items in this lesson.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u10 · Don't Want — Beda · icon 🚫 · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u10',
      title: "Don't Want — Beda",
      icon: '🚫',
      phase: 2,
      lessons: [
        {
          id: 'u10_l1',
          title: 'The other magic word',
          type: 'normal',
          items: [
            {
              kn: 'beda',
              en: "don't want",
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage beda',
              en: "I don't want (it)",
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u10_l2',
          title: 'Beda combos',
          type: 'normal',
          items: [
            {
              kn: 'nanage tea beda',
              en: "I don't want tea",
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage khara beda',
              en: "I don't want spicy",
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u10_l3',
          title: 'Beku or beda',
          type: 'normal',
          note: 'contrast drill — show a sentence, learner picks whether the speaker WANTS or DOESN\'T WANT. Use both items as MCQ stems with "wants / doesn\'t want" style English options.',
          items: [
            {
              kn: 'nanage coffee beku',
              en: 'I want coffee',
              type: 'sentence',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage coffee beda',
              en: "I don't want coffee",
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u10_l4',
          title: "No coffee vs don't want",
          type: 'normal',
          note: 'contrast drill teaching that "illa" = not available while "beda" = don\'t want. Never treat them as interchangeable distractors.',
          items: [
            {
              kn: 'coffee illa',
              en: 'there is no coffee / out of coffee',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'nanage coffee beda',
              en: "I don't want coffee",
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u10_l5',
          title: 'Beku-beda review',
          type: 'checkpoint',
          reviewFrom: ['u9', 'u10'],
          note: '12 exercises — sorting drill (beku pile vs beda pile) plus speak exercises on "nanage ___ beku / beda" sentences.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u11 · Money & Phase 2 Checkpoint · icon 💰 · phase 2 · cefr A1+
    // ========================================================================
    {
      id: 'u11',
      title: 'Money & Phase 2 Checkpoint',
      icon: '💰',
      phase: 2,
      lessons: [
        {
          id: 'u11_l1',
          title: 'Money words',
          type: 'normal',
          items: [
            {
              kn: 'rupayi',
              en: 'rupee',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'dabbu',
              en: 'money',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hana',
              en: 'money (formal)',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u11_l2',
          title: 'Big numbers',
          type: 'normal',
          items: [
            {
              kn: 'moovattu',
              en: '30',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nalvattu',
              en: '40',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'aivattu',
              en: '50',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nooru',
              en: '100',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u11_l3',
          title: 'Price talk',
          type: 'normal',
          items: [
            {
              kn: 'nooru rupayi',
              en: '100 rupees',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'aivattu rupayi',
              en: '50 rupees',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'chillare',
              en: 'loose change',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u11_l4',
          title: 'Real Bengaluru',
          type: 'normal',
          items: [
            {
              kn: 'bill eshtu?',
              en: 'how much is the bill?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'chillare ideya?',
              en: 'do you have change?',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u11_l5',
          title: 'Phase 2 checkpoint',
          type: 'checkpoint',
          reviewFrom: ['u5', 'u6', 'u7', 'u8', 'u9', 'u10'],
          note: '12 exercises sampling all of Phase 2 + money digit drills (moovattu → 30, nooru → 100 style, both directions). Include at least 2 speak exercises using beku/beda sentences.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u12 · Mine & Yours · icon 🤝 · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u12',
      title: 'Mine & Yours',
      icon: '🤝',
      phase: 3,
      lessons: [
        {
          id: 'u12_l1',
          title: 'Mine',
          type: 'normal',
          items: [
            {
              kn: 'nanna',
              en: 'my',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nannadu',
              en: 'mine',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'idu nannadu',
              en: 'this is mine',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u12_l2',
          title: 'Yours',
          type: 'normal',
          reviewFrom: ['u2'],
          note: '"ninna" (your) was already in u2 — reused in drills without duplicating.',
          items: [
            {
              kn: 'ninnadu',
              en: 'yours',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'idu ninnada?',
              en: 'is this yours?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'haudu nannadu',
              en: "yes, it's mine",
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u12_l3',
          title: 'His',
          type: 'normal',
          items: [
            {
              kn: 'avanu',
              en: 'he',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'avana',
              en: 'his',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'idu avanadu',
              en: 'this is his',
              type: 'sentence',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u12_l4',
          title: 'Her',
          type: 'normal',
          items: [
            {
              kn: 'avalu',
              en: 'she',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'avala',
              en: 'her',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'idu avaladu',
              en: 'this is hers',
              type: 'sentence',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u12_l5',
          title: 'Mine-yours combo',
          type: 'normal',
          reviewFrom: ['u2'],
          note: 'contrast drill — here you MAY deliberately mix nanna/ninna options in MCQ to test mine vs yours. This is an intentional exception to the usual no-lookalike rule.',
          items: [
            {
              kn: 'idu nanna mane',
              en: 'this is my house',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'idu nanna phone',
              en: 'this is my phone',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u13 · Ours, Yours (Respect) & Theirs · icon 👥 · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u13',
      title: 'Ours, Yours (Respect) & Theirs',
      icon: '👥',
      phase: 3,
      lessons: [
        {
          id: 'u13_l1',
          title: 'We & ours',
          type: 'normal',
          items: [
            {
              kn: 'naavu',
              en: 'we',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'namma',
              en: 'our',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nammadu',
              en: 'ours',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u13_l2',
          title: 'Namma combos',
          type: 'normal',
          items: [
            {
              kn: 'namma mane',
              en: 'our house',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'namma ooru',
              en: 'our hometown',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'namma Bengaluru',
              en: 'our Bengaluru',
              type: 'phrase',
              frame: false,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u13_l3',
          title: 'You (respectful)',
          type: 'normal',
          items: [
            {
              kn: 'neevu',
              en: 'you (respectful / plural)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nimma',
              en: 'your (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nimma hesaru enu?',
              en: 'what is your name? (polite)',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u13_l4',
          title: 'They & theirs',
          type: 'normal',
          items: [
            {
              kn: 'avaru',
              en: 'they / he or she (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'avara',
              en: 'their (respectful)',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'avara mane',
              en: 'their house',
              type: 'phrase',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u13_l5',
          title: 'Possession drill',
          type: 'normal',
          reviewFrom: ['u2', 'u12', 'u13'],
          note: '10-exercise drill mixing nanna / ninna / namma / nimma across all items in u12–u13. No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u14 · Basic Commands — Come, Go, Sit, Stop · icon 🚶 · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u14',
      title: 'Basic Commands — Come, Go, Sit, Stop',
      icon: '🚶',
      phase: 3,
      lessons: [
        {
          id: 'u14_l1',
          title: 'Come here',
          type: 'normal',
          note: '"illi" (here) looks like "ide" (is/available from u9). Never use "ide" as a distractor for "illi" or vice versa.',
          items: [
            {
              kn: 'baa',
              en: 'come (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illi',
              en: 'here',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illi baa',
              en: 'come here',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u14_l2',
          title: 'Go there',
          type: 'normal',
          note: '"alli" (there) and "illi" (here) are a contrast pair — teach the difference explicitly, do not mix as random distractors in the same 4-option MCQ unless the question specifically tests here vs there.',
          items: [
            {
              kn: 'hogu',
              en: 'go (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'alli',
              en: 'there',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'alli hogu',
              en: 'go there',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u14_l3',
          title: 'Sit',
          type: 'normal',
          items: [
            {
              kn: 'kootko',
              en: 'sit down (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illi kootko',
              en: 'sit here',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u14_l4',
          title: 'Stop & wait',
          type: 'normal',
          items: [
            {
              kn: 'nillu',
              en: 'stop / wait (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illi nillu',
              en: 'stop here (casual)',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u14_l5',
          title: 'Polite commands',
          type: 'normal',
          reviewFrom: ['u2'],
          note: '"banni" (come, respectful) was already introduced in u2 L4 — do NOT add it again as a new item here; reference the existing u2 item for review exercises so there is no duplicate key.',
          items: [
            {
              kn: 'koothukolli',
              en: 'please sit (respectful)',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u15 · Give, Take, Tell, Look · icon 🤲 · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u15',
      title: 'Give, Take, Tell, Look',
      icon: '🤲',
      phase: 3,
      lessons: [
        {
          id: 'u15_l1',
          title: 'Give',
          type: 'normal',
          items: [
            {
              kn: 'kodu',
              en: 'give (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kodi',
              en: 'give (respectful / please give)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'neeru kodi',
              en: 'please give water',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u15_l2',
          title: 'Take',
          type: 'normal',
          items: [
            {
              kn: 'thago',
              en: 'take (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'thagoli',
              en: 'please take (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'idu thagoli',
              en: 'please take this',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u15_l3',
          title: 'Tell / say',
          type: 'normal',
          items: [
            {
              kn: 'helu',
              en: 'tell (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'heli',
              en: 'please tell (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'innomme heli',
              en: 'please say that again',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u15_l4',
          title: 'Look & listen',
          type: 'normal',
          items: [
            {
              kn: 'nodu',
              en: 'look (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nodi',
              en: 'look (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illi nodi',
              en: 'look here',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'keli',
              en: 'listen / ask (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u15_l5',
          title: 'Restaurant power moves',
          type: 'normal',
          reviewFrom: ['u5', 'u6'],
          note: 'drill plugging u5–u6 food words into the "nanage ___ kodi" frame.',
          items: [
            {
              kn: 'nanage dose kodi',
              en: 'please give me a dosa',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'bill kodi',
              en: 'please give the bill',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u16 · Polite Commands (-i) & Auto Survival · icon 🛺 · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u16',
      title: 'Polite Commands (-i) & Auto Survival',
      icon: '🛺',
      phase: 3,
      lessons: [
        {
          id: 'u16_l1',
          title: 'The -i secret',
          type: 'normal',
          note: '"nillu" (u14) is for a person stopping on foot; "nillisi" is for a driver stopping a vehicle. Never use them as interchangeable distractors — add a 1-line hint card or contrast question.',
          items: [
            {
              kn: 'nillisi',
              en: 'please stop (the vehicle)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'illi nillisi',
              en: 'please stop here (to driver)',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'alli nillisi',
              en: 'please stop there (to driver)',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u16_l2',
          title: 'Speed & care',
          type: 'normal',
          items: [
            {
              kn: 'bega',
              en: 'fast / quickly',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nidhana',
              en: 'slowly',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'bega baa',
              en: 'come quickly',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'nidhana hogi',
              en: 'go slowly',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u16_l3',
          title: 'Wait a moment',
          type: 'normal',
          items: [
            {
              kn: 'ondu nimisha',
              en: 'one minute',
              type: 'phrase',
              frame: false,
              flag: 'chunk',
            },
            {
              kn: 'ondu nimisha nillisi',
              en: 'please wait one minute',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'swalpa',
              en: 'a little',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'swalpa adjust maadi',
              en: 'please adjust a little',
              type: 'sentence',
              frame: false,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u16_l4',
          title: 'Do / make',
          type: 'normal',
          items: [
            {
              kn: 'maadu',
              en: 'do (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'maadi',
              en: 'please do (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kelsa maadu',
              en: 'do work',
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'phone maadi',
              en: 'please call (make a phone call)',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u16_l5',
          title: 'Command drill',
          type: 'normal',
          reviewFrom: ['u14', 'u15', 'u16'],
          note: '12-exercise drill mixing u14–u16. Casual (-u) vs respectful (-i) sorting + real auto-ride audio prompts.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u17 · Everyday Action Verbs · icon ⚡ · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u17',
      title: 'Everyday Action Verbs',
      icon: '⚡',
      phase: 3,
      lessons: [
        {
          id: 'u17_l1',
          title: 'Eat & drink',
          type: 'normal',
          items: [
            {
              kn: 'thinnu',
              en: 'eat (casual)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'thinni',
              en: 'please eat (respectful)',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kudi',
              en: 'drink',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'oota maadi',
              en: 'please have your meal',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u17_l2',
          title: 'Sleep & wake',
          type: 'normal',
          items: [
            {
              kn: 'malagu',
              en: 'sleep',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'elu',
              en: 'wake up / get up',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'bega elu',
              en: 'wake up early / quickly',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u17_l3',
          title: 'Read, write, learn',
          type: 'normal',
          items: [
            {
              kn: 'odu',
              en: 'read',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'bare',
              en: 'write',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kali',
              en: 'learn',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'Kannada kali',
              en: 'learn Kannada',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u17_l4',
          title: 'Buy & pay',
          type: 'normal',
          reviewFrom: ['u15'],
          note: '"kodu" (give) was already introduced in u15 — referenced here without duplicating.',
          items: [
            {
              kn: 'kollu',
              en: 'buy',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'dabbu kodu',
              en: 'pay / give money',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'eshtu kodabeku?',
              en: 'how much should I pay?',
              type: 'sentence',
              frame: false,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u17_l5',
          title: 'Verb drill',
          type: 'normal',
          reviewFrom: ['u5', 'u6', 'u17'],
          note: 'drill lesson plugging u5–u6 food/drink words into thinnu/kudi frames (e.g. "idli thinnu", "coffee kudi").',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u18 · Phase 3 Review & Checkpoint · icon 🏁 · phase 3 · cefr A2
    // ========================================================================
    {
      id: 'u18',
      title: 'Phase 3 Review & Checkpoint',
      icon: '🏁',
      phase: 3,
      lessons: [
        {
          id: 'u18_l1',
          title: 'People & possession',
          type: 'checkpoint',
          reviewFrom: ['u12', 'u13'],
          note: '10 exercises.',
          items: [],
        },
        {
          id: 'u18_l2',
          title: 'Commands in the wild',
          type: 'checkpoint',
          reviewFrom: ['u14', 'u15', 'u16'],
          note: '10 exercises.',
          items: [],
        },
        {
          id: 'u18_l3',
          title: 'Daily actions',
          type: 'checkpoint',
          reviewFrom: ['u17'],
          note: '10 exercises.',
          items: [],
        },
        {
          id: 'u18_l4',
          title: 'Polite vs casual',
          type: 'checkpoint',
          reviewFrom: ['u12', 'u13', 'u14', 'u15', 'u16', 'u17'],
          note: '12 exercises — learner picks respectful (-i / nimma / neevu) for auto driver, shopkeeper, elder; casual (-u / ninna / neenu) for friend.',
          items: [],
        },
        {
          id: 'u18_l5',
          title: 'Phase 3 boss checkpoint',
          type: 'checkpoint',
          reviewFrom: ['u12', 'u13', 'u14', 'u15', 'u16', 'u17'],
          note: '15 exercises — 80% or more unlocks Phase 4 (u19). Must include at least 3 speak exercises on command frames ("illi nillisi", "bega baa", "nanage ___ kodi").',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u19 · Directions 1: Left, Right, Straight · icon 🧭 · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u19',
      title: 'Directions 1: Left, Right, Straight',
      icon: '🧭',
      phase: 4,
      lessons: [
        {
          id: 'u19_l1',
          title: 'Left',
          type: 'normal',
          note: 'Bengaluru street Kannada borrows "left/right" with a -u ending. This is the authentic form drivers actually use.',
          items: [
            {
              kn: 'leftu',
              en: 'left',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'leftu maadi',
              en: 'turn left',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u19_l2',
          title: 'Right',
          type: 'normal',
          items: [
            {
              kn: 'rightu',
              en: 'right',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'rightu maadi',
              en: 'turn right',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u19_l3',
          title: 'Straight',
          type: 'normal',
          note: 'WARNING: "neera" (straight) and "neeru" (water, u6) look almost identical. NEVER use them as each other\'s distractors, and give this word extra audio/visual emphasis in exercises.',
          items: [
            {
              kn: 'neera',
              en: 'straight',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'neera hogu',
              en: 'go straight',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u19_l4',
          title: 'Ahead & behind',
          type: 'normal',
          items: [
            {
              kn: 'munde',
              en: 'ahead / in front',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'hinde',
              en: 'behind',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'swalpa munde',
              en: 'a little ahead',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u19_l5',
          title: 'Direction drill',
          type: 'normal',
          reviewFrom: ['u19'],
          note: '10 exercises combining leftu / rightu / neera / munde / hinde with the maadi and hogu frames. DELIBERATE CONTRAST EXCEPTION: leftu ↔ rightu ↔ neera, and munde ↔ hinde MAY be used as each other\'s MCQ distractors — this contrast is the whole point of the lesson. Include 2 speak exercises (leftu maadi, rightu maadi, neera hogu). No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u20 · City Landmarks · icon 🏙️ · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u20',
      title: 'City Landmarks',
      icon: '🏙️',
      phase: 4,
      lessons: [
        {
          id: 'u20_l1',
          title: 'The way',
          type: 'normal',
          items: [
            {
              kn: 'daari',
              en: 'way / route',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'daari gottilla',
              en: "I don't know the way",
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u20_l2',
          title: "Know & don't know",
          type: 'normal',
          note: 'gottu ↔ gottilla are a deliberate contrast pair — they MAY be mutual distractors.',
          items: [
            {
              kn: 'nanage gottu',
              en: 'I know',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'nanage gottilla',
              en: "I don't know",
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u20_l3',
          title: 'Cross & main (Bengaluru special)',
          type: 'normal',
          items: [
            {
              kn: 'cross',
              en: 'cross street',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'main road',
              en: 'main road',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'second cross',
              en: 'second cross',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u20_l4',
          title: 'Junctions',
          type: 'normal',
          items: [
            {
              kn: 'circle',
              en: 'circle',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'junction',
              en: 'junction',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'signal',
              en: 'traffic signal',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u20_l5',
          title: 'Near & far',
          type: 'normal',
          note: 'hatra ↔ doora are a deliberate contrast pair.',
          items: [
            {
              kn: 'hatra',
              en: 'near',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'doora',
              en: 'far',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'signal hatra',
              en: 'near the signal',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'tumba doora',
              en: 'very far',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u21 · Meter & Fare · icon 💸 · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u21',
      title: 'Meter & Fare',
      icon: '💸',
      phase: 4,
      lessons: [
        {
          id: 'u21_l1',
          title: 'The meter',
          type: 'normal',
          note: 'this reuses "haaku" (u15) — the learner already knows the verb. Do not re-add haaku as an item.',
          items: [
            {
              kn: 'meter',
              en: 'meter',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'meter haaku',
              en: 'put the meter on',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u21_l2',
          title: 'Asking the fare',
          type: 'normal',
          items: [
            {
              kn: 'fare',
              en: 'fare',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'fare eshtu?',
              en: 'how much is the fare?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u21_l3',
          title: 'Too much',
          type: 'normal',
          items: [
            {
              kn: 'jaasti',
              en: 'too much / excess',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'tumba jaasti',
              en: "that's too much",
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'kammi',
              en: 'less',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u21_l4',
          title: 'Haggle lite',
          type: 'normal',
          note: 'jaasti ↔ kammi are a deliberate contrast pair.',
          items: [
            {
              kn: 'kammi maadi',
              en: 'reduce it',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'innu swalpa kammi',
              en: 'a little less',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u21_l5',
          title: 'Meter drill',
          type: 'normal',
          reviewFrom: ['u19', 'u20', 'u21'],
          note: '12 exercises from u19–u21 items. Speak exercises may plug learned fillers into frames: "meter haaku sir", "meter haaku anna". Include reverse MCQs (show "put the meter on" → pick Kanglish). No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u22 · Hailing & Destination · icon 🛺 · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u22',
      title: 'Hailing & Destination',
      icon: '🛺',
      phase: 4,
      lessons: [
        {
          id: 'u22_l1',
          title: 'Need to go',
          type: 'normal',
          note: 'hogbeku = hogu (u14) + beku (u9) — the payoff of the whole ladder. Do not re-add hogu or beku.',
          items: [
            {
              kn: 'hogbeku',
              en: 'need to go',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'Majestic',
              en: 'Majestic',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'Majestic hogbeku',
              en: 'I need to go to Majestic',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u22_l2',
          title: 'The golden line',
          type: 'normal',
          note: 'this is THE Bengaluru auto-hailing line. Give it hero treatment.',
          items: [
            {
              kn: 'bartira?',
              en: 'will you come/go?',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'Majestic bartira?',
              en: 'will you go to Majestic?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u22_l3',
          title: 'Driver replies (what you will HEAR)',
          type: 'normal',
          note: 'recognition drill only — the learner hears the driver and picks the meaning. These never appear in speak exercises.',
          items: [
            {
              kn: 'barutte',
              en: "I'll come / okay, get in",
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'illa sir',
              en: 'no sir',
              type: 'phrase',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u22_l4',
          title: 'More destinations',
          type: 'normal',
          items: [
            {
              kn: 'airport',
              en: 'airport',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'airport hogbeku',
              en: 'I need to go to the airport',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u22_l5',
          title: 'Hailing drill',
          type: 'normal',
          reviewFrom: ['u7', 'u20', 'u22'],
          note: '10 exercises plugging LEARNED place words only (u7: bus stand, metro station, market, hotel; u20: signal, circle; u22: Majestic, airport) into the frames "___ hogbeku" and "___ bartira?". Include 2 speak exercises. No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u23 · During the Ride & Arrival · icon 📱 · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u23',
      title: 'During the Ride & Arrival',
      icon: '📱',
      phase: 4,
      lessons: [
        {
          id: 'u23_l1',
          title: 'Speed check',
          type: 'normal',
          note: 'this reuses bega (u16) and beda (u10) — do not re-add them.',
          items: [
            {
              kn: 'speed jaasti',
              en: 'too fast',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'bega beda',
              en: "no hurry / don't rush",
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u23_l2',
          title: 'Stop spots',
          type: 'normal',
          note: 'munde (u19) + nillisi (u16) reused — do not re-add. illi / alli / allae look alike: never mutual distractors except deliberate contrast.',
          items: [
            {
              kn: 'allae',
              en: 'right there',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'allae nillisi',
              en: 'stop right there',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'munde nillisi',
              en: 'stop ahead',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u23_l3',
          title: 'Traffic talk',
          type: 'normal',
          note: 'this reuses ide (u3) — the learner builds a real sentence from three known pieces. Do not re-add ide.',
          items: [
            {
              kn: 'traffic',
              en: 'traffic',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'tumba traffic ide',
              en: 'there is so much traffic',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u23_l4',
          title: 'Paying',
          type: 'normal',
          items: [
            {
              kn: 'cash',
              en: 'cash',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'UPI ideya?',
              en: 'is UPI okay?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'scan maadi',
              en: 'scan it / pay by scan',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u23_l5',
          title: 'Ride sequence drill',
          type: 'normal',
          reviewFrom: ['u3', 'u16', 'u19', 'u21', 'u22', 'u23'],
          note: '12 exercises simulating ride stages IN ORDER using only learned items: hail (___ bartira?) → meter (meter haaku) → direction (leftu/rightu maadi) → stop (illi nillisi / allae nillisi) → fare (eshtu aaytu?, fare eshtu?) → pay (UPI ideya?). MCQ + word-order + 2 speak exercises. No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u24 · Weather & Late Lite · icon ⛅ · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u24',
      title: 'Weather & Late Lite',
      icon: '⛅',
      phase: 4,
      lessons: [
        {
          id: 'u24_l1',
          title: 'Hot day',
          type: 'normal',
          note: 'reuses bisi (u6), ide (u3), ivattu (u23) — do not re-add.',
          items: [
            {
              kn: 'tumba bisi ide',
              en: "it's very hot today",
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'ivattu tumba bisi',
              en: 'very hot today',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u24_l2',
          title: 'Rain',
          type: 'normal',
          items: [
            {
              kn: 'male',
              en: 'rain',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'male ide',
              en: "it's raining",
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u24_l3',
          title: 'Late',
          type: 'normal',
          items: [
            {
              kn: 'late aaytu',
              en: "it's late / got late",
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'tumba late aaytu',
              en: 'very late',
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u24_l4',
          title: 'Sorry with a reason',
          type: 'normal',
          note: 'mixing English "sorry" is authentic Bengaluru code-mixing — keep it. Reuses kshamisi (u2) — do not re-add.',
          items: [
            {
              kn: 'kshamisi, tumba traffic',
              en: 'sorry, so much traffic',
              type: 'sentence',
              frame: true,
              flag: 'chunk',
            },
            {
              kn: 'sorry, late aaytu',
              en: "sorry, I'm late",
              type: 'phrase',
              frame: false,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u24_l5',
          title: 'Chit-chat drill',
          type: 'normal',
          reviewFrom: ['u23', 'u24'],
          note: '10 exercises mixing u23 L3 and u24 L1–L4 items. MCQ + 2 speak exercises (tumba bisi ide, sorry late aaytu). No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u25 · Phase 4 Gate: The Full Ride · icon 🏁 · phase 4 · cefr A2
    // ========================================================================
    {
      id: 'u25',
      title: 'Phase 4 Gate: The Full Ride',
      icon: '🏁',
      phase: 4,
      lessons: [
        {
          id: 'u25_l1',
          title: 'Directions review',
          type: 'checkpoint',
          reviewFrom: ['u19', 'u20'],
          note: '10-exercise drill from u19–u20 only. No new items.',
          items: [],
        },
        {
          id: 'u25_l2',
          title: 'Meter & fare review',
          type: 'checkpoint',
          reviewFrom: ['u21'],
          note: '10-exercise drill from u21 only. No new items.',
          items: [],
        },
        {
          id: 'u25_l3',
          title: 'Ride review',
          type: 'checkpoint',
          reviewFrom: ['u22', 'u23'],
          note: '10-exercise drill from u22–u23 only. No new items.',
          items: [],
        },
        {
          id: 'u25_l4',
          title: 'Speed round',
          type: 'checkpoint',
          reviewFrom: ['u19', 'u20', 'u21', 'u22', 'u23', 'u24'],
          note: '12-exercise mixed drill from ALL of u19–u24. No new items.',
          items: [],
        },
        {
          id: 'u25_l5',
          title: 'CAPSTONE — The Full Ride',
          type: 'checkpoint',
          reviewFrom: ['u19', 'u20', 'u21', 'u22', 'u23', 'u24'],
          note: '15 exercises structured as one continuous simulated auto ride, in story order: (1) hail the auto, (2) state destination, (3) meter, (4) one direction instruction, (5) a during-ride line, (6) stop, (7) fare, (8) pay, (9) thank the driver (dhanyavada, u2 — reuse, do not re-add). Include at least 3 speak exercises across the stages. This is the demo showpiece — make it feel like a journey (Anna mascot narrates each stage). RULE: 80% or more required to unlock Phase 5 (u26); below 80% the learner retries. Anna mascot celebrates pass / encourages retry.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u26 · Time · icon 🕐 · phase 5 · cefr B1
    // ========================================================================
    {
      id: 'u26',
      title: 'Time',
      icon: '🕐',
      phase: 5,
      lessons: [
        {
          id: 'u26_l1',
          title: 'Clock words',
          type: 'normal',
          note: 'this reuses eshtu (u3) — do not re-add.',
          items: [
            {
              kn: 'gante',
              en: "hour / o'clock",
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'innu',
              en: 'more / yet',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'innu eshtu gante?',
              en: 'what time is it now?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u26_l2',
          title: 'Telling time',
          type: 'normal',
          note: 'reuses ondu, eradu, hattu from u4 — do not re-add the numbers.',
          items: [
            {
              kn: 'ondu gante',
              en: "1 o'clock",
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'eradu gante',
              en: "2 o'clock",
              type: 'phrase',
              frame: false,
              flag: null,
            },
            {
              kn: 'hattu gante',
              en: "10 o'clock",
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u26_l3',
          title: 'Half & quarter',
          type: 'normal',
          note: 'nimisha appeared inside ondu nimisha nillisi (u22) — here it is unlocked as a standalone word so learners can say 5 nimisha, 10 nimisha.',
          items: [
            {
              kn: 'ardha',
              en: 'half',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ondu ardha gante',
              en: 'half an hour',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'nimisha',
              en: 'minute',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u26_l4',
          title: 'Before & after',
          type: 'normal',
          items: [
            {
              kn: 'munje',
              en: 'before',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'mele',
              en: 'after',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'mele sigona',
              en: "see you later / let's meet after",
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u26_l5',
          title: 'Time drill',
          type: 'normal',
          reviewFrom: ['u4', 'u26'],
          note: '12 exercises plugging learned numbers (1–12 from u4) into "___ gante" + matching clock digits ("3:00" ↔ mooru gante) in both directions + 2 speak exercises ("innu eshtu gante?", "ondu ardha gante"). No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u27 · Days · icon 📅 · phase 5 · cefr B1
    // ========================================================================
    {
      id: 'u27',
      title: 'Days',
      icon: '📅',
      phase: 5,
      lessons: [
        {
          id: 'u27_l1',
          title: 'Today / tomorrow / yesterday',
          type: 'normal',
          note: 'ivattu is a reuse-guard violation ONLY if duplicated from u23 — this u27 entry is the CANONICAL one; keep exactly one copy app-wide.',
          items: [
            {
              kn: 'ivattu',
              en: 'today',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'naale',
              en: 'tomorrow',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ninne',
              en: 'yesterday',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u27_l2',
          title: 'Parts of the day',
          type: 'normal',
          items: [
            {
              kn: 'beligge',
              en: 'morning',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'sanje',
              en: 'evening',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'raatri',
              en: 'night',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'shubha raatri',
              en: 'good night',
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u27_l3',
          title: 'Plans for tomorrow',
          type: 'normal',
          note: 'reuses banni (u2), sigona (from u26 mele sigona), kelsa (u8), ide (u3).',
          items: [
            {
              kn: 'naale banni',
              en: 'come tomorrow',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'naale sigona',
              en: 'see you tomorrow',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'naale kelsa ide',
              en: 'there is work tomorrow',
              type: 'sentence',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u27_l4',
          title: 'Week',
          type: 'normal',
          note: 'Bengaluru speakers genuinely use English "last week / next week" inside Kannada sentences — marked recog for authenticity, not drilled.',
          items: [
            {
              kn: 'vaara',
              en: 'week',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'ee vaara',
              en: 'this week',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'last week',
              en: 'last week',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u27_l5',
          title: 'Day drill',
          type: 'normal',
          reviewFrom: ['u27'],
          note: '10 exercises mixing ivattu / naale / ninne + beligge / sanje / raatri in MCQ, reverse MCQ, and 2 speak exercises ("naale sigona", "naale mane" from u28 preview — wait: use ONLY u27 items here, do NOT preview u28).',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u28 · Simple Past & Future Chunks · icon 🔄 · phase 5 · cefr B1
    // ========================================================================
    {
      id: 'u28',
      title: 'Simple Past & Future Chunks',
      icon: '🔄',
      phase: 5,
      lessons: [
        {
          id: 'u28_l1',
          title: 'Went',
          type: 'normal',
          note: 'colloquial spoken chunk — do NOT teach tense conjugation tables.',
          items: [
            {
              kn: 'hogi',
              en: 'I went / gone',
              type: 'word',
              frame: false,
              flag: 'chunk',
            },
            {
              kn: 'naale hogi',
              en: 'going tomorrow',
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u28_l2',
          title: 'Came',
          type: 'normal',
          reviewFrom: ['u2'],
          note: 'banni (reuse from u2 — DO NOT add as new item; reference u2 for review).',
          items: [
            {
              kn: 'bande',
              en: 'I came',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'ivattu bande',
              en: 'I came today',
              type: 'phrase',
              frame: false,
              flag: 'recog',
            },
          ],
        },
        {
          id: 'u28_l3',
          title: 'Done / finished',
          type: 'normal',
          note: '"oota aayta?" is the #1 Bengaluru small-talk greeting after namaskara. Friends, colleagues, and neighbours ask this constantly.',
          items: [
            {
              kn: 'aaytu',
              en: 'done / finished / happened',
              type: 'word',
              frame: false,
              flag: 'chunk',
            },
            {
              kn: 'oota aaytu',
              en: 'meal is done / I ate',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'oota aayta?',
              en: 'have you eaten?',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u28_l4',
          title: 'Going to go',
          type: 'normal',
          items: [
            {
              kn: 'hogtini',
              en: "I will go / I'm going",
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'naale hogtini',
              en: "I'll go tomorrow",
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
            {
              kn: 'naale mane',
              en: 'going home tomorrow',
              type: 'phrase',
              frame: false,
              flag: 'chunk',
            },
          ],
        },
        {
          id: 'u28_l5',
          title: 'Coming back',
          type: 'normal',
          note: 'in Kannada you never say "I am leaving" — that\'s bad luck. You ALWAYS say "hogbittu bartini" (I\'ll go and come back).',
          items: [
            {
              kn: 'bartini',
              en: 'I\'ll come / I\'m coming (also = "bye, I\'ll be back")',
              type: 'word',
              frame: false,
              flag: 'recog',
            },
            {
              kn: 'iga bartini',
              en: 'coming right now / be right back',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'hogbittu bartini',
              en: "I'll go and come back (the classic Kannada goodbye)",
              type: 'phrase',
              frame: true,
              flag: null,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // UNIT u29 · Opinions & Feelings · icon 💬 · phase 5 · cefr B1
    // ========================================================================
    {
      id: 'u29',
      title: 'Opinions & Feelings',
      icon: '💬',
      phase: 5,
      lessons: [
        {
          id: 'u29_l1',
          title: 'Good',
          type: 'normal',
          note: 'compare chennagidini ("I am fine", u1) vs chennagide ("IT is nice", for food/places/things).',
          items: [
            {
              kn: 'olledu',
              en: 'good',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'tumba olledu',
              en: 'very good',
              type: 'phrase',
              frame: true,
              flag: null,
            },
            {
              kn: 'chennagide',
              en: 'it is good / nice',
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u29_l2',
          title: 'Not good',
          type: 'normal',
          items: [
            {
              kn: 'olledu illa',
              en: 'not good',
              type: 'phrase',
              frame: true,
              flag: 'chunk',
            },
            {
              kn: 'chennagilla',
              en: "it's not nice / not good",
              type: 'word',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u29_l3',
          title: 'Like & don\'t like',
          type: 'normal',
          items: [
            {
              kn: 'ishta',
              en: 'like / favourite',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'nanage ___ ishta',
              en: 'I like ___',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'nanage idu ishta',
              en: 'I like this',
              type: 'sentence',
              frame: true,
              flag: null,
            },
            {
              kn: 'ishta illa',
              en: "don't like",
              type: 'phrase',
              frame: false,
              flag: null,
            },
          ],
        },
        {
          id: 'u29_l4',
          title: 'Feelings',
          type: 'normal',
          reviewFrom: ['u1'],
          note: 'tumba santosha (reuse from u1 L5 — DO NOT re-add; reference u1 for review).',
          items: [
            {
              kn: 'santosha',
              en: 'happy',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kashta',
              en: 'difficult / hard',
              type: 'word',
              frame: false,
              flag: null,
            },
            {
              kn: 'kannada sulabha',
              en: 'Kannada is easy!',
              type: 'sentence',
              frame: true,
              flag: null,
            },
          ],
        },
        {
          id: 'u29_l5',
          title: 'Opinion drill',
          type: 'normal',
          reviewFrom: ['u1', 'u5', 'u6', 'u7', 'u29'],
          note: '10 exercises plugging learned food/place words (dose, coffee, idli, ooru, mane from u1/u5/u6) into "nanage ___ ishta" / "___ chennagide" + 2 speak exercises ("nanage dose ishta", "kannada sulabha"). No new items.',
          items: [],
        },
      ],
    },

    // ========================================================================
    // UNIT u30 · Phase 5 Gate: Everyday Life · icon 🏆 · phase 5 · cefr B1
    // ========================================================================
    {
      id: 'u30',
      title: 'Phase 5 Gate: Everyday Life',
      icon: '🏆',
      phase: 5,
      lessons: [
        {
          id: 'u30_l1',
          title: 'Morning & weather review',
          type: 'checkpoint',
          reviewFrom: ['u1', 'u23', 'u24'],
          note: '10-exercise drill from u1, u23, u24 (greetings + weather + traffic + late). No new items.',
          items: [],
        },
        {
          id: 'u30_l2',
          title: 'Intro & numbers review',
          type: 'checkpoint',
          reviewFrom: ['u1', 'u4'],
          note: '10-exercise drill from u1 + u4 (self-intro + numbers 1–20). No new items.',
          items: [],
        },
        {
          id: 'u30_l3',
          title: 'Full ride remix',
          type: 'checkpoint',
          reviewFrom: ['u19', 'u20', 'u21', 'u22'],
          note: '12-exercise drill from u19–u22 with DIFFERENT destination/direction combinations than u25 (e.g. airport hogbeku, metro station bartira?, circle hatra, rightu maadi). No new items.',
          items: [],
        },
        {
          id: 'u30_l4',
          title: 'Time, plans & opinions review',
          type: 'checkpoint',
          reviewFrom: ['u26', 'u27', 'u28', 'u29'],
          note: '10-exercise drill from u26–u29 (time + days + oota aayta? + opinions). No new items.',
          items: [],
        },
        {
          id: 'u30_l5',
          title: 'CAPSTONE — The Full Bengaluru Day',
          type: 'checkpoint',
          reviewFrom: [
            'u1',
            'u2',
            'u3',
            'u4',
            'u5',
            'u6',
            'u7',
            'u8',
            'u9',
            'u10',
            'u11',
            'u12',
            'u13',
            'u14',
            'u15',
            'u16',
            'u17',
            'u18',
            'u19',
            'u20',
            'u21',
            'u22',
            'u23',
            'u24',
            'u25',
            'u26',
            'u27',
            'u28',
            'u29',
          ],
          note: '20 exercises structured as one full day in Bengaluru, in story order across all 5 phases: Stage 1 — Morning greeting & small talk, Stage 2 — Breakfast at a Darshini, Stage 3 — Hailing the morning auto, Stage 4 — Navigating the ride, Stage 5 — Arriving & paying, Stage 6 — Workday & time check, Stage 7 — Evening plans with a friend, Stage 8 — Feeling at home, Stage 9 — Saying goodnight. Include at least 5 speak exercises across the 9 stages and at least 2 listening/recog checks (driver replies barutte / illa sir). RULE: 80% or more required to complete the course. Passing u30 L5 triggers a special Course-Complete Screen with Auto Anna celebrating, total words learned, and a "Bengaluru Ready 🛺" badge.',
          items: [],
        },
      ],
    },
  ],
};

// ============================================================================
// 4. VALIDATION ON LOAD
// ============================================================================

export interface CourseValidationResult {
  valid: boolean;
  errors: string[];
}

const PHASE_4_GUARDED_ITEMS = new Set<string>([
  'hogu',
  'maadi',
  'nillisi',
  'nillu',
  'haaku',
  'kodi',
  'beku',
  'beda',
  'bisi',
  'thanna',
  'ide',
  'illi',
  'alli',
  'swalpa',
  'bega',
  'eshtu',
  'eshtu?',
  'eshtu aaytu?',
  'kshamisi',
  'sir',
  'anna',
  'market',
  'hotel',
  'bus stand',
  'metro station',
  'chillare',
  'neeru',
  'dhanyavada',
]);

const PHASE_5_GUARDED_ITEMS = new Set<string>([
  'iga',
  'aaga',
  'yaavaga?',
  'eshtu?',
  'mane',
  'kelsa',
  'angadi',
  'market',
  'hotel',
  'office',
  'bega',
  'ide',
  'beku',
  'beda',
  'maadi',
  'hogu',
  'kodi',
  'nillisi',
  'swalpa',
  'tumba',
  'jaasti',
  'hatra',
  'elli',
  'sari',
  'banni',
  'chennagidini',
  'nanage',
  'nanage gottilla',
  'late aaytu',
  'fare',
  'hinde',
  'munde',
  'amma',
  'appa',
  'dost',
  'ondu',
  'tumba santosha',
]);

/**
 * Validates curriculum data on load:
 * - Every unit has 5 lessons
 * - Every lesson has items (unless type === "checkpoint" or a pattern-plug/review drill lesson with reviewFrom/note)
 * - Every item has kn + en + type ("word" | "phrase" | "sentence")
 * - Zero duplicates of guarded Phase 1–3 items in Phase 4
 * Logs a clear console.error naming the broken unit/lesson if validation fails.
 */
export function validateCourseData(
  data: CurriculumDataSchema
): CourseValidationResult {
  const errors: string[] = [];

  if (!data || !Array.isArray(data.phases) || data.phases.length !== 5) {
    const msg = `[courseData] Invalid phases definition: expected 5 phases, got ${
      data?.phases?.length ?? 0
    }.`;
    console.error(msg);
    errors.push(msg);
  }

  if (!data || !Array.isArray(data.units)) {
    const msg = `[courseData] Invalid units array.`;
    console.error(msg);
    errors.push(msg);
    return { valid: false, errors };
  }

  const validItemTypes = new Set<string>(['word', 'phrase', 'sentence']);
  const validFlags = new Set<string | null>(['chunk', 'recog', null]);

  for (const unit of data.units) {
    const unitLabel = `Unit "${unit?.id || 'unknown'}" ("${
      unit?.title || 'untitled'
    }")`;

    if (!unit.id || !unit.title) {
      const msg = `[courseData] ${unitLabel} is missing id or title.`;
      console.error(msg);
      errors.push(msg);
    }

    if (!Array.isArray(unit.lessons) || unit.lessons.length !== 5) {
      const msg = `[courseData] ${unitLabel} must have exactly 5 lessons (found ${
        unit?.lessons?.length ?? 0
      }).`;
      console.error(msg);
      errors.push(msg);
    }

    if (!Array.isArray(unit.lessons)) continue;

    for (const lesson of unit.lessons) {
      const lessonLabel = `${unitLabel} -> Lesson "${
        lesson?.id || 'unknown'
      }" ("${lesson?.title || 'untitled'}")`;

      if (!lesson.id || !lesson.title) {
        const msg = `[courseData] ${lessonLabel} is missing id or title.`;
        console.error(msg);
        errors.push(msg);
      }

      if (lesson.type === 'checkpoint') {
        if (
          !Array.isArray(lesson.reviewFrom) ||
          lesson.reviewFrom.length === 0
        ) {
          const msg = `[courseData] ${lessonLabel} is a checkpoint lesson but has an empty reviewFrom array.`;
          console.error(msg);
          errors.push(msg);
        }
        continue;
      }

      const isPlugOrReviewDrillLesson = Boolean(
        (lesson.note && /no new items|drill/i.test(lesson.note)) ||
          (Array.isArray(lesson.reviewFrom) && lesson.reviewFrom.length > 0)
      );
      if (
        isPlugOrReviewDrillLesson &&
        (!lesson.items || lesson.items.length === 0)
      ) {
        continue;
      }

      if (!Array.isArray(lesson.items) || lesson.items.length === 0) {
        const msg = `[courseData] ${lessonLabel} has no items (normal lessons must contain at least 1 item).`;
        console.error(msg);
        errors.push(msg);
        continue;
      }

      lesson.items.forEach((item, idx) => {
        const hasKn =
          typeof item?.kn === 'string' && item.kn.trim().length > 0;
        const hasEn =
          typeof item?.en === 'string' && item.en.trim().length > 0;
        const hasValidType = validItemTypes.has(item?.type);
        const hasValidFlag =
          item?.flag === undefined || validFlags.has(item.flag);

        if (!hasKn || !hasEn || !hasValidType || !hasValidFlag) {
          const msg = `[courseData] ${lessonLabel} -> Item #${idx + 1} (${
            item?.kn || 'missing kn'
          }) is invalid: requires non-empty kn, en, and type ("word" | "phrase" | "sentence").`;
          console.error(msg);
          errors.push(msg);
        } else if (
          unit.phase === 4 &&
          PHASE_4_GUARDED_ITEMS.has(item.kn.trim().toLowerCase())
        ) {
          const msg = `[courseData] Duplicate guard violation in ${lessonLabel}: "${item.kn}" already exists in Phases 1–3 and must not be re-added.`;
          console.error(msg);
          errors.push(msg);
        } else if (
          unit.phase === 5 &&
          PHASE_5_GUARDED_ITEMS.has(item.kn.trim().toLowerCase())
        ) {
          const msg = `[courseData] Duplicate guard violation in ${lessonLabel}: "${item.kn}" already exists in Phases 1–4 and must not be re-added.`;
          console.error(msg);
          errors.push(msg);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 2. EXERCISE AUTO-GENERATION (per lesson, from its own items)
// ============================================================================

function toExerciseOption(item: CurriculumItem): ExerciseOption {
  const cleanKn = item.kn.trim();
  const cleanEn = item.en.trim();
  return {
    kannada: cleanKn, // Romanized Kannada only (no Kannada script anywhere)
    translit: cleanKn,
    meaning: cleanEn,
  };
}

function dedupeCurriculumItems(items: CurriculumItem[]): CurriculumItem[] {
  const seen = new Set<string>();
  const out: CurriculumItem[] = [];
  for (const item of items) {
    if (!item?.kn || !item?.en) continue;
    const key = `${item.kn.trim().toLowerCase()}::${item.en
      .trim()
      .toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Generates plugged "nanage ___ beku" items from learned non-recog words in u5–u8
 * for u9 L5 ("Want drill").
 */
function buildPluggedBekuItemsFromUnits(
  sourceUnits: CurriculumUnitInput[]
): CurriculumItem[] {
  const pluggedCandidates: { knWord: string; enWord: string }[] = [
    { knWord: 'dose', enWord: 'dosa' },
    { knWord: 'baalehannu', enWord: 'banana' },
    { knWord: 'idli', enWord: 'idli' },
    { knWord: 'vade', enWord: 'vada' },
    { knWord: 'sambar', enWord: 'sambar' },
    { knWord: 'motte', enWord: 'egg' },
    { knWord: 'hannu', enWord: 'fruit' },
    { knWord: 'haalu', enWord: 'milk' },
    { knWord: 'bisi coffee', enWord: 'hot coffee' },
    { knWord: 'bisi neeru', enWord: 'hot water' },
    { knWord: 'thanna neeru', enWord: 'cold water' },
    { knWord: 'room', enWord: 'room' },
    { knWord: 'kelsa', enWord: 'work' },
  ];

  const availableKnSet = new Set<string>();
  for (const u of sourceUnits) {
    for (const l of u.lessons) {
      for (const item of l.items || []) {
        if (item.flag !== 'recog') {
          availableKnSet.add(item.kn.trim().toLowerCase());
        }
      }
    }
  }

  const validPlugged = pluggedCandidates.filter((c) =>
    availableKnSet.has(c.knWord.toLowerCase())
  );

  return validPlugged.map((c, idx) => ({
    kn: `nanage ${c.knWord} beku`,
    en: `I want ${c.enWord}`,
    type: 'sentence' as const,
    frame: idx === 0,
    flag: null,
  }));
}

/**
 * Generates plugged "nanage ___ kodi" items from learned non-recog food/drink words in u5–u6
 * for u15 L5 ("Restaurant power moves").
 */
function buildPluggedKodiItemsFromUnits(
  sourceUnits: CurriculumUnitInput[]
): CurriculumItem[] {
  const pluggedCandidates: { knWord: string; enWord: string }[] = [
    { knWord: 'idli', enWord: 'an idli' },
    { knWord: 'vade', enWord: 'a vada' },
    { knWord: 'sambar', enWord: 'sambar' },
    { knWord: 'coffee', enWord: 'coffee' },
    { knWord: 'tea', enWord: 'tea' },
    { knWord: 'neeru', enWord: 'water' },
    { knWord: 'bisi neeru', enWord: 'hot water' },
    { knWord: 'haalu', enWord: 'milk' },
  ];

  const availableKnSet = new Set<string>();
  for (const u of sourceUnits) {
    for (const l of u.lessons) {
      for (const item of l.items || []) {
        if (item.flag !== 'recog') {
          availableKnSet.add(item.kn.trim().toLowerCase());
        }
      }
    }
  }

  return pluggedCandidates
    .filter((c) => availableKnSet.has(c.knWord.toLowerCase()))
    .map((c) => ({
      kn: `nanage ${c.knWord} kodi`,
      en: `please give me ${c.enWord}`,
      type: 'sentence' as const,
      frame: false,
      flag: null,
    }));
}

/**
 * Generates plugged "___ thinnu" and "___ kudi" items from learned non-recog words in u5–u6
 * for u17 L5 ("Verb drill").
 */
function buildPluggedThinnuKudiItemsFromUnits(
  sourceUnits: CurriculumUnitInput[]
): CurriculumItem[] {
  const foodCandidates: { knWord: string; enWord: string }[] = [
    { knWord: 'idli', enWord: 'idli' },
    { knWord: 'dose', enWord: 'dosa' },
    { knWord: 'vade', enWord: 'vada' },
    { knWord: 'anna', enWord: 'cooked rice' },
    { knWord: 'baalehannu', enWord: 'banana' },
    { knWord: 'hannu', enWord: 'fruit' },
  ];
  const drinkCandidates: { knWord: string; enWord: string }[] = [
    { knWord: 'coffee', enWord: 'coffee' },
    { knWord: 'tea', enWord: 'tea' },
    { knWord: 'neeru', enWord: 'water' },
    { knWord: 'haalu', enWord: 'milk' },
    { knWord: 'juice', enWord: 'juice' },
  ];

  const availableKnSet = new Set<string>();
  for (const u of sourceUnits) {
    for (const l of u.lessons) {
      for (const item of l.items || []) {
        if (item.flag !== 'recog') {
          availableKnSet.add(item.kn.trim().toLowerCase());
        }
      }
    }
  }

  const out: CurriculumItem[] = [];
  foodCandidates
    .filter((c) => availableKnSet.has(c.knWord.toLowerCase()))
    .forEach((c, idx) => {
      out.push({
        kn: `${c.knWord} thinnu`,
        en: `eat ${c.enWord}`,
        type: 'phrase',
        frame: idx === 0,
        flag: null,
      });
    });

  drinkCandidates
    .filter((c) => availableKnSet.has(c.knWord.toLowerCase()))
    .forEach((c) => {
      out.push({
        kn: `${c.knWord} kudi`,
        en: `drink ${c.enWord}`,
        type: 'phrase',
        frame: false,
        flag: null,
      });
    });

  return out;
}

/**
 * Generates plugged destination items for u22 L5 ("Hailing drill")
 * using ONLY learned place words from u7 (bus stand, metro station, market, hotel),
 * u20 (signal, circle), and u22 (Majestic, airport) into "___ hogbeku" and "___ bartira?".
 */
function buildPluggedHailingItemsFromUnits(
  sourceUnits: CurriculumUnitInput[]
): CurriculumItem[] {
  const placeCandidates: { knPlace: string; enPlace: string }[] = [
    { knPlace: 'Majestic', enPlace: 'Majestic' },
    { knPlace: 'airport', enPlace: 'the airport' },
    { knPlace: 'bus stand', enPlace: 'the bus stand' },
    { knPlace: 'metro station', enPlace: 'the metro station' },
    { knPlace: 'market', enPlace: 'the market' },
    { knPlace: 'hotel', enPlace: 'the restaurant' },
    { knPlace: 'signal', enPlace: 'the traffic signal' },
    { knPlace: 'circle', enPlace: 'the circle' },
  ];

  const availableKnSet = new Set<string>();
  for (const u of sourceUnits) {
    for (const l of u.lessons) {
      for (const item of l.items || []) {
        if (item.flag !== 'recog') {
          availableKnSet.add(item.kn.trim().toLowerCase());
        }
      }
    }
  }

  const validPlaces = placeCandidates.filter((p) =>
    availableKnSet.has(p.knPlace.toLowerCase())
  );

  const out: CurriculumItem[] = [];
  validPlaces.forEach((p, idx) => {
    out.push({
      kn: `${p.knPlace} bartira?`,
      en: `will you go to ${p.enPlace}?`,
      type: 'sentence',
      frame: idx === 0,
      flag: null,
    });
    out.push({
      kn: `${p.knPlace} hogbeku`,
      en: `I need to go to ${p.enPlace}`,
      type: 'sentence',
      frame: false,
      flag: null,
    });
  });

  return out;
}

/**
 * Generates plugged clock-time items for u26 L5 ("Time drill")
 * using learned numbers 1–12 from u4 into "___ gante" + clock digit matches ("3:00" <-> mooru gante).
 */
function buildPluggedTimeItemsFromUnits(
  sourceUnits: CurriculumUnitInput[]
): CurriculumItem[] {
  const numberClockCandidates: {
    knNum: string;
    clockDigit: string;
    enOclock: string;
  }[] = [
    { knNum: 'ondu', clockDigit: '1:00', enOclock: "1 o'clock" },
    { knNum: 'eradu', clockDigit: '2:00', enOclock: "2 o'clock" },
    { knNum: 'mooru', clockDigit: '3:00', enOclock: '3:00' },
    { knNum: 'naalku', clockDigit: '4:00', enOclock: '4:00' },
    { knNum: 'aidu', clockDigit: '5:00', enOclock: '5:00' },
    { knNum: 'aaru', clockDigit: '6:00', enOclock: '6:00' },
    { knNum: 'elu', clockDigit: '7:00', enOclock: '7:00' },
    { knNum: 'entu', clockDigit: '8:00', enOclock: '8:00' },
    { knNum: 'ombattu', clockDigit: '9:00', enOclock: '9:00' },
    { knNum: 'hattu', clockDigit: '10:00', enOclock: "10 o'clock" },
    { knNum: 'hannondu', clockDigit: '11:00', enOclock: '11:00' },
    { knNum: 'hanneradu', clockDigit: '12:00', enOclock: '12:00' },
  ];

  const availableKnSet = new Set<string>();
  for (const u of sourceUnits) {
    for (const l of u.lessons) {
      for (const item of l.items || []) {
        if (item.flag !== 'recog') {
          availableKnSet.add(item.kn.trim().toLowerCase());
        }
      }
    }
  }

  const out: CurriculumItem[] = [
    {
      kn: 'innu eshtu gante?',
      en: 'what time is it now?',
      type: 'sentence',
      frame: true,
      flag: null,
    },
    {
      kn: 'ondu ardha gante',
      en: 'half an hour',
      type: 'phrase',
      frame: false,
      flag: null,
    },
    {
      kn: 'mele sigona',
      en: "see you later / let's meet after",
      type: 'phrase',
      frame: false,
      flag: null,
    },
  ];

  numberClockCandidates
    .filter((c) => availableKnSet.has(c.knNum.toLowerCase()))
    .forEach((c) => {
      out.push({
        kn: `${c.knNum} gante`,
        en: c.enOclock,
        type: 'phrase',
        frame: false,
        flag: null,
      });
    });

  return out;
}

/**
 * Generates plugged opinion items for u29 L5 ("Opinion drill")
 * using learned food/place words (dose, coffee, idli, ooru, mane from u1/u5/u6/u7)
 * into "nanage ___ ishta" and "___ chennagide".
 */
function buildPluggedOpinionItemsFromUnits(
  sourceUnits: CurriculumUnitInput[]
): CurriculumItem[] {
  const availableKnSet = new Set<string>();
  for (const u of sourceUnits) {
    for (const l of u.lessons) {
      for (const item of l.items || []) {
        if (item.flag !== 'recog') {
          availableKnSet.add(item.kn.trim().toLowerCase());
        }
      }
    }
  }

  const out: CurriculumItem[] = [
    {
      kn: 'nanage dose ishta',
      en: 'I like dosa',
      type: 'sentence',
      frame: true,
      flag: null,
    },
    {
      kn: 'nanage coffee ishta',
      en: 'I like coffee',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'nanage idli ishta',
      en: 'I like idli',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'dose chennagide',
      en: 'the dosa is nice',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'coffee chennagide',
      en: 'the coffee is good',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'nanna ooru chennagide',
      en: 'my hometown is nice',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'mane chennagide',
      en: 'the house is nice',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'kannada sulabha',
      en: 'Kannada is easy!',
      type: 'sentence',
      frame: false,
      flag: null,
    },
    {
      kn: 'tumba olledu',
      en: 'very good',
      type: 'phrase',
      frame: false,
      flag: null,
    },
    {
      kn: 'nanage idu ishta',
      en: 'I like this',
      type: 'sentence',
      frame: false,
      flag: null,
    },
  ];

  return out.filter(() => availableKnSet.size > 0);
}

/**
 * Enforces lookalike and register-contrast distractor exclusions:
 * 1. illi / alli / allae / ide are NEVER mutual distractors.
 * 2. neera (straight, u19) and neeru (water, u6) are NEVER mutual distractors.
 * 3. nillu (foot stop) and nillisi (vehicle stop) are NEVER mutual distractors.
 * 4. Casual (-u) vs respectful (-i) command counterparts (e.g. baa/banni, hogu/hogi,
 *    kootko/koothukolli, kodu/kodi, thago/thagoli, helu/heli, nodu/nodi, maadu/maadi,
 *    thinnu/thinni) are NEVER mixed as interchangeable distractors in regular lessons.
 * 5. illa (unavailable) and beda (don't want) are not mixed as random distractors.
 */
function getUnitNumberFromLessonId(lessonId?: string): number | null {
  if (!lessonId) return null;
  const match = lessonId.match(/^u(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function levenshteinDist(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function isLookalikeOrNearHomophone(wordA: string, wordB: string): boolean {
  const cleanA = wordA.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanB = wordB.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  // Single word Levenshtein edit distance <= 2
  const dist = levenshteinDist(cleanA, cleanB);
  if (dist <= 2 && Math.min(cleanA.length, cleanB.length) >= 3) {
    return true;
  }

  // Common prefix differing by only one short syllable (<= 3 chars)
  const minLen = Math.min(cleanA.length, cleanB.length);
  let prefixLen = 0;
  while (prefixLen < minLen && cleanA[prefixLen] === cleanB[prefixLen]) {
    prefixLen++;
  }
  if (prefixLen >= 3 && Math.abs(cleanA.length - cleanB.length) <= 3) {
    return true;
  }

  return false;
}

function areMutualDistractorsForbidden(
  targetKnRaw: string,
  candidateKnRaw: string,
  lessonId?: string
): boolean {
  const a = targetKnRaw.trim().toLowerCase();
  const b = candidateKnRaw.trim().toLowerCase();
  if (a === b) return true;

  // 0. Distractor softening for early units (u1–u11): NO near-homophones or look-alikes
  const unitNum = getUnitNumberFromLessonId(lessonId);
  if (unitNum !== null && unitNum <= 11) {
    if (isLookalikeOrNearHomophone(a, b)) {
      return true;
    }
  }

  // 1. neera (straight) vs neeru (water) lookalike exclusion — NEVER mutual distractors anywhere
  const hasNeera = (s: string) => /\bneera\b/.test(s);
  const hasNeeru = (s: string) => /\bneeru\b/.test(s);
  if ((hasNeera(a) && hasNeeru(b)) || (hasNeeru(a) && hasNeera(b))) {
    return true;
  }

  // 1b. mele (after, u26) vs male (rain, u24) lookalike exclusion — NEVER mutual distractors
  const hasMele = (s: string) => /\bmele\b/.test(s);
  const hasMale = (s: string) => /\bmale\b/.test(s);
  if ((hasMele(a) && hasMale(b)) || (hasMale(a) && hasMele(b))) {
    return true;
  }

  // 1c. munje (before, u26) vs munde (ahead, u20) lookalike exclusion — NEVER mutual distractors
  const hasMunje = (s: string) => /\bmunje\b/.test(s);
  const hasMunde = (s: string) => /\bmunde\b/.test(s);
  if ((hasMunje(a) && hasMunde(b)) || (hasMunde(a) && hasMunje(b))) {
    return true;
  }

  // 2. illi / alli / allae / ide lookalike exclusion
  const illiAlliIdeGroup = new Set([
    'illi',
    'alli',
    'allae',
    'ide',
    'illi baa',
    'alli hogu',
    'illi nillisi',
    'alli nillisi',
    'allae nillisi',
  ]);
  if (illiAlliIdeGroup.has(a) && illiAlliIdeGroup.has(b)) {
    return true;
  }

  // 3. nillu (person on foot) vs nillisi (driver stopping vehicle) exclusion
  const nilluFootGroup = new Set(['nillu', 'illi nillu']);
  const nillisiVehicleGroup = new Set([
    'nillisi',
    'illi nillisi',
    'alli nillisi',
    'allae nillisi',
    'munde nillisi',
    'ondu nimisha nillisi',
  ]);
  if (
    (nilluFootGroup.has(a) && nillisiVehicleGroup.has(b)) ||
    (nillisiVehicleGroup.has(a) && nilluFootGroup.has(b))
  ) {
    return true;
  }

  // 4. Casual (-u) vs respectful (-i) command counterparts exclusion
  // (Except in u18_l4 where polite vs casual contrast is explicitly tested)
  if (lessonId !== 'u18_l4') {
    const casualRespectfulPairs: [string[], string[]][] = [
      [['baa', 'illi baa', 'bega baa'], ['banni', 'naale banni']],
      [
        ['hogu', 'alli hogu', 'neera hogu'],
        ['hogi', 'nidhana hogi', 'naale hogi'],
      ],
      [['kootko', 'illi kootko'], ['koothukolli']],
      [
        ['kodu', 'dabbu kodu'],
        ['kodi', 'neeru kodi', 'nanage dose kodi', 'bill kodi'],
      ],
      [['thago'], ['thagoli', 'idu thagoli']],
      [['helu'], ['heli', 'innomme heli']],
      [['nodu'], ['nodi', 'illi nodi']],
      [
        ['maadu', 'kelsa maadu'],
        [
          'maadi',
          'phone maadi',
          'oota maadi',
          'swalpa adjust maadi',
          'leftu maadi',
          'rightu maadi',
          'kammi maadi',
          'scan maadi',
        ],
      ],
      [['thinnu'], ['thinni']],
    ];

    for (const [casualSet, politeSet] of casualRespectfulPairs) {
      const aCasual = casualSet.includes(a);
      const bCasual = casualSet.includes(b);
      const aPolite = politeSet.includes(a);
      const bPolite = politeSet.includes(b);
      if ((aCasual && bPolite) || (aPolite && bCasual)) {
        return true;
      }
    }
  }

  // 5. illa vs beda exclusion (except in u10_l4 contrast lesson)
  if (lessonId !== 'u10_l4') {
    const illaGroup = new Set(['illa', 'coffee illa', 'illa sir']);
    const bedaGroup = new Set([
      'beda',
      'bega beda',
      'nanage beda',
      'nanage coffee beda',
      'nanage tea beda',
      'nanage khara beda',
    ]);
    if (
      (illaGroup.has(a) && bedaGroup.has(b)) ||
      (bedaGroup.has(a) && illaGroup.has(b))
    ) {
      return true;
    }
  }

  return false;
}

function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let cachedDiverseLexiconItems: CurriculumItem[] | null = null;

/**
 * Builds a category-diverse list of CurriculumItems from the 350+ entry LEXICON
 * by interleaving round-robin across food, travel, sign, number, and common categories.
 */
export function getDiverseLexiconCurriculumItems(): CurriculumItem[] {
  if (cachedDiverseLexiconItems && cachedDiverseLexiconItems.length > 0) {
    return cachedDiverseLexiconItems;
  }

  const buckets: Record<string, CurriculumItem[]> = {
    food: [],
    travel: [],
    sign: [],
    number: [],
    common: [],
  };
  const seenKn = new Set<string>();

  for (const entry of LEXICON) {
    const tr = (entry.translit || '').trim();
    const en = (entry.en || '').trim();
    if (!tr || !en || tr.length < 2 || en.length < 2) continue;
    const normKn = normalizeForKey(tr);
    if (seenKn.has(normKn)) continue;
    seenKn.add(normKn);

    const cat = buckets[entry.category] ? entry.category : 'common';
    buckets[cat].push({
      kn: tr,
      en,
      type: tr.includes(' ') ? 'phrase' : 'word',
      frame: false,
      flag: null,
    });
  }

  const categories = ['food', 'common', 'travel', 'sign', 'number'];
  const maxLen = Math.max(...categories.map((c) => buckets[c].length), 0);
  const interleaved: CurriculumItem[] = [];

  for (let i = 0; i < maxLen; i++) {
    for (const cat of categories) {
      if (buckets[cat][i]) {
        interleaved.push(buckets[cat][i]);
      }
    }
  }

  cachedDiverseLexiconItems = interleaved;
  return interleaved;
}

let cachedDiverseCurriculumItems: CurriculumItem[] | null = null;

/**
 * Interleaves non-recog CurriculumItems across all units in RAW_COURSE_DATA
 * so expansion samples across greetings, food, directions, numbers, transport, family, time, and opinions.
 */
export function getDiverseCurriculumItems(): CurriculumItem[] {
  if (cachedDiverseCurriculumItems && cachedDiverseCurriculumItems.length > 0) {
    return cachedDiverseCurriculumItems;
  }

  const perUnit = (RAW_COURSE_DATA.units || []).map((u) =>
    dedupeCurriculumItems(
      u.lessons
        .flatMap((l) => l.items || [])
        .filter((item) => item.flag !== 'recog')
    )
  );
  const maxLen = Math.max(...perUnit.map((arr) => arr.length), 0);
  const out: CurriculumItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < maxLen; i++) {
    for (let u = 0; u < perUnit.length; u++) {
      const item = perUnit[u][i];
      if (!item) continue;
      const k = `${normalizeForKey(item.kn)}::${normalizeForKey(item.en)}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(item);
      }
    }
  }

  cachedDiverseCurriculumItems = out;
  return out;
}

/**
 * Pulls up to 3 distinct distractor items for `target` via `buildUniqueMcqOptions` (`sampleUnique`):
 * 1. From the SAME lesson first
 * 2. If not enough items, from other lessons in the SAME unit
 * 3. Next, from `fallbackReviewPool`
 * 4. If still short, from category-diverse curriculum/lexicon pools (or renders fewer options rather than EVER duplicating).
 */
function pickDistractorOptions(
  target: CurriculumItem,
  lessonPool: CurriculumItem[],
  sameUnitPool: CurriculumItem[],
  fallbackReviewPool: CurriculumItem[],
  seedOffset = 0,
  lessonId?: string
): ExerciseOption[] {
  const correctOpt = toExerciseOption(target);
  const seed = hashStringToSeed(
    `${lessonId || 'lesson'}:${target.kn}:${target.en}:${seedOffset}`
  );
  const rng = mulberry32(seed);

  const tier1 = lessonPool.filter((i) => i?.kn && i?.en).map(toExerciseOption);
  const tier2 = sameUnitPool.filter((i) => i?.kn && i?.en).map(toExerciseOption);
  const tier3 = fallbackReviewPool
    .filter((i) => i?.kn && i?.en)
    .map(toExerciseOption);
  const tier4 = getDiverseCurriculumItems()
    .slice(0, 60)
    .map(toExerciseOption);

  return buildUniqueMcqOptions(
    correctOpt,
    [tier1, tier2, tier3, tier4],
    {
      maxDistractors: 3,
      rng,
      isForbiddenPair: (a, b) => {
        if (areMutualDistractorsForbidden(a.translit, b.translit, lessonId)) {
          return true;
        }
        const scriptA = normalizeForKey(
          getKannadaScriptForText(a.translit) || a.kannada
        );
        const scriptB = normalizeForKey(
          getKannadaScriptForText(b.translit) || b.kannada
        );
        return Boolean(scriptA && scriptB && scriptA === scriptB);
      },
    }
  );
}

/**
 * Builds word-order chips for a non-chunk phrase/sentence item (`translate_bank`).
 */
function buildWordOrderChips(
  target: CurriculumItem,
  distractorPool: CurriculumItem[],
  lessonId?: string
): string[] {
  const targetWords = target.kn.trim().split(/\s+/);
  const usedLower = new Set(targetWords.map((w) => w.toLowerCase()));
  const extraChips: string[] = [];

  for (const item of distractorPool) {
    if (!item?.kn || item.flag === 'recog') continue;
    if (areMutualDistractorsForbidden(target.kn, item.kn, lessonId)) continue;
    const words = item.kn.trim().split(/\s+/);
    for (const w of words) {
      const cleanW = w.trim();
      if (cleanW && !usedLower.has(cleanW.toLowerCase())) {
        usedLower.add(cleanW.toLowerCase());
        extraChips.push(cleanW);
        if (extraChips.length >= 3) break;
      }
    }
    if (extraChips.length >= 3) break;
  }

  const combined = [...targetWords, ...extraChips];
  // Deterministic rotation so chips aren't already in exact answer order
  return combined.map((_, idx) => combined[(idx + 1) % combined.length]);
}

/**
 * Generates the 12-exercise ordered Ride Sequence Drill for u23 L5:
 * hail (___ bartira?) -> meter (meter haaku) -> direction (leftu/rightu maadi) ->
 * stop (illi nillisi / allae nillisi) -> fare (eshtu aaytu?, fare eshtu?) -> pay (UPI ideya?).
 * Includes MCQ + word-order (translate_bank on non-chunk items) + 2 speak exercises.
 */
function generateRideSequenceDrillExercises(
  lessonInput: CurriculumLessonInput,
  distractorPool: CurriculumItem[],
  speechAvailable: boolean
): Exercise[] {
  const sequenceSpec: {
    stage: string;
    item: CurriculumItem;
    exType: 'mcq' | 'reverse_mcq' | 'translate_bank' | 'speak';
  }[] = [
    {
      stage: 'Stage 1 · Hail the Auto',
      item: {
        kn: 'Majestic bartira?',
        en: 'will you go to Majestic?',
        type: 'sentence',
        frame: true,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stage: 'Stage 1 · Hail the Auto',
      item: {
        kn: 'airport hogbeku',
        en: 'I need to go to the airport',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'translate_bank',
    },
    {
      stage: 'Stage 2 · Ask for the Meter',
      item: {
        kn: 'meter haaku',
        en: 'put the meter on',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stage: 'Stage 2 · Ask for the Meter',
      item: {
        kn: 'meter haaku',
        en: 'put the meter on',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'translate_bank',
    },
    {
      stage: 'Stage 3 · Give Directions',
      item: {
        kn: 'leftu maadi',
        en: 'turn left',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stage: 'Stage 3 · Give Directions',
      item: {
        kn: 'rightu maadi',
        en: 'turn right',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stage: 'Stage 4 · During the Ride',
      item: {
        kn: 'tumba traffic ide',
        en: 'there is so much traffic',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'translate_bank',
    },
    {
      stage: 'Stage 5 · Spot Your Stop',
      item: {
        kn: 'illi nillisi',
        en: 'please stop here (to driver)',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stage: 'Stage 5 · Spot Your Stop',
      item: {
        kn: 'allae nillisi',
        en: 'stop right there',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stage: 'Stage 6 · Check the Fare',
      item: {
        kn: 'eshtu aaytu?',
        en: 'how much is it?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stage: 'Stage 6 · Check the Fare',
      item: {
        kn: 'fare eshtu?',
        en: 'how much is the fare?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stage: 'Stage 7 · Pay the Driver',
      item: {
        kn: 'UPI ideya?',
        en: 'is UPI okay?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
  ];

  return sequenceSpec.map((step, idx) => {
    const options = pickDistractorOptions(
      step.item,
      distractorPool,
      distractorPool,
      distractorPool,
      idx + 1,
      lessonInput.id
    );

    if (step.exType === 'translate_bank' && step.item.flag !== 'chunk') {
      const chips = buildWordOrderChips(
        step.item,
        distractorPool,
        lessonInput.id
      );
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'translate_bank',
        prompt: `${step.stage} · Build the Kanglish phrase in order`,
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        wordChips: chips,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stage,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'speak') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'speak',
        prompt: `${step.stage} · Say this to the auto driver`,
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stage,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'reverse_mcq') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'reverse_mcq',
        prompt: `${step.stage} · How do you say this in Kanglish?`,
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stage,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    return {
      id: `${lessonInput.id}-ex${idx + 1}`,
      type: 'mcq',
      prompt: `${step.stage} · What does this mean?`,
      kannada: step.item.kn,
      translit: step.item.kn,
      meaning: step.item.en,
      options,
      answer: step.item.en,
      audioText: step.item.kn,
      isFrameHero: idx === 0,
      stageNarration: step.stage,
      note: lessonInput.note,
      itemType: step.item.type,
      itemFlag: step.item.flag,
    };
  });
}

/**
 * Generates the 15-exercise CAPSTONE — The Full Ride (u25 L5) in continuous story order:
 * (1) hail the auto, (2) state destination, (3) meter, (4) direction instruction,
 * (5) during-ride line, (6) stop, (7) fare, (8) pay, (9) thank the driver (dhanyavada, u2).
 * Includes at least 3 speak exercises across the stages, with Auto Anna stage narration.
 */
function generateFullRideCapstoneExercises(
  lessonInput: CurriculumLessonInput,
  distractorPool: CurriculumItem[],
  speechAvailable: boolean
): Exercise[] {
  const storyStages: {
    stageNarration: string;
    item: CurriculumItem;
    exType: 'mcq' | 'reverse_mcq' | 'translate_bank' | 'speak';
  }[] = [
    {
      stageNarration:
        'Stage 1/9 · Hail the Auto — Auto Anna pulls up by the curb. Ask if he will go to Majestic!',
      item: {
        kn: 'Majestic bartira?',
        en: 'will you go to Majestic?',
        type: 'sentence',
        frame: true,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 1/9 · Hail the Auto — Say the golden Bengaluru auto-hailing line out loud!',
      item: {
        kn: 'Majestic bartira?',
        en: 'will you go to Majestic?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 2/9 · State Destination — Tell Auto Anna where you need to go.',
      item: {
        kn: 'Majestic hogbeku',
        en: 'I need to go to Majestic',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 2/9 · State Destination — Mention the landmark near the traffic signal.',
      item: {
        kn: 'signal hatra',
        en: 'near the signal',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 3/9 · The Meter — You hopped in! Politely ask Auto Anna to put the meter on.',
      item: {
        kn: 'meter haaku',
        en: 'put the meter on',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 4/9 · Direction Instruction — We reached second cross. Guide Auto Anna!',
      item: {
        kn: 'leftu maadi',
        en: 'turn left',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 4/9 · Direction Instruction — Now tell him to go straight ahead.',
      item: {
        kn: 'neera hogu',
        en: 'go straight',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'mcq',
    },
    {
      stageNarration:
        'Stage 5/9 · During the Ride — Silk Board vibes! Comment on the traffic.',
      item: {
        kn: 'tumba traffic ide',
        en: 'there is so much traffic',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'translate_bank',
    },
    {
      stageNarration:
        'Stage 5/9 · During the Ride — Auto Anna is zooming! Tell him there is no hurry.',
      item: {
        kn: 'bega beda',
        en: "no hurry / don't rush",
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 6/9 · Spot Your Stop — You see your destination! Tell him to stop right there.',
      item: {
        kn: 'allae nillisi',
        en: 'stop right there',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 6/9 · Spot Your Stop — Or ask him to stop just a little ahead.',
      item: {
        kn: 'munde nillisi',
        en: 'stop ahead',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 7/9 · Check the Fare — You have arrived! Ask Auto Anna how much the fare is.',
      item: {
        kn: 'fare eshtu?',
        en: 'how much is the fare?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 8/9 · Pay the Driver — Check if you can pay with UPI.',
      item: {
        kn: 'UPI ideya?',
        en: 'is UPI okay?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 8/9 · Pay the Driver — Tell him you will pay by scanning the QR code.',
      item: {
        kn: 'scan maadi',
        en: 'scan it / pay by scan',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 9/9 · Thank the Driver — Finish your ride with a warm Bengaluru thank-you!',
      item: {
        kn: 'dhanyavada',
        en: 'thank you',
        type: 'word',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
  ];

  return storyStages.map((step, idx) => {
    const options = pickDistractorOptions(
      step.item,
      distractorPool,
      distractorPool,
      distractorPool,
      idx + 1,
      lessonInput.id
    );

    if (step.exType === 'translate_bank' && step.item.flag !== 'chunk') {
      const chips = buildWordOrderChips(
        step.item,
        distractorPool,
        lessonInput.id
      );
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'translate_bank',
        prompt: 'Build the Kanglish sentence in order',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        wordChips: chips,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'speak') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'speak',
        prompt: 'Say this out loud to Auto Anna',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'reverse_mcq') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'reverse_mcq',
        prompt: 'How do you say this in Kanglish?',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    return {
      id: `${lessonInput.id}-ex${idx + 1}`,
      type: 'mcq',
      prompt: 'Select the correct English meaning',
      kannada: step.item.kn,
      translit: step.item.kn,
      meaning: step.item.en,
      options,
      answer: step.item.en,
      audioText: step.item.kn,
      isFrameHero: idx === 0,
      stageNarration: step.stageNarration,
      note: lessonInput.note,
      itemType: step.item.type,
      itemFlag: step.item.flag,
    };
  });
}

/**
 * Generates the 20-exercise FINAL CAPSTONE — The Full Bengaluru Day (u30 L5)
 * structured in story order across all 5 phases (Stages 1–9),
 * with 5 speak exercises and 2 listening/recog checks (barutte, illa sir).
 */
function generateFullBengaluruDayCapstoneExercises(
  lessonInput: CurriculumLessonInput,
  distractorPool: CurriculumItem[],
  speechAvailable: boolean
): Exercise[] {
  const dayStages: {
    stageNarration: string;
    item: CurriculumItem;
    exType: 'mcq' | 'reverse_mcq' | 'translate_bank' | 'speak' | 'listen';
  }[] = [
    // Stage 1 — Morning greeting & small talk (u1, u24)
    {
      stageNarration:
        'Stage 1/9 · Morning Greeting & Small Talk — You step out into the sunny Bengaluru morning and greet your neighbour.',
      item: {
        kn: 'namaskara',
        en: 'hello',
        type: 'word',
        frame: true,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 1/9 · Morning Greeting & Small Talk — Your neighbour asks "hegiddira?". Reply out loud that you are fine!',
      item: {
        kn: 'chennagidini',
        en: 'I am fine',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 1/9 · Morning Greeting & Small Talk — Comment on the warm Bengaluru weather today.',
      item: {
        kn: 'tumba bisi ide',
        en: "it's very hot today",
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },

    // Stage 2 — Breakfast at a Darshini (u5, u6, u9, u15, u29)
    {
      stageNarration:
        'Stage 2/9 · Breakfast at a Darshini — You walk up to the counter. Order a crispy masala dosa out loud!',
      item: {
        kn: 'nanage dose kodi',
        en: 'please give me a dosa',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 2/9 · Breakfast at a Darshini — Build the compliment for your hot filter coffee & dosa.',
      item: {
        kn: 'tumba olledu',
        en: 'very good',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'translate_bank',
    },
    {
      stageNarration:
        'Stage 2/9 · Breakfast at a Darshini — Ask the cashier how much the breakfast bill came to.',
      item: {
        kn: 'eshtu aaytu?',
        en: 'how much is it?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },

    // Stage 3 — Hailing the morning auto (u21, u22)
    {
      stageNarration:
        'Stage 3/9 · Hailing the Morning Auto — Hail an auto outside the Darshini and ask if he will go to the office!',
      item: {
        kn: 'office bartira?',
        en: 'will you go to the office?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 3/9 · Hailing the Morning Auto — Listen to the first driver reply to your request.',
      item: {
        kn: 'illa sir',
        en: "no sir (won't go)",
        type: 'phrase',
        frame: false,
        flag: 'recog',
      },
      exType: 'listen',
    },
    {
      stageNarration:
        'Stage 3/9 · Hailing the Morning Auto — Auto Anna pulls up next and replies! Listen to what he says.',
      item: {
        kn: 'barutte',
        en: "yes, I'll come (driver's reply)",
        type: 'word',
        frame: false,
        flag: 'recog',
      },
      exType: 'listen',
    },
    {
      stageNarration:
        'Stage 3/9 · Hailing the Morning Auto — You hop into Auto Anna’s rickshaw. Ask him to put the meter on!',
      item: {
        kn: 'meter haaku',
        en: 'put the meter on',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },

    // Stage 4 — Navigating the ride (u19, u20, u23)
    {
      stageNarration:
        'Stage 4/9 · Navigating the Ride — Guide Auto Anna at the corner.',
      item: {
        kn: 'leftu maadi',
        en: 'turn left',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
    {
      stageNarration:
        'Stage 4/9 · Navigating the Ride — Build the instruction to go straight ahead.',
      item: {
        kn: 'neera hogu',
        en: 'go straight',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'translate_bank',
    },
    {
      stageNarration:
        'Stage 4/9 · Navigating the Ride — Tell Auto Anna your office is near the signal.',
      item: {
        kn: 'signal hatra',
        en: 'near the signal',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },

    // Stage 5 — Arriving & paying (u11, u22, u23)
    {
      stageNarration:
        'Stage 5/9 · Arriving & Paying — You see your office gate! Tell Auto Anna out loud to stop right there.',
      item: {
        kn: 'allae nillisi',
        en: 'stop right there',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 5/9 · Arriving & Paying — Ask Auto Anna if UPI is okay and scan the QR code.',
      item: {
        kn: 'UPI ideya?',
        en: 'is UPI okay?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },

    // Stage 6 — Workday & time check (u26, u28)
    {
      stageNarration:
        'Stage 6/9 · Workday & Time Check — At your desk, ask your colleague what time it is now.',
      item: {
        kn: 'innu eshtu gante?',
        en: 'what time is it now?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },
    {
      stageNarration:
        'Stage 6/9 · Workday & Time Check — After lunch, your colleague greets you with Bengaluru’s #1 small-talk question!',
      item: {
        kn: 'oota aayta?',
        en: 'have you eaten?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },

    // Stage 7 — Evening plans with a friend (u13, u26, u27)
    {
      stageNarration:
        'Stage 7/9 · Evening Plans with a Friend — Wrap up the workday and tell your friend "see you tomorrow".',
      item: {
        kn: 'naale sigona',
        en: 'see you tomorrow',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'reverse_mcq',
    },

    // Stage 8 — Feeling at home (u29)
    {
      stageNarration:
        'Stage 8/9 · Feeling at Home — Your friend compliments your Kannada! Proudly say out loud: "Kannada is easy!"',
      item: {
        kn: 'kannada sulabha',
        en: 'Kannada is easy!',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      exType: speechAvailable ? 'speak' : 'reverse_mcq',
    },

    // Stage 9 — Saying goodnight (u27, u28)
    {
      stageNarration:
        'Stage 9/9 · Saying Goodnight — End your Bengaluru day with the classic warm Kannada goodbye!',
      item: {
        kn: 'hogbittu bartini',
        en: "I'll go and come back (the classic Kannada goodbye)",
        type: 'phrase',
        frame: false,
        flag: null,
      },
      exType: 'mcq',
    },
  ];

  return dayStages.map((step, idx) => {
    const options = pickDistractorOptions(
      step.item,
      distractorPool,
      distractorPool,
      distractorPool,
      idx + 1,
      lessonInput.id
    );

    if (step.exType === 'listen') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'listen',
        prompt: 'What you will HEAR · Listen to the driver and pick the meaning',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.en,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'translate_bank' && step.item.flag !== 'chunk') {
      const chips = buildWordOrderChips(
        step.item,
        distractorPool,
        lessonInput.id
      );
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'translate_bank',
        prompt: 'Build the Kanglish phrase in order',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        wordChips: chips,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'speak') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'speak',
        prompt: 'Say this out loud in Kanglish',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    if (step.exType === 'reverse_mcq') {
      return {
        id: `${lessonInput.id}-ex${idx + 1}`,
        type: 'reverse_mcq',
        prompt: 'How do you say this in Kanglish?',
        kannada: step.item.kn,
        translit: step.item.kn,
        meaning: step.item.en,
        options,
        answer: step.item.kn,
        audioText: step.item.kn,
        stageNarration: step.stageNarration,
        note: lessonInput.note,
        itemType: step.item.type,
        itemFlag: step.item.flag,
      };
    }

    return {
      id: `${lessonInput.id}-ex${idx + 1}`,
      type: 'mcq',
      prompt: 'Select the correct English meaning',
      kannada: step.item.kn,
      translit: step.item.kn,
      meaning: step.item.en,
      options,
      answer: step.item.en,
      audioText: step.item.kn,
      isFrameHero: idx === 0,
      stageNarration: step.stageNarration,
      note: lessonInput.note,
      itemType: step.item.type,
      itemFlag: step.item.flag,
    };
  });
}

/**
 * Computes exact exercise slot counts for a lesson (8-12 exercises for normal, 10-15 for drills/checkpoints):
 * - 40% MCQ (kn -> en)
 * - 25% Reverse MCQ (en -> kn)
 * - 20% Speak (or MCQ fallback if browser lacks SpeechRecognition)
 * - 15% Matching pairs (4 kn <-> en pairs)
 */
function computeSlotTypes(
  totalExercises: number,
  canUseSpeak: boolean,
  hasEligibleSpeakItems: boolean,
  minSpeakCount = 0
): ('mcq' | 'reverse_mcq' | 'speak' | 'match')[] {
  const rawSpeakCount = Math.max(
    minSpeakCount,
    Math.round(totalExercises * 0.2)
  );
  const speakCount =
    canUseSpeak && hasEligibleSpeakItems ? rawSpeakCount : 0;
  const mcqCount = Math.round(totalExercises * 0.4);
  const revMcqCount = Math.round(totalExercises * 0.25);
  const extraMcqFromSpeak =
    canUseSpeak && hasEligibleSpeakItems ? 0 : rawSpeakCount;
  const matchCount = Math.max(
    1,
    totalExercises - (mcqCount + extraMcqFromSpeak + revMcqCount + speakCount)
  );

  const slots: ('mcq' | 'reverse_mcq' | 'speak' | 'match')[] = [];
  const finalMcqCount = mcqCount + extraMcqFromSpeak;

  // Interleave slots cleanly while keeping an easy MCQ at the end
  let m = finalMcqCount;
  let r = revMcqCount;
  let s = speakCount;
  let p = matchCount;

  while (m + r + s + p > 1) {
    if (m > 1) {
      slots.push('mcq');
      m--;
    }
    if (r > 0 && m + r + s + p > 1) {
      slots.push('reverse_mcq');
      r--;
    }
    if (s > 0 && m + r + s + p > 1) {
      slots.push('speak');
      s--;
    }
    if (p > 0 && m + r + s + p > 1) {
      slots.push('match');
      p--;
    }
    if (m === 1 && r === 0 && s === 0 && p === 0) break;
  }

  // Final exercise is an MCQ (or whatever single slot remains)
  if (m > 0) slots.push('mcq');
  else if (r > 0) slots.push('reverse_mcq');
  else if (p > 0) slots.push('match');
  else if (s > 0) slots.push('speak');

  return slots;
}

/**
 * Generates exercises for a normal, drill, or checkpoint lesson
 * strictly enforcing flag ("chunk", "recog"), lookalike, and frame (hero first) rules.
 */
export function generateLessonExercises(
  lessonInput: CurriculumLessonInput,
  currentUnit: CurriculumUnitInput,
  allUnitsUpToCurrent: CurriculumUnitInput[]
): Exercise[] {
  const speechAvailable =
    typeof window === 'undefined' ? true : isSpeechRecognitionSupported();

  // Gather items from the specified reviewFrom units (only up to current unit — never future units)
  const reviewUnitIds = new Set(lessonInput.reviewFrom || []);
  const checkpointUnits = allUnitsUpToCurrent.filter((u) =>
    reviewUnitIds.has(u.id)
  );

  // Interleave items across reviewFrom units so checkpoints and review drills sample evenly
  const checkpointInterleavedItems: CurriculumItem[] = [];
  if (checkpointUnits.length > 0) {
    const perUnitItems = checkpointUnits.map((u) =>
      dedupeCurriculumItems(u.lessons.flatMap((l) => l.items || []))
    );
    const maxLen = Math.max(...perUnitItems.map((arr) => arr.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (let uIdx = 0; uIdx < perUnitItems.length; uIdx++) {
        if (perUnitItems[uIdx][i]) {
          checkpointInterleavedItems.push(perUnitItems[uIdx][i]);
        }
      }
    }
  }

  // Collect all items in the current unit
  const sameUnitItems = dedupeCurriculumItems(
    currentUnit.lessons.flatMap((l) => l.items || [])
  );
  const sameUnitNonRecog = sameUnitItems.filter(
    (item) => item.flag !== 'recog'
  );

  // Special ordered simulations in Phase 4 & Phase 5:
  // - u23_l5: Ride sequence drill (12 exercises in stage order)
  // - u25_l5: CAPSTONE — The Full Ride (15 exercises in story order)
  // - u30_l5: CAPSTONE — The Full Bengaluru Day (20 exercises in story order)
  if (lessonInput.id === 'u23_l5') {
    const pool = dedupeCurriculumItems([
      ...checkpointInterleavedItems,
      ...sameUnitItems,
    ]);
    return generateRideSequenceDrillExercises(
      lessonInput,
      pool,
      speechAvailable
    );
  }

  if (lessonInput.id === 'u25_l5') {
    const pool = dedupeCurriculumItems([
      ...checkpointInterleavedItems,
      ...sameUnitItems,
    ]);
    return generateFullRideCapstoneExercises(
      lessonInput,
      pool,
      speechAvailable
    );
  }

  if (lessonInput.id === 'u30_l5') {
    const pool = dedupeCurriculumItems([
      ...checkpointInterleavedItems,
      ...sameUnitItems,
    ]);
    return generateFullBengaluruDayCapstoneExercises(
      lessonInput,
      pool,
      speechAvailable
    );
  }

  const isCheckpoint = lessonInput.type === 'checkpoint';
  const isPlugBekuDrill = Boolean(
    !isCheckpoint &&
      (!lessonInput.items || lessonInput.items.length === 0) &&
      lessonInput.note &&
      /nanage ___ beku/i.test(lessonInput.note)
  );
  const isPlugKodiDrill = Boolean(
    lessonInput.note &&
      /nanage ___ kodi/i.test(lessonInput.note) &&
      !isCheckpoint
  );
  const isPlugThinnuKudiDrill = Boolean(
    !isCheckpoint &&
      (!lessonInput.items || lessonInput.items.length === 0) &&
      lessonInput.note &&
      /thinnu\/kudi/i.test(lessonInput.note)
  );
  const isPlugHailingDrill = lessonInput.id === 'u22_l5';
  const isPlugTimeDrill = lessonInput.id === 'u26_l5';
  const isPlugOpinionDrill = lessonInput.id === 'u29_l5';
  const isReviewDrillLesson = Boolean(
    !isCheckpoint &&
      (!lessonInput.items || lessonInput.items.length === 0) &&
      Array.isArray(lessonInput.reviewFrom) &&
      lessonInput.reviewFrom.length > 0 &&
      !isPlugBekuDrill &&
      !isPlugThinnuKudiDrill &&
      !isPlugHailingDrill &&
      !isPlugTimeDrill &&
      !isPlugOpinionDrill
  );

  // Determine lesson's own item pool
  let rawLessonItems: CurriculumItem[] = [];
  if (isPlugBekuDrill) {
    const sourceUnits =
      checkpointUnits.length > 0
        ? checkpointUnits
        : allUnitsUpToCurrent.filter((u) =>
            ['u5', 'u6', 'u7', 'u8'].includes(u.id)
          );
    rawLessonItems = buildPluggedBekuItemsFromUnits(sourceUnits);
  } else if (isPlugThinnuKudiDrill) {
    const foodDrinkUnits = allUnitsUpToCurrent.filter((u) =>
      ['u5', 'u6'].includes(u.id)
    );
    const pluggedVerbs = buildPluggedThinnuKudiItemsFromUnits(foodDrinkUnits);
    rawLessonItems = dedupeCurriculumItems([
      ...pluggedVerbs,
      ...sameUnitNonRecog,
    ]);
  } else if (isPlugKodiDrill) {
    const foodDrinkUnits = allUnitsUpToCurrent.filter((u) =>
      ['u5', 'u6'].includes(u.id)
    );
    const pluggedKodi = buildPluggedKodiItemsFromUnits(foodDrinkUnits);
    rawLessonItems = dedupeCurriculumItems([
      ...(lessonInput.items || []),
      ...pluggedKodi,
    ]);
  } else if (isPlugHailingDrill) {
    const placeUnits = allUnitsUpToCurrent.filter((u) =>
      ['u7', 'u20', 'u22'].includes(u.id)
    );
    rawLessonItems = buildPluggedHailingItemsFromUnits(placeUnits);
  } else if (isPlugTimeDrill) {
    const timeUnits = allUnitsUpToCurrent.filter((u) =>
      ['u4', 'u26'].includes(u.id)
    );
    rawLessonItems = buildPluggedTimeItemsFromUnits(timeUnits);
  } else if (isPlugOpinionDrill) {
    const opinionUnits = allUnitsUpToCurrent.filter((u) =>
      ['u1', 'u5', 'u6', 'u7', 'u29'].includes(u.id)
    );
    rawLessonItems = buildPluggedOpinionItemsFromUnits(opinionUnits);
  } else if (lessonInput.id === 'u30_l3') {
    // Full ride remix: DIFFERENT destination/direction combinations than u25
    const remixItems: CurriculumItem[] = [
      {
        kn: 'airport hogbeku',
        en: 'I need to go to the airport',
        type: 'sentence',
        frame: true,
        flag: null,
      },
      {
        kn: 'metro station bartira?',
        en: 'will you go to the metro station?',
        type: 'sentence',
        frame: false,
        flag: null,
      },
      {
        kn: 'circle hatra',
        en: 'near the circle',
        type: 'phrase',
        frame: false,
        flag: null,
      },
      {
        kn: 'rightu maadi',
        en: 'turn right',
        type: 'phrase',
        frame: false,
        flag: null,
      },
    ];
    rawLessonItems = dedupeCurriculumItems([
      ...remixItems,
      ...checkpointInterleavedItems,
    ]);
  } else if (lessonInput.id === 'u24_l5') {
    // u24_l5 ("Chit-chat drill"): mix u23 L3 and u24 L1–L4 items only
    const u23Unit = allUnitsUpToCurrent.find((u) => u.id === 'u23');
    const u23L3Items =
      u23Unit?.lessons.find((l) => l.id === 'u23_l3')?.items || [];
    rawLessonItems = dedupeCurriculumItems([...u23L3Items, ...sameUnitItems]);
  } else if (isCheckpoint || isReviewDrillLesson) {
    rawLessonItems = dedupeCurriculumItems(checkpointInterleavedItems);
    if (rawLessonItems.length === 0) {
      rawLessonItems = sameUnitItems;
    }
  } else {
    rawLessonItems = dedupeCurriculumItems(lessonInput.items || []);
  }

  // If a normal lesson specifies reviewFrom (e.g. u12_l2, u12_l5 reusing "ninna" from u2, u14_l5 / u28_l2 reusing "banni" from u2, u17_l4 reusing "kodu" from u15, u29_l4 reusing "tumba santosha" from u1),
  // include those specifically referenced items in the working pool without duplicating keys in RAW_COURSE_DATA
  const referencedReviewItems: CurriculumItem[] = [];
  if (!isCheckpoint && !isReviewDrillLesson && checkpointUnits.length > 0) {
    for (const item of checkpointInterleavedItems) {
      if (
        (lessonInput.id === 'u12_l2' || lessonInput.id === 'u12_l5') &&
        item.kn === 'ninna'
      ) {
        referencedReviewItems.push(item);
      } else if (
        (lessonInput.id === 'u14_l5' || lessonInput.id === 'u28_l2') &&
        item.kn === 'banni'
      ) {
        referencedReviewItems.push(item);
      } else if (lessonInput.id === 'u17_l4' && item.kn === 'kodu') {
        referencedReviewItems.push(item);
      } else if (lessonInput.id === 'u29_l4' && item.kn === 'tumba santosha') {
        referencedReviewItems.push(item);
      }
    }
  }

  // Rule: A lesson with fewer than 4 items (or fewer than 4 non-recog items, like u8 L3, u14 L5, u22 L3)
  // borrows items from the SAME unit (plus any explicitly referenced prior item) to reach minimum exercise & distractor count
  const workingPool: CurriculumItem[] = dedupeCurriculumItems([
    ...rawLessonItems,
    ...referencedReviewItems,
  ]);
  const nonRecogInLessonCount = workingPool.filter(
    (item) => item.flag !== 'recog'
  ).length;

  if (!isCheckpoint && (workingPool.length < 4 || nonRecogInLessonCount < 4)) {
    for (const extra of sameUnitItems) {
      if (
        !workingPool.some(
          (w) => w.kn.trim().toLowerCase() === extra.kn.trim().toLowerCase()
        )
      ) {
        workingPool.push(extra);
      }
      const currentNonRecog = workingPool.filter(
        (item) => item.flag !== 'recog'
      ).length;
      if (workingPool.length >= 6 && currentNonRecog >= 4) break;
    }
  }

  if (workingPool.length === 0) {
    return [];
  }

  // Strictly enforce flag rules:
  // - "recog" items NEVER appear in speak exercises and NEVER as correct MCQ/reverse_mcq answers
  const nonRecogLessonItems = dedupeCurriculumItems([
    ...rawLessonItems,
    ...referencedReviewItems,
  ]).filter((item) => item.flag !== 'recog');
  const nonRecogWorkingItems = workingPool.filter(
    (item) => item.flag !== 'recog'
  );
  const activeTargetPool =
    nonRecogLessonItems.length > 0
      ? nonRecogLessonItems
      : nonRecogWorkingItems.length > 0
      ? nonRecogWorkingItems
      : sameUnitNonRecog;

  // Speak-eligible items: strictly non-recog
  // Lessons with explicit speak targets in their notes:
  // - u18_l5: command frames ("illi nillisi", "bega baa", "nanage ___ kodi")
  // - u19_l5: (leftu maadi, rightu maadi, neera hogu)
  // - u21_l5: plugged fillers ("meter haaku sir", "meter haaku anna", "meter haaku")
  // - u22_l3: recognition drill only -> ZERO speak exercises!
  // - u24_l5: (tumba bisi ide, sorry, late aaytu)
  // - u26_l5: ("innu eshtu gante?", "ondu ardha gante")
  // - u27_l5: ("naale sigona", "naale banni" — strictly u27 items only!)
  // - u29_l5: ("nanage dose ishta", "kannada sulabha")
  const isRecogOnlyLesson = lessonInput.id === 'u22_l3';
  const isPhase3BossCheckpoint = lessonInput.id === 'u18_l5';

  let customSpeakPool: CurriculumItem[] | null = null;
  if (isPhase3BossCheckpoint) {
    customSpeakPool = [
      {
        kn: 'illi nillisi',
        en: 'please stop here (to driver)',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      {
        kn: 'bega baa',
        en: 'come quickly',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      {
        kn: 'nanage dose kodi',
        en: 'please give me a dosa',
        type: 'sentence',
        frame: true,
        flag: null,
      },
    ];
  } else if (lessonInput.id === 'u19_l5') {
    customSpeakPool = [
      {
        kn: 'leftu maadi',
        en: 'turn left',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      {
        kn: 'rightu maadi',
        en: 'turn right',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      {
        kn: 'neera hogu',
        en: 'go straight',
        type: 'phrase',
        frame: true,
        flag: null,
      },
    ];
  } else if (lessonInput.id === 'u21_l5') {
    customSpeakPool = [
      {
        kn: 'meter haaku sir',
        en: 'put the meter on, sir',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      {
        kn: 'meter haaku anna',
        en: 'put the meter on, brother',
        type: 'phrase',
        frame: true,
        flag: null,
      },
    ];
  } else if (lessonInput.id === 'u24_l5') {
    customSpeakPool = [
      {
        kn: 'tumba bisi ide',
        en: "it's very hot today",
        type: 'sentence',
        frame: true,
        flag: null,
      },
      {
        kn: 'sorry, late aaytu',
        en: "sorry, I'm late",
        type: 'phrase',
        frame: false,
        flag: 'chunk',
      },
    ];
  } else if (lessonInput.id === 'u26_l5') {
    customSpeakPool = [
      {
        kn: 'innu eshtu gante?',
        en: 'what time is it now?',
        type: 'sentence',
        frame: true,
        flag: null,
      },
      {
        kn: 'ondu ardha gante',
        en: 'half an hour',
        type: 'phrase',
        frame: true,
        flag: null,
      },
    ];
  } else if (lessonInput.id === 'u27_l5') {
    customSpeakPool = [
      {
        kn: 'naale sigona',
        en: 'see you tomorrow',
        type: 'phrase',
        frame: true,
        flag: null,
      },
      {
        kn: 'naale banni',
        en: 'come tomorrow',
        type: 'phrase',
        frame: true,
        flag: null,
      },
    ];
  } else if (lessonInput.id === 'u29_l5') {
    customSpeakPool = [
      {
        kn: 'nanage dose ishta',
        en: 'I like dosa',
        type: 'sentence',
        frame: true,
        flag: null,
      },
      {
        kn: 'kannada sulabha',
        en: 'Kannada is easy!',
        type: 'sentence',
        frame: true,
        flag: null,
      },
    ];
  }

  const requiresBekuBedaSpeak = Boolean(
    isCheckpoint &&
      lessonInput.note &&
      /beku\s*(\/|or|-)\s*beda/i.test(lessonInput.note)
  );
  const bekuBedaSpeakSentences = activeTargetPool.filter(
    (item) =>
      item.flag !== 'recog' && /\b(beku|beda)\b/i.test(item.kn.trim())
  );
  const speakEligiblePool = isRecogOnlyLesson
    ? []
    : customSpeakPool && customSpeakPool.length > 0
    ? customSpeakPool
    : requiresBekuBedaSpeak && bekuBedaSpeakSentences.length > 0
    ? bekuBedaSpeakSentences
    : activeTargetPool.filter((item) => item.flag !== 'recog');

  // Digit items in current unit (e.g. u4 numbers 1–20, u11 big numbers 30–100, u26_l5 clock times)
  const digitItems = sameUnitItems.filter(
    (item) => item.flag !== 'recog' && /^\d+$/.test(item.en.trim())
  );
  const hasDigitDrillNote = Boolean(
    isCheckpoint &&
      digitItems.length >= 4 &&
      lessonInput.note &&
      /digit|number|moovattu|nooru/i.test(lessonInput.note)
  );

  // Non-digit review items from reviewFrom units in checkpoint
  const conversationalReviewItems = activeTargetPool.filter(
    (item) => !/^\d+$/.test(item.en.trim())
  );

  // Contrast drill detection
  const isContrastDrill = Boolean(
    lessonInput.note &&
      /contrast|sorting drill|polite vs casual/i.test(lessonInput.note)
  );

  // Hero item (frame: true) -> MUST become the FIRST exercise shown when the lesson opens
  const frameHeroItem =
    rawLessonItems.find((item) => item.frame && item.flag !== 'recog') ||
    null;

  // Parse explicit exercise count from note if specified (e.g. "10 exercises", "10-exercise drill", "12 exercises", "15 exercises")
  const explicitCountMatch = lessonInput.note
    ? lessonInput.note.match(/(\d+)(?:-|\s+)exercises?/i)
    : null;
  const explicitCount = explicitCountMatch
    ? parseInt(explicitCountMatch[1], 10)
    : null;

  // Target exercise count: explicitCount if specified, otherwise 12 for checkpoint, 8–12 for normal lessons
  const targetCount = explicitCount
    ? explicitCount
    : isCheckpoint
    ? 12
    : Math.min(12, Math.max(8, rawLessonItems.length * 3));

  const minSpeakForLesson = isPhase3BossCheckpoint
    ? 3
    : [
        'u19_l5',
        'u21_l5',
        'u22_l5',
        'u24_l5',
        'u26_l5',
        'u27_l5',
        'u29_l5',
      ].includes(lessonInput.id)
    ? 2
    : 0;

  const slotTypes = computeSlotTypes(
    targetCount,
    speechAvailable && !isRecogOnlyLesson,
    speakEligiblePool.length > 0,
    minSpeakForLesson
  );

  // Fallback distractor pool: for normal lessons, strictly SAME unit only (plus plugged/referenced items);
  // for checkpoints and review drills, items from reviewFrom units + current unit.
  const fallbackDistractorPool =
    isCheckpoint || isReviewDrillLesson
      ? [...workingPool, ...sameUnitItems]
      : isPlugBekuDrill ||
        isPlugKodiDrill ||
        isPlugThinnuKudiDrill ||
        isPlugHailingDrill ||
        isPlugTimeDrill ||
        isPlugOpinionDrill
      ? [...rawLessonItems, ...sameUnitItems]
      : [...workingPool, ...sameUnitItems];

  // Build 4 pairs for matching exercises (strictly non-recog items, respecting lookalike exclusions)
  const buildMatchPairs = (
    offset: number,
    preferDigits = false,
    extraSource: CurriculumItem[] = []
  ): ExerciseOption[] => {
    const primarySource =
      preferDigits && digitItems.length >= 4
        ? digitItems
        : activeTargetPool;
    const candidates = [
      ...primarySource,
      ...sameUnitNonRecog,
      ...fallbackDistractorPool.filter((i) => i.flag !== 'recog'),
      ...extraSource.filter((i) => i.flag !== 'recog'),
    ];
    const unique: CurriculumItem[] = [];
    const seenKn = new Set<string>();
    const seenEn = new Set<string>();

    for (let i = 0; i < candidates.length && unique.length < 4; i++) {
      const c = candidates[(i + offset) % candidates.length];
      if (!c?.kn || !c?.en || c.flag === 'recog') continue;
      const k = normalizeForKey(c.kn);
      const e = normalizeForKey(c.en);
      const conflictsWithExisting = unique.some((uItem) =>
        areMutualDistractorsForbidden(uItem.kn, k, lessonInput.id)
      );
      if (!seenKn.has(k) && !seenEn.has(e) && !conflictsWithExisting) {
        seenKn.add(k);
        seenEn.add(e);
        unique.push(c);
      }
    }
    return unique.map(toExerciseOption);
  };

  // For u22_l3 ("Driver replies (what you will HEAR)"), include audio-recognition stems where the learner hears barutte / illa sir and picks the meaning
  const recogLessonStems =
    lessonInput.id === 'u22_l3'
      ? (lessonInput.items || []).filter((item) => item.flag === 'recog')
      : [];

  // Expand candidate items across current lesson -> current unit -> prior units -> diverse curriculum & lexicon
  const priorUnitsItems = dedupeCurriculumItems(
    allUnitsUpToCurrent
      .flatMap((u) => u.lessons.flatMap((l) => l.items || []))
      .filter((item) => item.flag !== 'recog')
  );

  const expandedNonRecogItems = dedupeCurriculumItems([
    ...activeTargetPool,
    ...sameUnitNonRecog,
    ...checkpointInterleavedItems.filter((i) => i.flag !== 'recog'),
    ...priorUnitsItems,
    ...getDiverseCurriculumItems(),
    ...getDiverseLexiconCurriculumItems().slice(0, 60),
  ]);

  const expandedSpeakItems = isRecogOnlyLesson
    ? []
    : dedupeCurriculumItems([
        ...speakEligiblePool,
        ...sameUnitNonRecog,
        ...priorUnitsItems,
        ...getDiverseCurriculumItems(),
      ]);

  const exercises: Exercise[] = [];
  const usedQuestionKeys = new Set<string>();
  const usedWordsInRound = new Set<string>();

  const pickUniqueTargetFrom = (
    pool: CurriculumItem[],
    exType: ExerciseType,
    preferUnusedWord = true
  ): CurriculumItem | null => {
    const combined = dedupeCurriculumItems([
      ...pool,
      ...sameUnitNonRecog,
      ...expandedNonRecogItems,
    ]);
    if (combined.length === 0) return null;

    const direction =
      exType === 'mcq'
        ? 'kn->en'
        : exType === 'reverse_mcq'
        ? 'en->kn'
        : exType === 'listen'
        ? 'audio->en'
        : exType === 'speak'
        ? 'speak->kn'
        : 'bank->kn';

    if (preferUnusedWord) {
      for (const candidate of combined) {
        const stem = normalizeForKey(candidate.kn);
        const qKey = `${exType}:${direction}:${stem}`;
        if (!usedQuestionKeys.has(qKey) && !usedWordsInRound.has(stem)) {
          return candidate;
        }
      }
    }

    for (const candidate of combined) {
      const stem = normalizeForKey(candidate.kn);
      const qKey = `${exType}:${direction}:${stem}`;
      if (!usedQuestionKeys.has(qKey)) {
        return candidate;
      }
    }

    return null;
  };

  const commitExerciseIfUnique = (ex: Exercise): boolean => {
    const qKey = canonicalQuestionKey(ex);
    if (usedQuestionKeys.has(qKey)) return false;
    usedQuestionKeys.add(qKey);
    const stem = normalizeForKey(ex.translit || ex.kannada);
    if (stem) usedWordsInRound.add(stem);
    exercises.push(ex);
    return true;
  };

  for (let idx = 0; idx < slotTypes.length; idx++) {
    const isFirstSlot = idx === 0 && frameHeroItem !== null;
    const slotType = isFirstSlot ? 'mcq' : slotTypes[idx];

    // For checkpoints with digit drills (u4 L5, u11 L5): mix digit drills with review items
    const useDigitDrillForSlot =
      hasDigitDrillNote && idx % 3 === 0 && digitItems.length >= 4;

    if (slotType === 'match') {
      let matchedAdded = false;
      for (let shift = 0; shift < 20; shift++) {
        const pairs = buildMatchPairs(
          idx * 2 + shift,
          useDigitDrillForSlot,
          expandedNonRecogItems
        );
        if (pairs.length < 2) continue;
        const anchor = pairs[0] || toExerciseOption(activeTargetPool[0]);
        const matchEx: Exercise = {
          id: `${lessonInput.id}-ex${exercises.length + 1}`,
          type: 'match',
          prompt: useDigitDrillForSlot
            ? 'Digit Drill · Match the Kanglish number with the digit'
            : 'Match the Kanglish with its English meaning',
          kannada: anchor.kannada,
          translit: anchor.translit,
          meaning: anchor.meaning,
          pairs,
          answer: 'matched',
          audioText: anchor.translit,
          note: lessonInput.note || undefined,
        };
        if (commitExerciseIfUnique(matchEx)) {
          matchedAdded = true;
          break;
        }
      }
      if (matchedAdded) continue;
    }

    if (slotType === 'speak') {
      const baseSpeakPool =
        customSpeakPool && customSpeakPool.length > 0
          ? [...customSpeakPool, ...expandedSpeakItems]
          : requiresBekuBedaSpeak && speakEligiblePool.length > 0
          ? [...speakEligiblePool, ...expandedSpeakItems]
          : isCheckpoint &&
            conversationalReviewItems.length > 0 &&
            idx % 2 === 1
          ? [...conversationalReviewItems, ...expandedSpeakItems]
          : expandedSpeakItems;

      const targetItem = pickUniqueTargetFrom(baseSpeakPool, 'speak', true);
      if (targetItem) {
        const isTargetDigit = /^\d+$/.test(targetItem.en.trim());
        const options = pickDistractorOptions(
          targetItem,
          isTargetDigit && digitItems.length >= 4 ? digitItems : workingPool,
          sameUnitItems,
          fallbackDistractorPool,
          idx + 1,
          lessonInput.id
        );
        commitExerciseIfUnique({
          id: `${lessonInput.id}-ex${exercises.length + 1}`,
          type: 'speak',
          prompt: 'Say this out loud in Kanglish',
          kannada: targetItem.kn.trim(),
          translit: targetItem.kn.trim(),
          meaning: targetItem.en.trim(),
          options,
          answer: targetItem.kn.trim(),
          audioText: targetItem.kn.trim(),
          note: lessonInput.note || undefined,
          itemType: targetItem.type,
          itemFlag: targetItem.flag,
        });
        continue;
      }
    }

    if (slotType === 'reverse_mcq') {
      const basePool = useDigitDrillForSlot
        ? [...digitItems, ...activeTargetPool]
        : isCheckpoint && conversationalReviewItems.length > 0
        ? conversationalReviewItems
        : activeTargetPool;

      const preferredMeterItem: CurriculumItem | null =
        lessonInput.id === 'u21_l5' &&
        !usedQuestionKeys.has('reverse_mcq:en->kn:meter haaku')
          ? {
              kn: 'meter haaku',
              en: 'put the meter on',
              type: 'phrase',
              frame: true,
              flag: null,
            }
          : null;

      const targetItem =
        preferredMeterItem ||
        pickUniqueTargetFrom(basePool, 'reverse_mcq', true);
      if (targetItem) {
        const isTargetDigit = /^\d+$/.test(targetItem.en.trim());
        const distractorLessonPool =
          isTargetDigit && digitItems.length >= 4 ? digitItems : workingPool;
        const distractorUnitPool =
          isTargetDigit && digitItems.length >= 4 ? digitItems : sameUnitItems;

        const options = pickDistractorOptions(
          targetItem,
          distractorLessonPool,
          distractorUnitPool,
          fallbackDistractorPool,
          idx + 2,
          lessonInput.id
        );
        commitExerciseIfUnique({
          id: `${lessonInput.id}-ex${exercises.length + 1}`,
          type: 'reverse_mcq',
          prompt: isTargetDigit
            ? `Digit Drill · Pick the Kanglish word for ${targetItem.en.trim()}`
            : isContrastDrill
            ? 'Contrast Drill · Pick the exact Kanglish expression'
            : 'How do you say this in Kanglish?',
          kannada: targetItem.kn.trim(),
          translit: targetItem.kn.trim(),
          meaning: targetItem.en.trim(),
          options,
          answer: targetItem.kn.trim(),
          audioText: targetItem.kn.trim(),
          note: lessonInput.note || undefined,
          itemType: targetItem.type,
          itemFlag: targetItem.flag,
        });
        continue;
      }
    }

    // For u22_l3 ("Driver replies (what you will HEAR)"), use `listen` audio-recognition stems on even slots
    if (recogLessonStems.length > 0 && idx % 2 === 0) {
      const recogItem = pickUniqueTargetFrom(recogLessonStems, 'listen', false);
      if (recogItem) {
        const options = pickDistractorOptions(
          recogItem,
          workingPool,
          sameUnitItems,
          fallbackDistractorPool,
          idx + 1,
          lessonInput.id
        );
        commitExerciseIfUnique({
          id: `${lessonInput.id}-ex${exercises.length + 1}`,
          type: 'listen',
          prompt:
            'What you will HEAR · Listen to the driver and pick the meaning',
          kannada: recogItem.kn.trim(),
          translit: recogItem.kn.trim(),
          meaning: recogItem.en.trim(),
          options,
          answer: recogItem.en.trim(),
          audioText: recogItem.kn.trim(),
          note: lessonInput.note || undefined,
          itemType: recogItem.type,
          itemFlag: recogItem.flag,
        });
        continue;
      }
    }

    // Default: "mcq" (kn -> en), including index 0 when frameHeroItem is present
    const basePool = useDigitDrillForSlot
      ? [...digitItems, ...activeTargetPool]
      : isCheckpoint && conversationalReviewItems.length > 0
      ? conversationalReviewItems
      : activeTargetPool;
    const targetItem = isFirstSlot
      ? frameHeroItem!
      : pickUniqueTargetFrom(basePool, 'mcq', true);

    if (!targetItem) continue;

    const isTargetDigit = /^\d+$/.test(targetItem.en.trim());
    const distractorLessonPool =
      isTargetDigit && digitItems.length >= 4 ? digitItems : workingPool;
    const distractorUnitPool =
      isTargetDigit && digitItems.length >= 4 ? digitItems : sameUnitItems;

    const options = pickDistractorOptions(
      targetItem,
      distractorLessonPool,
      distractorUnitPool,
      fallbackDistractorPool,
      idx + 1,
      lessonInput.id
    );

    const isNeeraHighlight = /\bneera\b/i.test(targetItem.kn);

    commitExerciseIfUnique({
      id: `${lessonInput.id}-ex${exercises.length + 1}`,
      type: 'mcq',
      prompt: isFirstSlot
        ? 'Hero Pattern · What does this mean?'
        : isNeeraHighlight
        ? 'Lookalike Alert (neera = straight, NOT neeru = water) · What does this mean?'
        : isTargetDigit
        ? `Digit Drill · Pick the correct digit for "${targetItem.kn.trim()}"`
        : isContrastDrill
        ? 'Contrast Drill · Pick the exact English meaning'
        : 'Select the correct English meaning',
      kannada: targetItem.kn.trim(),
      translit: targetItem.kn.trim(),
      meaning: targetItem.en.trim(),
      options,
      answer: targetItem.en.trim(),
      audioText: targetItem.kn.trim(),
      isFrameHero: isFirstSlot,
      note: lessonInput.note || undefined,
      itemType: targetItem.type,
      itemFlag: targetItem.flag,
    });
  }

  return exercises;
}

/**
 * Expands a lesson's unique question pool to >= 45 unique exercises across
 * both directions (kn->en and en->kn), listen, speak, translate_bank, and match,
 * sampling across lesson items, unit items, curriculum categories, and the 350+ entry LEXICON.
 */
function buildExpandedLessonQuestionPool(
  coreExercises: Exercise[],
  lessonInput: CurriculumLessonInput,
  currentUnit: CurriculumUnitInput,
  allUnitsUpToCurrent: CurriculumUnitInput[]
): Exercise[] {
  if (coreExercises.some((ex) => Boolean(ex.stageNarration))) {
    return [...coreExercises];
  }

  const speechAvailable =
    typeof window === 'undefined' ? true : isSpeechRecognitionSupported();
  const isRecogOnlyLesson = lessonInput.id === 'u22_l3';

  const pool: Exercise[] = [];
  const seenKeys = new Set<string>();

  const addIfUnique = (ex: Exercise) => {
    const k = canonicalQuestionKey(ex);
    if (!seenKeys.has(k)) {
      seenKeys.add(k);
      pool.push(ex);
    }
  };

  for (const ex of coreExercises) {
    addIfUnique(ex);
  }

  const sameUnitItems = dedupeCurriculumItems(
    currentUnit.lessons
      .flatMap((l) => l.items || [])
      .filter((i) => i.flag !== 'recog')
  );
  const priorUnitsItems = dedupeCurriculumItems(
    allUnitsUpToCurrent
      .flatMap((u) => u.lessons.flatMap((l) => l.items || []))
      .filter((i) => i.flag !== 'recog')
  );
  const candidateItems = dedupeCurriculumItems([
    ...(lessonInput.items || []).filter((i) => i.flag !== 'recog'),
    ...sameUnitItems,
    ...priorUnitsItems,
    ...getDiverseCurriculumItems(),
    ...getDiverseLexiconCurriculumItems().slice(0, 80),
  ]);

  let seq = coreExercises.length + 1;
  for (let i = 0; i < candidateItems.length && pool.length < 52; i++) {
    const item = candidateItems[i];
    if (!item?.kn || !item?.en) continue;

    const optionsMcq = pickDistractorOptions(
      item,
      sameUnitItems,
      priorUnitsItems,
      candidateItems,
      seq,
      lessonInput.id
    );

    // 1. kn -> en (mcq)
    addIfUnique({
      id: `${lessonInput.id}-pool-${seq++}`,
      type: 'mcq',
      prompt: 'Select the correct English meaning',
      kannada: item.kn.trim(),
      translit: item.kn.trim(),
      meaning: item.en.trim(),
      options: optionsMcq,
      answer: item.en.trim(),
      audioText: item.kn.trim(),
      itemType: item.type,
      itemFlag: item.flag,
    });

    if (pool.length >= 52) break;

    const optionsRev = pickDistractorOptions(
      item,
      sameUnitItems,
      priorUnitsItems,
      candidateItems,
      seq,
      lessonInput.id
    );

    // 2. en -> kn (reverse_mcq)
    addIfUnique({
      id: `${lessonInput.id}-pool-${seq++}`,
      type: 'reverse_mcq',
      prompt: 'How do you say this in Kanglish?',
      kannada: item.kn.trim(),
      translit: item.kn.trim(),
      meaning: item.en.trim(),
      options: optionsRev,
      answer: item.kn.trim(),
      audioText: item.kn.trim(),
      itemType: item.type,
      itemFlag: item.flag,
    });

    // 3. Rotate in listen / speak / translate_bank for variety
    if (i % 3 === 0 && pool.length < 52) {
      addIfUnique({
        id: `${lessonInput.id}-pool-${seq++}`,
        type: 'listen',
        prompt: 'Listen and pick the meaning',
        kannada: item.kn.trim(),
        translit: item.kn.trim(),
        meaning: item.en.trim(),
        options: optionsMcq,
        answer: item.en.trim(),
        audioText: item.kn.trim(),
        itemType: item.type,
        itemFlag: item.flag,
      });
    } else if (
      i % 3 === 1 &&
      speechAvailable &&
      !isRecogOnlyLesson &&
      pool.length < 52
    ) {
      addIfUnique({
        id: `${lessonInput.id}-pool-${seq++}`,
        type: 'speak',
        prompt: 'Say this out loud in Kanglish',
        kannada: item.kn.trim(),
        translit: item.kn.trim(),
        meaning: item.en.trim(),
        options: optionsMcq,
        answer: item.kn.trim(),
        audioText: item.kn.trim(),
        itemType: item.type,
        itemFlag: item.flag,
      });
    } else if (
      i % 3 === 2 &&
      item.kn.trim().includes(' ') &&
      item.flag !== 'chunk' &&
      pool.length < 52
    ) {
      const chips = buildWordOrderChips(item, candidateItems, lessonInput.id);
      addIfUnique({
        id: `${lessonInput.id}-pool-${seq++}`,
        type: 'translate_bank',
        prompt: 'Build the Kanglish phrase in order',
        kannada: item.kn.trim(),
        translit: item.kn.trim(),
        meaning: item.en.trim(),
        wordChips: chips,
        answer: item.kn.trim(),
        audioText: item.kn.trim(),
        itemType: item.type,
        itemFlag: item.flag,
      });
    }
  }

  return pool;
}

function hydrateExerciseWithScript(ex: Exercise, seedIdx = 0): Exercise {
  const scriptText =
    getKannadaScriptForText(ex.translit) ||
    getKannadaScriptForText(ex.kannada) ||
    ex.kannada;

  let hydratedOptions = ex.options?.map((opt) => ({
    ...opt,
    kannada: (
      getKannadaScriptForText(opt.translit) ||
      getKannadaScriptForText(opt.kannada) ||
      opt.kannada
    )
      .normalize('NFC')
      .trim(),
    translit: (opt.translit || '').normalize('NFC').trim(),
    meaning: (opt.meaning || '').normalize('NFC').trim(),
  }));

  if (hydratedOptions && hydratedOptions.length > 1) {
    hydratedOptions = sampleUnique(
      hydratedOptions,
      hydratedOptions.length,
      canonicalOptionKey,
      mulberry32(hashStringToSeed(`${ex.id}:${seedIdx}`))
    );
  }

  return {
    ...ex,
    kannada: (scriptText || '').normalize('NFC').trim(),
    audioText: (scriptText || '').normalize('NFC').trim(),
    options: hydratedOptions,
    pairs: ex.pairs?.map((p) => ({
      ...p,
      kannada: (
        getKannadaScriptForText(p.translit) ||
        getKannadaScriptForText(p.kannada) ||
        p.kannada
      )
        .normalize('NFC')
        .trim(),
      translit: (p.translit || '').normalize('NFC').trim(),
      meaning: (p.meaning || '').normalize('NFC').trim(),
    })),
  };
}

// ============================================================================
// 3. CURRICULUM LOADER (transforms CurriculumDataSchema -> Unit[])
// ============================================================================

const UNIT_COLOR_PALETTE: UnitColorKey[] = [
  'blue',
  'cyan',
  'amber',
  'green',
  'error',
];

export function loadCourseUnits(schema: CurriculumDataSchema): Unit[] {
  validateCourseData(schema);

  const phaseById = new Map<number, PhaseDef>();
  for (const p of schema.phases || []) {
    phaseById.set(p.id, p);
  }

  return (schema.units || []).map((unitInput, uIdx) => {
    const unitsUpToCurrent = schema.units.slice(0, uIdx + 1);
    const phaseDef = phaseById.get(unitInput.phase);
    const colorKey: UnitColorKey =
      UNIT_COLOR_PALETTE[uIdx % UNIT_COLOR_PALETTE.length];

    const generatedLessons: Lesson[] = (unitInput.lessons || []).map(
      (lessonInput) => {
        const rawExercises = generateLessonExercises(
          lessonInput,
          unitInput,
          unitsUpToCurrent
        );
        const rawPool = buildExpandedLessonQuestionPool(
          rawExercises,
          lessonInput,
          unitInput,
          unitsUpToCurrent
        );

        const hydratedExercises: Exercise[] = rawExercises.map((ex, idx) =>
          hydrateExerciseWithScript(ex, idx)
        );
        const hydratedPool: Exercise[] = rawPool.map((ex, idx) =>
          hydrateExerciseWithScript(ex, idx + 100)
        );

        return {
          id: lessonInput.id,
          title: lessonInput.title,
          type: lessonInput.type,
          reviewFrom: lessonInput.reviewFrom || [],
          note: lessonInput.note || '',
          items: lessonInput.items || [],
          exercises: hydratedExercises,
          questionPool: hydratedPool,
        };
      }
    );

    // Map each of the 5 lessons in the unit to a sequential node on the unit's ladder
    const levels: Level[] = generatedLessons.map((les, idx) => ({
      id: les.id,
      levelNumber: Math.min(5, Math.max(1, idx + 1)) as 1 | 2 | 3 | 4 | 5,
      name: les.title.toUpperCase(),
      lessons: [les],
    }));

    return {
      id: unitInput.id,
      title: unitInput.title,
      subtitle: phaseDef
        ? `PHASE ${phaseDef.id} · ${phaseDef.name.toUpperCase()} (${phaseDef.cefr})`
        : `PHASE ${unitInput.phase}`,
      emoji: '',
      icon: '',
      phase: unitInput.phase,
      colorKey,
      lessons: generatedLessons,
      levels,
    };
  });
}

export const COURSE_UNITS: Unit[] = loadCourseUnits(RAW_COURSE_DATA);

// ============================================================================
// 4. SEQUENTIAL UNLOCKING & PROGRESSION HELPERS
// ============================================================================

export type LessonNodeState = 'completed' | 'current' | 'preview' | 'locked';

export function isLessonCompleted(
  lessonId: string,
  completedLessons: Record<string, boolean>
): boolean {
  return Boolean(completedLessons[lessonId]);
}

export function isLevelCompleted(
  level: Level,
  completedLessons: Record<string, boolean>
): boolean {
  if (!level || !level.lessons || level.lessons.length === 0) return false;
  return level.lessons.every(
    (les) => Boolean(completedLessons[les.id]) || Boolean(completedLessons[level.id])
  );
}

export function isUnitCompleted(
  unit: Unit,
  completedLessons: Record<string, boolean>
): boolean {
  if (!unit || !unit.levels || unit.levels.length === 0) return false;
  return unit.levels.every((lvl) => isLevelCompleted(lvl, completedLessons));
}

export function isPhaseCompleted(
  phaseOrId: PhaseDef | number,
  units: Unit[],
  completedLessons: Record<string, boolean>
): boolean {
  const phaseDef =
    typeof phaseOrId === 'number'
      ? COURSE_PHASES.find((p) => p.id === phaseOrId)
      : phaseOrId;
  if (!phaseDef) return false;
  const phaseUnits = units.filter(
    (u) => u.phase === phaseDef.id || phaseDef.units.includes(u.id)
  );
  if (phaseUnits.length === 0) return false;
  return phaseUnits.every((u) => isUnitCompleted(u, completedLessons));
}

export function getCompletedLessonCountInLevel(
  level: Level,
  completedLessons: Record<string, boolean>
): number {
  if (!level || !level.lessons) return 0;
  return level.lessons.filter((les) => Boolean(completedLessons[les.id]))
    .length;
}

export function getCompletedLessonCountInUnit(
  unit: Unit,
  completedLessons: Record<string, boolean>
): number {
  if (!unit || !unit.lessons) return 0;
  return unit.lessons.filter((les) => Boolean(completedLessons[les.id])).length;
}

export function getUnitCrowns(
  unit: Unit,
  completedLessons: Record<string, boolean>
): number {
  if (!unit || !unit.levels) return 0;
  return unit.levels.filter((lvl) => isLevelCompleted(lvl, completedLessons))
    .length;
}

export function isUnitLegendary(
  unit: Unit,
  completedLessons: Record<string, boolean>
): boolean {
  return isUnitCompleted(unit, completedLessons);
}

export function isUnitReachedInProgression(
  unitIndex: number,
  units: Unit[],
  completedLessons: Record<string, boolean>
): boolean {
  if (unitIndex <= 0) return true;
  for (let i = 0; i < unitIndex; i++) {
    const priorUnit = units[i];
    if (!priorUnit || !isUnitCompleted(priorUnit, completedLessons)) {
      return false;
    }
  }
  return true;
}

/**
 * SINGLE SOURCE: computes a lesson node's state from progress store state:
 * returns "completed" | "current" | "preview" | "locked"
 *
 * Rules:
 * - completed -> "completed" (playable for replay)
 * - current (next uncompleted lesson in progression) -> "current" (playable)
 * - If demoUnlock === true -> "preview" (everything playable)
 * - L1 (lessonIndex === 0) of ANY unit not yet reached -> "preview" (playable, completing it does NOT unlock L2 of that unit)
 * - EVERYTHING ELSE -> "locked"
 */
export function computeLessonState(
  unitId: string,
  lessonIndex: number,
  units: Unit[],
  completedLessons: Record<string, boolean>,
  demoUnlock: boolean = false
): LessonNodeState {
  const uIdx = units.findIndex((u) => u.id === unitId);
  if (uIdx < 0) return 'locked';
  const unit = units[uIdx];
  const level = unit.levels[lessonIndex];
  if (!level) return 'locked';

  // 1. Completed lessons are always "completed"
  if (isLevelCompleted(level, completedLessons)) {
    return 'completed';
  }

  let allPriorLessonsInUnitDone = true;
  for (let m = 0; m < lessonIndex; m++) {
    if (!isLevelCompleted(unit.levels[m], completedLessons)) {
      allPriorLessonsInUnitDone = false;
      break;
    }
  }

  // 2. Check if this lesson is the "current" lesson in sequential progression
  const unitReached = isUnitReachedInProgression(uIdx, units, completedLessons);
  if (unitReached && allPriorLessonsInUnitDone) {
    return 'current';
  }

  // 3. If the learner has already started this unit (completed L1..L_{k-1} of this unit),
  //    unlock the next sequential lesson in this unit as playable ("preview")
  if (lessonIndex > 0 && allPriorLessonsInUnitDone) {
    return 'preview';
  }

  // 4. If demoUnlock === true -> everything playable
  if (demoUnlock) {
    return 'preview';
  }

  // 5. L1 of ANY unit -> "preview" (playable so learner can start any unit)
  if (lessonIndex === 0) {
    return 'preview';
  }

  // 6. Everything else -> "locked"
  return 'locked';
}

export function isUnitUnlocked(
  unitIndex: number,
  units: Unit[],
  completedLessons: Record<string, boolean>,
  demoUnlock: boolean = false
): { unlocked: boolean; reason: string; isPreview: boolean } {
  if (demoUnlock) {
    return { unlocked: true, reason: '', isPreview: false };
  }
  const reached = isUnitReachedInProgression(unitIndex, units, completedLessons);
  if (reached) {
    return { unlocked: true, reason: '', isPreview: false };
  }
  return { unlocked: true, reason: 'Preview available for Lesson 1', isPreview: true };
}

export function isLevelUnlocked(
  unitIndex: number,
  levelIndex: number,
  units: Unit[],
  completedLessons: Record<string, boolean>,
  demoUnlock: boolean = false
): { unlocked: boolean; reason: string; isPreview: boolean } {
  const unit = units[unitIndex];
  if (!unit) {
    return { unlocked: false, reason: 'Unit not loaded yet', isPreview: false };
  }

  const state = computeLessonState(
    unit.id,
    levelIndex,
    units,
    completedLessons,
    demoUnlock
  );

  if (state === 'locked') {
    const prevUnit = units[unitIndex - 1];
    const prevLevel = unit.levels[levelIndex - 1];
    const reached = isUnitReachedInProgression(unitIndex, units, completedLessons);
    const reason = !reached
      ? `Locked — complete all lessons in ${prevUnit?.title || 'previous unit'} first`
      : `Locked — finish Lesson ${levelIndex} (${prevLevel?.lessons[0]?.title || prevLevel?.name || 'previous lesson'}) first`;
    return {
      unlocked: false,
      reason,
      isPreview: false,
    };
  }

  return {
    unlocked: true,
    reason: '',
    isPreview: state === 'preview' && !demoUnlock,
  };
}

const EMPTY_FALLBACK_LESSON: Lesson = {
  id: 'u1l1',
  title: 'Awaiting Curriculum Pack',
  type: 'normal',
  items: [],
  exercises: [],
};

const EMPTY_FALLBACK_LEVEL: Level = {
  id: 'u1l1',
  levelNumber: 1,
  name: 'FOUNDATION',
  lessons: [EMPTY_FALLBACK_LESSON],
};

const EMPTY_FALLBACK_UNIT: Unit = {
  id: 'u1',
  title: 'Phase 1 · Foundation',
  subtitle: 'PHASE 1 · FOUNDATION (A1)',
  emoji: '',
  icon: '',
  phase: 1,
  colorKey: 'blue',
  lessons: [EMPTY_FALLBACK_LESSON],
  levels: [EMPTY_FALLBACK_LEVEL],
};

export function getCurrentActiveLesson(
  units: Unit[],
  completedLessons: Record<string, boolean>,
  preferredUnitId?: string | null
): {
  unit: Unit;
  level: Level;
  lesson: Lesson;
  lessonIndex: number;
} {
  if (!units || units.length === 0) {
    return {
      unit: EMPTY_FALLBACK_UNIT,
      level: EMPTY_FALLBACK_LEVEL,
      lesson: EMPTY_FALLBACK_LESSON,
      lessonIndex: 0,
    };
  }

  // 1. If the learner was actively working on a specific unit (`preferredUnitId`) and it still
  //    has uncompleted lessons, return the next uncompleted lesson in that unit.
  if (preferredUnitId) {
    const prefUnit = units.find((u) => u.id === preferredUnitId);
    if (prefUnit && !isUnitCompleted(prefUnit, completedLessons)) {
      for (let lIdx = 0; lIdx < prefUnit.levels.length; lIdx++) {
        const level = prefUnit.levels[lIdx];
        if (!isLevelCompleted(level, completedLessons)) {
          const nextLessonIdx = level.lessons.findIndex(
            (les) => !completedLessons[les.id]
          );
          const safeIdx = nextLessonIdx >= 0 ? nextLessonIdx : 0;
          return {
            unit: prefUnit,
            level,
            lesson: level.lessons[safeIdx] || EMPTY_FALLBACK_LESSON,
            lessonIndex: safeIdx,
          };
        }
      }
    }
  }

  // 2. If any unit has been partially completed (1..4 of 5 lessons done), pick the most recently
  //    progressed in-progress unit so its progress bar and next lesson stay in focus.
  for (let uIdx = units.length - 1; uIdx >= 0; uIdx--) {
    const unit = units[uIdx];
    const doneCount = unit.levels.filter((lvl) =>
      isLevelCompleted(lvl, completedLessons)
    ).length;
    if (doneCount > 0 && doneCount < unit.levels.length) {
      for (let lIdx = 0; lIdx < unit.levels.length; lIdx++) {
        const level = unit.levels[lIdx];
        if (!isLevelCompleted(level, completedLessons)) {
          const nextLessonIdx = level.lessons.findIndex(
            (les) => !completedLessons[les.id]
          );
          const safeIdx = nextLessonIdx >= 0 ? nextLessonIdx : 0;
          return {
            unit,
            level,
            lesson: level.lessons[safeIdx] || EMPTY_FALLBACK_LESSON,
            lessonIndex: safeIdx,
          };
        }
      }
    }
  }

  // 3. Otherwise, find the first uncompleted unit in sequential course order.
  for (let uIdx = 0; uIdx < units.length; uIdx++) {
    const unit = units[uIdx];
    for (let lIdx = 0; lIdx < unit.levels.length; lIdx++) {
      const level = unit.levels[lIdx];
      if (!isLevelCompleted(level, completedLessons)) {
        const nextLessonIdx = level.lessons.findIndex(
          (les) => !completedLessons[les.id]
        );
        const safeIdx = nextLessonIdx >= 0 ? nextLessonIdx : 0;
        return {
          unit,
          level,
          lesson: level.lessons[safeIdx] || EMPTY_FALLBACK_LESSON,
          lessonIndex: safeIdx,
        };
      }
    }
  }

  const firstUnit = units[0];
  const firstLevel = firstUnit.levels[0] || EMPTY_FALLBACK_LEVEL;
  return {
    unit: firstUnit,
    level: firstLevel,
    lesson: firstLevel.lessons[0] || EMPTY_FALLBACK_LESSON,
    lessonIndex: 0,
  };
}

export interface FlattenedCoursePhrase {
  id: string;
  kannada: string;
  translit: string;
  meaning: string;
  unitId: string;
  unitEmoji: string;
  unitTitle: string;
  example: string;
}

let cachedFlattenedPhrases: FlattenedCoursePhrase[] | null = null;

/**
 * Flattens all items from loaded COURSE_UNITS into a single searchable Phrasebook array
 * (Kanglish-only — no Kannada script).
 */
export function getAllCoursePhrases(): FlattenedCoursePhrase[] {
  if (cachedFlattenedPhrases && cachedFlattenedPhrases.length > 0) {
    return cachedFlattenedPhrases;
  }

  const list: FlattenedCoursePhrase[] = [];
  const seen = new Set<string>();

  for (const unit of COURSE_UNITS) {
    for (const lesson of unit.lessons) {
      for (const item of lesson.items || []) {
        const kn = item.kn.trim();
        const en = item.en.trim();
        if (!kn || !en) continue;
        const dedupKey = `${unit.id}::${kn.toLowerCase()}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        const script = getKannadaScriptForText(kn) || kn;
        list.push({
          id: `${lesson.id}-${list.length + 1}`,
          kannada: script,
          translit: kn,
          meaning: en,
          unitId: unit.id,
          unitEmoji: unit.emoji,
          unitTitle: unit.title,
          example: `${kn} — "${en}" (${unit.title})`,
        });
      }
    }
  }

  if (list.length > 0) {
    cachedFlattenedPhrases = list;
  }
  return list;
}
