export type Level = 1 | 2 | 3 | 4 | 5;
export type QType =
  | 'kannada_to_english'
  | 'english_to_kannada'
  | 'audio_to_word'
  | 'fill_blank';

export interface Word {
  id: string; // stable, never reused
  kannada: string;
  transliteration: string;
  english: string;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'phrase';
  level: Level;
  lessonId: string;
  exampleSentence?: { kannada: string; english: string };
  allowedTypes: QType[]; // never empty
}

export interface Lesson {
  id: string;
  level: Level;
  order: number; // 1-indexed, contiguous within level
  title: string;
  wordIds: string[]; // 4-8 words, ordered by teaching sequence
  grammarFocus?: string;
  visualTheme: string; // short English scene description for preview image
}

const ALL_QTYPES: QType[] = [
  'english_to_kannada',
  'kannada_to_english',
  'audio_to_word',
  'fill_blank',
];

export const LESSONS: Lesson[] = [
  {
    id: 'u1_l1',
    level: 1,
    order: 1,
    title: 'Warm Greetings & Courtesy',
    wordIds: [
      'w_u1_l1_1',
      'w_u1_l1_2',
      'w_u1_l1_3',
      'w_u1_l1_4',
      'w_u1_l1_5',
      'w_u1_l1_6',
    ],
    grammarFocus: 'Polite conversational openers and everyday responses',
    visualTheme:
      'two friendly neighbors greeting each other with folded hands on a sunny tree-lined Bengaluru street',
  },
  {
    id: 'u1_l2',
    level: 1,
    order: 2,
    title: 'Self Introduction & People',
    wordIds: [
      'w_u1_l2_1',
      'w_u1_l2_2',
      'w_u1_l2_3',
      'w_u1_l2_4',
      'w_u1_l2_5',
    ],
    grammarFocus: 'Core identity nouns for introducing yourself and home',
    visualTheme:
      'two young friends chatting at an outdoor garden cafe table surrounded by potted plants',
  },
  {
    id: 'u1_l3',
    level: 1,
    order: 3,
    title: 'Numbers & Everyday Qualities',
    wordIds: [
      'w_u1_l3_1',
      'w_u1_l3_2',
      'w_u1_l3_3',
      'w_u1_l3_4',
      'w_u1_l3_5',
    ],
    grammarFocus: 'Counting items and describing everyday objects',
    visualTheme:
      'a cheerful fruit vendor arranging ripe yellow mangoes and green coconuts in woven baskets',
  },
  {
    id: 'u1_l4',
    level: 1,
    order: 4,
    title: 'Polite Actions & Requests',
    wordIds: [
      'w_u1_l4_1',
      'w_u1_l4_2',
      'w_u1_l4_3',
      'w_u1_l4_4',
      'w_u1_l4_5',
    ],
    grammarFocus: 'Respectful imperative verbs ending in -i',
    visualTheme:
      'a smiling shopkeeper handing a small parcel across a warm wooden counter',
  },
  {
    id: 'u1_l5',
    level: 1,
    order: 5,
    title: 'Survival Questions & Check-ins',
    wordIds: [
      'w_u1_l5_1',
      'w_u1_l5_2',
      'w_u1_l5_3',
      'w_u1_l5_4',
      'w_u1_l5_5',
    ],
    grammarFocus: 'Checking in and expressing needs in daily conversations',
    visualTheme:
      'two travelers walking along a shaded park pathway with flowering bougainvillea arches',
  },
  {
    id: 'u2_l1',
    level: 2,
    order: 1,
    title: 'Darshini Tiffin & Filter Kaapi',
    wordIds: [
      'w_u2_l1_1',
      'w_u2_l1_2',
      'w_u2_l1_3',
      'w_u2_l1_4',
      'w_u2_l1_5',
    ],
    grammarFocus: 'Ordering food and beverages at a Bengaluru darshini',
    visualTheme:
      'crispy golden masala dosa on a green banana leaf beside a brass tumbler of steaming filter coffee',
  },
  {
    id: 'u2_l2',
    level: 2,
    order: 2,
    title: 'Bazaar Flavors & Bargaining',
    wordIds: [
      'w_u2_l2_1',
      'w_u2_l2_2',
      'w_u2_l2_3',
      'w_u2_l2_4',
      'w_u2_l2_5',
    ],
    grammarFocus: 'Adjectives for taste, temperature, and quantity',
    visualTheme:
      'colorful vegetable baskets and marigold garlands at a lively morning market stall',
  },
  {
    id: 'u3_l1',
    level: 3,
    order: 1,
    title: 'Auto Rickshaw & Street Turns',
    wordIds: [
      'w_u3_l1_1',
      'w_u3_l1_2',
      'w_u3_l1_3',
      'w_u3_l1_4',
      'w_u3_l1_5',
    ],
    grammarFocus: 'Action verbs for guiding an auto rickshaw ride',
    visualTheme:
      'a green and yellow auto rickshaw driving along a sunny tree-lined avenue in Bengaluru',
  },
  {
    id: 'u4_l1',
    level: 4,
    order: 1,
    title: 'Time, Weather & Monsoon Skies',
    wordIds: [
      'w_u4_l1_1',
      'w_u4_l1_2',
      'w_u4_l1_3',
      'w_u4_l1_4',
      'w_u4_l1_5',
    ],
    grammarFocus: 'Talking about times of day and Bengaluru weather',
    visualTheme:
      'gentle evening rain falling over warm glowing streetlights and lush green banyan trees',
  },
  {
    id: 'u5_l1',
    level: 5,
    order: 1,
    title: 'Bengaluru Workplace & Fluency',
    wordIds: [
      'w_u5_l1_1',
      'w_u5_l1_2',
      'w_u5_l1_3',
      'w_u5_l1_4',
      'w_u5_l1_5',
    ],
    grammarFocus: 'Warm collaborative expressions for work and friendships',
    visualTheme:
      'colleagues smiling and conversing on a sunlit rooftop garden overlooking city trees',
  },
];

export const WORDS: Word[] = [
  // =========================================================================
  // LEVEL 1 · LESSON 1 (u1_l1) — Warm Greetings & Courtesy
  // =========================================================================
  {
    id: 'w_u1_l1_1',
    kannada: 'ನಮಸ್ಕಾರ',
    transliteration: 'namaskāra',
    english: 'Hello or Greetings',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l1',
    exampleSentence: {
      kannada: 'ನಮಸ್ಕಾರ, ದಯವಿಟ್ಟು ಒಳಗೆ ಬನ್ನಿ.',
      english: 'Hello, please come inside.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l1_2',
    kannada: 'ಧನ್ಯವಾದ',
    transliteration: 'dhanyavāda',
    english: 'Thank you',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l1',
    exampleSentence: {
      kannada: 'ನಿಮಗೆ ತುಂಬಾ ಧನ್ಯವಾದ.',
      english: 'Thank you very much.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l1_3',
    kannada: 'ದಯವಿಟ್ಟು',
    transliteration: 'dayaviṭṭu',
    english: 'Please',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l1',
    exampleSentence: {
      kannada: 'ದಯವಿಟ್ಟು ಇಲ್ಲಿ ಕುಳಿತುಕೊಳ್ಳಿ.',
      english: 'Please sit down here.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l1_4',
    kannada: 'ಹೌದು',
    transliteration: 'haudu',
    english: 'Yes, that is right',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l1',
    exampleSentence: {
      kannada: 'ಹೌದು, ಇದು ಸರಿಯಾದ ಉತ್ತರ.',
      english: 'Yes, that is right, this is the correct answer.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l1_5',
    kannada: 'ಇಲ್ಲ',
    transliteration: 'illa',
    english: 'No, not at all',
    partOfSpeech: 'phrase',
    level: 1,
    lessonId: 'u1_l1',
    exampleSentence: {
      kannada: 'ಇಲ್ಲ, ಈಗ ಯಾವ ತೊಂದರೆ ಇಲ್ಲ.',
      english: 'No, there is no trouble now.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l1_6',
    kannada: 'ಕ್ಷಮಿಸಿ',
    transliteration: 'kṣamisi',
    english: 'Excuse me or Sorry',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l1',
    exampleSentence: {
      kannada: 'ಕ್ಷಮಿಸಿ, ಒಂದು ಸಣ್ಣ ಪ್ರಶ್ನೆ ಇದೆ.',
      english: 'Excuse me, I have a small question.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 1 · LESSON 2 (u1_l2) — Self Introduction & People (5 nouns)
  // =========================================================================
  {
    id: 'w_u1_l2_1',
    kannada: 'ಹೆಸರು',
    transliteration: 'hesaru',
    english: 'Name',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l2',
    exampleSentence: {
      kannada: 'ನನ್ನ ಹೆಸರು ರಾಜು.',
      english: 'My name is Raju.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l2_2',
    kannada: 'ಊರು',
    transliteration: 'ūru',
    english: 'Hometown or City',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l2',
    exampleSentence: {
      kannada: 'ಬೆಂಗಳೂರು ಒಂದು ಸುಂದರ ಊರು.',
      english: 'Bengaluru is a beautiful city.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l2_3',
    kannada: 'ಸ್ನೇಹಿತ',
    transliteration: 'snēhita',
    english: 'Friend',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l2',
    exampleSentence: {
      kannada: 'ಅವನು ನನ್ನ ಆತ್ಮೀಯ ಸ್ನೇಹಿತ.',
      english: 'He is my close friend.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l2_4',
    kannada: 'ಮನೆ',
    transliteration: 'mane',
    english: 'House or Home',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l2',
    exampleSentence: {
      kannada: 'ಇದು ನಮ್ಮ ಸುಂದರ ಮನೆ.',
      english: 'This is our lovely house.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l2_5',
    kannada: 'ಕೆಲಸ',
    transliteration: 'kelasa',
    english: 'Work or Job',
    partOfSpeech: 'noun',
    level: 1,
    lessonId: 'u1_l2',
    exampleSentence: {
      kannada: 'ನನಗೆ ಇಂದು ಮುಖ್ಯ ಕೆಲಸ ಇದೆ.',
      english: 'I have important work today.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 1 · LESSON 3 (u1_l3) — Numbers & Everyday Qualities (5 adjectives)
  // =========================================================================
  {
    id: 'w_u1_l3_1',
    kannada: 'ಒಂದು',
    transliteration: 'ondu',
    english: 'One',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l3',
    exampleSentence: {
      kannada: 'ಅಲ್ಲಿ ಒಂದು ದೊಡ್ಡ ಮರ ಇದೆ.',
      english: 'There is one big tree over there.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l3_2',
    kannada: 'ಎರಡು',
    transliteration: 'eraḍu',
    english: 'Two',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l3',
    exampleSentence: {
      kannada: 'ನನ್ನ ಬಳಿ ಎರಡು ಪುಸ್ತಕ ಇವೆ.',
      english: 'I have two books with me.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l3_3',
    kannada: 'ಮೂರು',
    transliteration: 'mūru',
    english: 'Three',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l3',
    exampleSentence: {
      kannada: 'ಮೇಜಿನ ಮೇಲೆ ಮೂರು ಹಣ್ಣು ಇವೆ.',
      english: 'There are three fruits on the table.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l3_4',
    kannada: 'ಒಳ್ಳೆಯ',
    transliteration: 'oḷḷeya',
    english: 'Good or Kind',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l3',
    exampleSentence: {
      kannada: 'ಇದು ತುಂಬಾ ಒಳ್ಳೆಯ ಪುಸ್ತಕ.',
      english: 'This is a very good book.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l3_5',
    kannada: 'ಹೊಸ',
    transliteration: 'hosa',
    english: 'New',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l3',
    exampleSentence: {
      kannada: 'ಇದು ನನ್ನ ಹೊಸ ಬ್ಯಾಗ್.',
      english: 'This is my new bag.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 1 · LESSON 4 (u1_l4) — Polite Actions & Requests (5 verbs)
  // =========================================================================
  {
    id: 'w_u1_l4_1',
    kannada: 'ಬನ್ನಿ',
    transliteration: 'banni',
    english: 'Please come',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l4',
    exampleSentence: {
      kannada: 'ಒಳಗೆ ಬನ್ನಿ, ಕುಳಿತುಕೊಳ್ಳಿ.',
      english: 'Please come inside and sit.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l4_2',
    kannada: 'ಹೋಗಿ',
    transliteration: 'hōgi',
    english: 'Please go',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l4',
    exampleSentence: {
      kannada: 'ನೇರವಾಗಿ ಮುಂದೆ ಹೋಗಿ.',
      english: 'Please go straight ahead.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l4_3',
    kannada: 'ಕೊಡಿ',
    transliteration: 'koḍi',
    english: 'Please give',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l4',
    exampleSentence: {
      kannada: 'ನನಗೆ ಒಂದು ಚೀಟಿ ಕೊಡಿ.',
      english: 'Please give me one slip.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l4_4',
    kannada: 'ತಗೊಳ್ಳಿ',
    transliteration: 'tagoḷḷi',
    english: 'Please take',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l4',
    exampleSentence: {
      kannada: 'ನಿಮ್ಮ ಚಿಲ್ಲರೆ ತಗೊಳ್ಳಿ.',
      english: 'Please take your change.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l4_5',
    kannada: 'ಹೇಳಿ',
    transliteration: 'hēḷi',
    english: 'Please tell',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l4',
    exampleSentence: {
      kannada: 'ನಿಮ್ಮ ವಿಳಾಸ ಹೇಳಿ.',
      english: 'Please tell your address.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 1 · LESSON 5 (u1_l5) — Survival Questions & Check-ins
  // =========================================================================
  {
    id: 'w_u1_l5_1',
    kannada: 'ಹೇಗಿದ್ದೀರಾ',
    transliteration: 'hēgiddīrā',
    english: 'How are you?',
    partOfSpeech: 'phrase',
    level: 1,
    lessonId: 'u1_l5',
    exampleSentence: {
      kannada: 'ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಾ?',
      english: 'Hello, how are you?',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l5_2',
    kannada: 'ಚೆನ್ನಾಗಿದ್ದೀನಿ',
    transliteration: 'cennāgiddīni',
    english: 'I am doing well',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l5',
    exampleSentence: {
      kannada: 'ನಾನು ತುಂಬಾ ಚೆನ್ನಾಗಿದ್ದೀನಿ.',
      english: 'I am doing very well.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l5_3',
    kannada: 'ಸಾಕು',
    transliteration: 'sāku',
    english: 'That is enough',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l5',
    exampleSentence: {
      kannada: 'ಇಷ್ಟು ಅನ್ನ ಸಾಕು.',
      english: 'This much rice is enough.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l5_4',
    kannada: 'ಗೊತ್ತಿಲ್ಲ',
    transliteration: 'gottilla',
    english: 'I do not know',
    partOfSpeech: 'verb',
    level: 1,
    lessonId: 'u1_l5',
    exampleSentence: {
      kannada: 'ನನಗೆ ಆ ವಿಳಾಸ ಗೊತ್ತಿಲ್ಲ.',
      english: 'I do not know that address.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u1_l5_5',
    kannada: 'ಸರಿ',
    transliteration: 'sari',
    english: 'Okay or Alright',
    partOfSpeech: 'adjective',
    level: 1,
    lessonId: 'u1_l5',
    exampleSentence: {
      kannada: 'ಸರಿ, ನಾನು ಈಗ ಬರುತ್ತೇನೆ.',
      english: 'Okay, I am coming now.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 2 · LESSON 1 (u2_l1) — Darshini Tiffin & Filter Kaapi (5 nouns)
  // =========================================================================
  {
    id: 'w_u2_l1_1',
    kannada: 'ಕಾಫಿ',
    transliteration: 'kāphi',
    english: 'Filter coffee',
    partOfSpeech: 'noun',
    level: 2,
    lessonId: 'u2_l1',
    exampleSentence: {
      kannada: 'ನನಗೆ ಒಂದು ಲೋಟ ಕಾಫಿ ಕೊಡಿ.',
      english: 'Please give me a cup of filter coffee.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l1_2',
    kannada: 'ನೀರು',
    transliteration: 'nīru',
    english: 'Drinking water',
    partOfSpeech: 'noun',
    level: 2,
    lessonId: 'u2_l1',
    exampleSentence: {
      kannada: 'ಕುಡಿಯಲು ಒಂದು ಲೋಟ ನೀರು ಕೊಡಿ.',
      english: 'Please give a glass of drinking water.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l1_3',
    kannada: 'ದೋಸೆ',
    transliteration: 'dōse',
    english: 'Crispy dosa crepe',
    partOfSpeech: 'noun',
    level: 2,
    lessonId: 'u2_l1',
    exampleSentence: {
      kannada: 'ಮಸಾಲೆ ದೋಸೆ ತುಂಬಾ ರುಚಿಯಾಗಿದೆ.',
      english: 'The masala dosa crepe is very tasty.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l1_4',
    kannada: 'ಊಟ',
    transliteration: 'ūṭa',
    english: 'Full meal or Lunch',
    partOfSpeech: 'noun',
    level: 2,
    lessonId: 'u2_l1',
    exampleSentence: {
      kannada: 'ನಿಮ್ಮ ಮಧ್ಯಾಹ್ನದ ಊಟ ಆಯಿತಾ?',
      english: 'Did you have your afternoon meal?',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l1_5',
    kannada: 'ಹಾಲು',
    transliteration: 'hālu',
    english: 'Fresh milk',
    partOfSpeech: 'noun',
    level: 2,
    lessonId: 'u2_l1',
    exampleSentence: {
      kannada: 'ಮಗುವಿಗೆ ಬೆಚ್ಚಗಿನ ಹಾಲು ಕೊಡಿ.',
      english: 'Give warm milk to the child.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 2 · LESSON 2 (u2_l2) — Bazaar Flavors & Bargaining (5 adjectives)
  // =========================================================================
  {
    id: 'w_u2_l2_1',
    kannada: 'ಬಿಸಿ',
    transliteration: 'bisi',
    english: 'Hot or Warm',
    partOfSpeech: 'adjective',
    level: 2,
    lessonId: 'u2_l2',
    exampleSentence: {
      kannada: 'ಈ ಸೂಪ್ ತುಂಬಾ ಬಿಸಿ ಇದೆ.',
      english: 'This soup is very hot.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l2_2',
    kannada: 'ಸಿಹಿ',
    transliteration: 'sihi',
    english: 'Sweet',
    partOfSpeech: 'adjective',
    level: 2,
    lessonId: 'u2_l2',
    exampleSentence: {
      kannada: 'ಮಾವಿನ ಹಣ್ಣು ತುಂಬಾ ಸಿಹಿ ಇದೆ.',
      english: 'The mango fruit is very sweet.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l2_3',
    kannada: 'ಖಾರ',
    transliteration: 'khāra',
    english: 'Spicy',
    partOfSpeech: 'adjective',
    level: 2,
    lessonId: 'u2_l2',
    exampleSentence: {
      kannada: 'ಈ ಚಟ್ನಿ ಸ್ವಲ್ಪ ಖಾರ ಇದೆ.',
      english: 'This chutney is a little spicy.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l2_4',
    kannada: 'ಕಮ್ಮಿ',
    transliteration: 'kammi',
    english: 'Less or Lower',
    partOfSpeech: 'adjective',
    level: 2,
    lessonId: 'u2_l2',
    exampleSentence: {
      kannada: 'ದಯವಿಟ್ಟು ಬೆಲೆ ಕಮ್ಮಿ ಮಾಡಿ.',
      english: 'Please make the price lower.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u2_l2_5',
    kannada: 'ತಾಜಾ',
    transliteration: 'tājā',
    english: 'Fresh',
    partOfSpeech: 'adjective',
    level: 2,
    lessonId: 'u2_l2',
    exampleSentence: {
      kannada: 'ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ತಾಜಾ ತರಕಾರಿ ಇದೆ.',
      english: 'There are fresh vegetables in the market.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 3 · LESSON 1 (u3_l1) — Auto Rickshaw & Street Turns (5 verbs)
  // =========================================================================
  {
    id: 'w_u3_l1_1',
    kannada: 'ನಿಲ್ಲಿಸಿ',
    transliteration: 'nillisi',
    english: 'Please stop here',
    partOfSpeech: 'verb',
    level: 3,
    lessonId: 'u3_l1',
    exampleSentence: {
      kannada: 'ಅಣ್ಣ, ಗೇಟ್ ಬಳಿ ನಿಲ್ಲಿಸಿ.',
      english: 'Brother, please stop by the gate.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u3_l1_2',
    kannada: 'ತಿರುಗಿ',
    transliteration: 'tirugi',
    english: 'Please turn',
    partOfSpeech: 'verb',
    level: 3,
    lessonId: 'u3_l1',
    exampleSentence: {
      kannada: 'ಮುಂದಿನ ಸಿಗ್ನಲ್ ಬಳಿ ಎಡಕ್ಕೆ ತಿರುಗಿ.',
      english: 'Please turn left by the next signal.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u3_l1_3',
    kannada: 'ನೋಡಿ',
    transliteration: 'nōḍi',
    english: 'Please look',
    partOfSpeech: 'verb',
    level: 3,
    lessonId: 'u3_l1',
    exampleSentence: {
      kannada: 'ಮ್ಯಾಪ್ ಒಮ್ಮೆ ನೋಡಿ.',
      english: 'Please look at the map once.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u3_l1_4',
    kannada: 'ಕಾಯಿರಿ',
    transliteration: 'kāyiri',
    english: 'Please wait',
    partOfSpeech: 'verb',
    level: 3,
    lessonId: 'u3_l1',
    exampleSentence: {
      kannada: 'ಎರಡು ನಿಮಿಷ ಇಲ್ಲಿ ಕಾಯಿರಿ.',
      english: 'Please wait here for two minutes.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u3_l1_5',
    kannada: 'ಇಳಿಯಿರಿ',
    transliteration: 'iḷiyiri',
    english: 'Please step down',
    partOfSpeech: 'verb',
    level: 3,
    lessonId: 'u3_l1',
    exampleSentence: {
      kannada: 'ನಿಲ್ದಾಣ ಬಂತು, ನಿಧಾನವಾಗಿ ಇಳಿಯಿರಿ.',
      english: 'The station has arrived, please step down slowly.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 4 · LESSON 1 (u4_l1) — Time, Weather & Monsoon Skies (5 nouns)
  // =========================================================================
  {
    id: 'w_u4_l1_1',
    kannada: 'ಮಳೆ',
    transliteration: 'maḷe',
    english: 'Rain',
    partOfSpeech: 'noun',
    level: 4,
    lessonId: 'u4_l1',
    exampleSentence: {
      kannada: 'ಇಂದು ಜೋರು ಮಳೆ ಬರುತ್ತಿದೆ.',
      english: 'Heavy rain is falling today.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u4_l1_2',
    kannada: 'ಸಮಯ',
    transliteration: 'samaya',
    english: 'Time',
    partOfSpeech: 'noun',
    level: 4,
    lessonId: 'u4_l1',
    exampleSentence: {
      kannada: 'ಈಗ ಸರಿಯಾದ ಸಮಯ ಆಗಿದೆ.',
      english: 'Now it is the right time.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u4_l1_3',
    kannada: 'ಬೆಳಗ್ಗೆ',
    transliteration: 'beḷagge',
    english: 'Morning',
    partOfSpeech: 'noun',
    level: 4,
    lessonId: 'u4_l1',
    exampleSentence: {
      kannada: 'ಬೆಳಗ್ಗೆ ಬೇಗ ಎದ್ದೇಳಿ.',
      english: 'Wake up early in the morning.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u4_l1_4',
    kannada: 'ಸಂಜೆ',
    transliteration: 'sanje',
    english: 'Evening',
    partOfSpeech: 'noun',
    level: 4,
    lessonId: 'u4_l1',
    exampleSentence: {
      kannada: 'ಸಂಜೆ ಪಾರ್ಕ್ ಬಳಿ ನಡೆಯೋಣ.',
      english: 'Let us walk near the park in the evening.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u4_l1_5',
    kannada: 'ನಾಳೆ',
    transliteration: 'nāḷe',
    english: 'Tomorrow',
    partOfSpeech: 'noun',
    level: 4,
    lessonId: 'u4_l1',
    exampleSentence: {
      kannada: 'ನಾಳೆ ನಾವು ಮೈಸೂರಿಗೆ ಹೋಗುತ್ತೇವೆ.',
      english: 'Tomorrow we are going to Mysuru.',
    },
    allowedTypes: ALL_QTYPES,
  },

  // =========================================================================
  // LEVEL 5 · LESSON 1 (u5_l1) — Bengaluru Workplace & Fluency
  // =========================================================================
  {
    id: 'w_u5_l1_1',
    kannada: 'ಸುಲಭ',
    transliteration: 'sulabha',
    english: 'Easy or Simple',
    partOfSpeech: 'adjective',
    level: 5,
    lessonId: 'u5_l1',
    exampleSentence: {
      kannada: 'ಪ್ರತಿದಿನ ಅಭ್ಯಾಸ ಮಾಡಿದರೆ ಕನ್ನಡ ಸುಲಭ.',
      english: 'If you practice every day, Kannada is easy.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u5_l1_2',
    kannada: 'ಇಷ್ಟ',
    transliteration: 'iṣṭa',
    english: 'Liked or Favorite',
    partOfSpeech: 'adjective',
    level: 5,
    lessonId: 'u5_l1',
    exampleSentence: {
      kannada: 'ನನಗೆ ಬೆಂಗಳೂರು ಹವಾಮಾನ ತುಂಬಾ ಇಷ್ಟ.',
      english: 'I like the Bengaluru weather very much.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u5_l1_3',
    kannada: 'ಮತ್ತೆ ಸಿಗೋಣ',
    transliteration: 'matte sigōṇa',
    english: 'Let us meet again',
    partOfSpeech: 'phrase',
    level: 5,
    lessonId: 'u5_l1',
    exampleSentence: {
      kannada: 'ಮುಂದಿನ ವಾರ ಮತ್ತೆ ಸಿಗೋಣ.',
      english: 'Let us meet again next week.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u5_l1_4',
    kannada: 'ಶುಭ ದಿನ',
    transliteration: 'śubha dina',
    english: 'Have a wonderful day',
    partOfSpeech: 'noun',
    level: 5,
    lessonId: 'u5_l1',
    exampleSentence: {
      kannada: 'ನಿಮಗೆಲ್ಲರಿಗೂ ಶುಭ ದಿನ.',
      english: 'Have a wonderful day to you all.',
    },
    allowedTypes: ALL_QTYPES,
  },
  {
    id: 'w_u5_l1_5',
    kannada: 'ಸಹಾಯ ಮಾಡಿ',
    transliteration: 'sahāya māḍi',
    english: 'Please help me',
    partOfSpeech: 'verb',
    level: 5,
    lessonId: 'u5_l1',
    exampleSentence: {
      kannada: 'ದಯವಿಟ್ಟು ನನಗೆ ಸ್ವಲ್ಪ ಸಹಾಯ ಮಾಡಿ.',
      english: 'Please help me a little bit.',
    },
    allowedTypes: ALL_QTYPES,
  },
];

const LESSON_MAP = new Map<string, Lesson>(LESSONS.map((l) => [l.id, l]));
const WORD_MAP = new Map<string, Word>(WORDS.map((w) => [w.id, w]));

const LESSON_ALIASES: Record<string, string> = {
  '1': 'u1_l1',
  l1: 'u1_l1',
  'lesson-1': 'u1_l1',
  lesson_1: 'u1_l1',
  u1l1: 'u1_l1',
  '2': 'u1_l2',
  l2: 'u1_l2',
  'lesson-2': 'u1_l2',
  lesson_2: 'u1_l2',
  u1l2: 'u1_l2',
  '3': 'u1_l3',
  l3: 'u1_l3',
  'lesson-3': 'u1_l3',
  lesson_3: 'u1_l3',
  u1l3: 'u1_l3',
  '4': 'u1_l4',
  l4: 'u1_l4',
  'lesson-4': 'u1_l4',
  lesson_4: 'u1_l4',
  u1l4: 'u1_l4',
  '5': 'u1_l5',
  l5: 'u1_l5',
  'lesson-5': 'u1_l5',
  lesson_5: 'u1_l5',
  u1l5: 'u1_l5',
  '6': 'u2_l1',
  l6: 'u2_l1',
  'lesson-6': 'u2_l1',
  u2l1: 'u2_l1',
  '7': 'u2_l2',
  l7: 'u2_l2',
  'lesson-7': 'u2_l2',
  u2l2: 'u2_l2',
  '8': 'u3_l1',
  l8: 'u3_l1',
  'lesson-8': 'u3_l1',
  u3l1: 'u3_l1',
  '9': 'u4_l1',
  l9: 'u4_l1',
  'lesson-9': 'u4_l1',
  u4l1: 'u4_l1',
  '10': 'u5_l1',
  l10: 'u5_l1',
  'lesson-10': 'u5_l1',
  u5l1: 'u5_l1',
};

export function resolveLessonId(rawLessonId: string): string {
  const clean = (rawLessonId || '').trim().toLowerCase();
  if (LESSON_MAP.has(clean)) return clean;
  if (LESSON_ALIASES[clean]) return LESSON_ALIASES[clean];

  // Map legacy u{unit}_l{lesson} IDs from the 30-unit path to the 10 canonical curriculum lessons
  const match = clean.match(/^u(\d+)_?l(\d+)$/);
  if (match) {
    const unitNum = parseInt(match[1], 10);
    const lesNum = parseInt(match[2], 10);
    if (unitNum === 1 && lesNum >= 1 && lesNum <= 5) {
      return `u1_l${lesNum}`;
    }
    if (unitNum === 2) {
      return lesNum % 2 === 1 ? 'u2_l1' : 'u2_l2';
    }
    if (unitNum === 3) {
      return 'u3_l1';
    }
    if (unitNum === 4) {
      return 'u4_l1';
    }
    if (unitNum >= 5) {
      const idx = (unitNum + lesNum) % LESSONS.length;
      return LESSONS[idx].id;
    }
  }

  throw new Error(`Unknown lessonId: "${rawLessonId}"`);
}

export function getLesson(lessonId: string): Lesson {
  const canonicalId = resolveLessonId(lessonId);
  const found = LESSON_MAP.get(canonicalId);
  if (!found) {
    throw new Error(`Lesson not found for id "${lessonId}"`);
  }
  return found;
}

export function getWord(wordId: string): Word {
  const found = WORD_MAP.get(wordId);
  if (!found) {
    throw new Error(`Word not found for id "${wordId}"`);
  }
  return found;
}

export function getLessonWords(lessonId: string): Word[] {
  const lesson = getLesson(lessonId);
  return lesson.wordIds.map((id) => getWord(id));
}

export function getUnlockedLessons(lesson: Lesson): Lesson[] {
  return LESSONS.filter(
    (l) =>
      l.level < lesson.level ||
      (l.level === lesson.level && l.order <= lesson.order)
  );
}

export function getTaughtPool(lesson: Lesson): Word[] {
  const unlockedIds = new Set(getUnlockedLessons(lesson).map((l) => l.id));
  return WORDS.filter((w) => unlockedIds.has(w.lessonId));
}
