import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { motion } from 'motion/react';
import { Flame } from './Flame';
import {
  SITUATIONS,
  Situation,
  playTactileTone,
} from './kanglishData';
import { LandingPage } from './LandingPage';
import { OnboardingFlow } from './OnboardingFlow';
import { OnboardingGate } from './OnboardingGate';
import { HomeDashboard } from './HomeDashboard';
import { LessonAndSpeakScreen } from './LessonAndSpeakScreen';
import { RoleplayScreen } from './RoleplayScreen';
import { ExploreAndPhrasebookScreen } from './ExploreAndPhrasebookScreen';
import {
  ProgressScreen,
  ProfileScreen,
} from './ProgressAndProfileScreens';
import { LessonSessionEngine } from './LessonSessionEngine';
import { TalkToAnnaModal } from './TalkToAnnaModal';
import { AppDock } from './AppDock';
import { CityReaderSheet } from './CityReaderSheet';
import { useProgress } from './progressStore';
import {
  COURSE_UNITS,
  computeLessonState,
} from './courseData';
import {
  getOnboarding,
  completeOnboarding,
} from './onboarding';

interface LessonRouteParams {
  unitId: string;
  levelId: string;
  lessonIndex: number;
  lessonId?: string;
}

function parseLessonRoute(pathname: string): LessonRouteParams | null {
  const exerciseMatch = pathname.match(
    /^\/exercise\/([^/]+)(?:\/preview)?\/?$/
  );
  if (exerciseMatch) {
    const rawLessonId = decodeURIComponent(exerciseMatch[1]);
    return {
      unitId: 'u1',
      levelId: rawLessonId,
      lessonIndex: 0,
      lessonId: rawLessonId,
    };
  }

  const match = pathname.match(/^\/lesson\/([^/]+)\/([^/]+)\/(\d+)\/?$/);
  if (!match) return null;
  return {
    unitId: decodeURIComponent(match[1]),
    levelId: decodeURIComponent(match[2]),
    lessonIndex: Math.max(0, parseInt(match[3], 10) || 0),
  };
}

type ViewMode = 'landing' | 'onboarding' | 'app';
type AppTab =
  | 'home'
  | 'situations'
  | 'explore'
  | 'practice'
  | 'roleplay'
  | 'progress'
  | 'achievements'
  | 'profile';

interface PersistedState {
  userName: string;
  userEmail: string;
  streak: number;
  totalXp: number;
  lessonsCompleted: number;
  phrasesLearned: number;
  dailyGoalWords: number;
  todayWordsLearned: number;
  activeSituationId: string;
  savedPhraseIds: string[];
  situationProgress: Record<string, number>;
  completedCurriculumLessons: Record<string, boolean>;
}

const STORAGE_KEY = 'kanglish_bengaluru_state_v2';

// Ensure splash screen shows ONLY once on cold app start — never on tab switches or back navigation
let hasShownColdSplashInSession = false;

const DEFAULT_STATE: PersistedState = {
  userName: 'Alex Johnson',
  userEmail: 'alex@bengaluru.in',
  streak: 12,
  totalXp: 350,
  lessonsCompleted: 12,
  phrasesLearned: 86,
  dailyGoalWords: 20,
  todayWordsLearned: 12,
  activeSituationId: 'auto-ride',
  savedPhraseIds: ['auto-1', 'auto-2', 'food-1', 'mkt-2'],
  situationProgress: {
    'auto-ride': 65,
    'darshini-food': 40,
    'pg-landlord': 25,
    'market-bargain': 50,
    'office-chai': 50,
    'doctor-visit': 20,
  },
  completedCurriculumLessons: {},
};

function AppShell() {
  const progress = useProgress();

  const [appState, setAppState] = useState<PersistedState>(() => {
    const onboarded = getOnboarding();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          userName: parsed.userName || onboarded?.name || DEFAULT_STATE.userName,
        };
      }
    } catch {
      // Fallback to default state
    }
    if (onboarded?.name) {
      return {
        ...DEFAULT_STATE,
        userName: onboarded.name,
        dailyGoalWords: (Number(onboarded.minutes) || 5) * 2,
      };
    }
    return DEFAULT_STATE;
  });

  const [viewMode, setViewMode] = useState<ViewMode>('app');
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (typeof window === 'undefined') return 'home';
    const p = window.location.pathname.toLowerCase();
    if (p.startsWith('/practice')) return 'practice';
    if (p.startsWith('/explore')) return 'explore';
    if (p.startsWith('/profile')) return 'profile';
    if (p.startsWith('/progress')) return 'progress';
    return 'home';
  });
  const [isTalkToAnnaOpen, setIsTalkToAnnaOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    window.location.pathname.toLowerCase().startsWith('/anna')
  );
  const [isCityReaderOpen, setIsCityReaderOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    window.location.pathname.toLowerCase().startsWith('/reader')
  );
  const [lessonMode, setLessonMode] = useState<
    'lesson' | 'speak' | 'flashcards'
  >('lesson');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lessonRoute, setLessonRoute] = useState<LessonRouteParams | null>(() =>
    typeof window !== 'undefined'
      ? parseLessonRoute(window.location.pathname)
      : null
  );

  const navigateToTab = (tab: AppTab) => {
    playTactileTone('tap');
    setIsCityReaderOpen(false);
    setActiveTab(tab);
    try {
      if (!window.location.pathname.startsWith('/lesson/')) {
        const nextUrl = tab === 'home' ? '/' : `/${tab}`;
        window.history.pushState({}, '', nextUrl);
      }
    } catch {
      // Ignore history restriction in sandboxed environments
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCityReader = () => {
    playTactileTone('tap');
    setIsCityReaderOpen(true);
    try {
      if (!window.location.pathname.toLowerCase().startsWith('/reader')) {
        window.history.pushState({}, '', '/reader');
      }
    } catch {
      // Ignore history restriction in sandboxed environments
    }
  };

  const closeCityReader = () => {
    setIsCityReaderOpen(false);
    try {
      if (window.location.pathname.toLowerCase().startsWith('/reader')) {
        const nextUrl = activeTab === 'home' ? '/' : `/${activeTab}`;
        window.history.pushState({}, '', nextUrl);
      }
    } catch {
      // Ignore history restriction in sandboxed environments
    }
  };

  // Cold-start splash screen state ('visible' for 1.2s -> 'fading' for 250ms crossfade -> 'hidden')
  const [splashPhase, setSplashPhase] = useState<'visible' | 'fading' | 'hidden'>(() => {
    if (hasShownColdSplashInSession) return 'hidden';
    return 'visible';
  });

  useEffect(() => {
    if (hasShownColdSplashInSession || splashPhase === 'hidden') return;
    hasShownColdSplashInSession = true;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const cutTimer = window.setTimeout(() => {
        setSplashPhase('hidden');
      }, 1200);
      return () => window.clearTimeout(cutTimer);
    }

    const fadeTimer = window.setTimeout(() => {
      setSplashPhase('fading');
    }, 1200);

    const hideTimer = window.setTimeout(() => {
      setSplashPhase('hidden');
    }, 1450);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  // Sync browser back/forward navigation with /lesson/:unitId/:levelId/:lessonIndex and top-level tab paths
  useEffect(() => {
    const handleOpenAnna = () => {
      playTactileTone('tap');
      setIsTalkToAnnaOpen(true);
    };
    const handleOpenReader = () => {
      openCityReader();
    };
    const handlePopState = () => {
      const lesson = parseLessonRoute(window.location.pathname);
      setLessonRoute(lesson);
      if (!lesson) {
        const p = window.location.pathname.toLowerCase();
        if (p.startsWith('/anna')) {
          setIsTalkToAnnaOpen(true);
          return;
        }
        if (p.startsWith('/reader')) {
          setIsCityReaderOpen(true);
          return;
        }
        setIsCityReaderOpen(false);
        if (p.startsWith('/practice')) setActiveTab('practice');
        else if (p.startsWith('/explore')) setActiveTab('explore');
        else if (p.startsWith('/profile')) setActiveTab('profile');
        else if (p.startsWith('/progress')) setActiveTab('progress');
        else setActiveTab('home');
      }
    };
    const handleOnboardingSync = () => {
      const data = getOnboarding();
      if (data?.name) {
        const minutesNum = Number(data.minutes) || 5;
        setAppState((prev) => ({
          ...prev,
          userName: data.name,
          dailyGoalWords: minutesNum * 2,
        }));
      }
    };
    window.addEventListener('kaliyona:open-anna', handleOpenAnna);
    window.addEventListener('kaliyona:open-reader', handleOpenReader);
    window.addEventListener('kaliyona:onboarding', handleOnboardingSync);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('kaliyona:open-anna', handleOpenAnna);
      window.removeEventListener('kaliyona:open-reader', handleOpenReader);
      window.removeEventListener('kaliyona:onboarding', handleOnboardingSync);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateToLessonRoute = (
    unitId: string,
    levelId: string,
    lessonIndex: number
  ) => {
    const unit = COURSE_UNITS.find((u) => u.id === unitId);
    const levelIdx = unit
      ? unit.levels.findIndex((l) => l.id === levelId)
      : -1;
    if (levelIdx >= 0) {
      const combinedDone = {
        ...(appState.completedCurriculumLessons || {}),
        ...progress.completedLessonsMap,
      };
      const nodeState = computeLessonState(
        unitId,
        levelIdx,
        COURSE_UNITS,
        combinedDone,
        progress.demoUnlock
      );
      if (nodeState === 'locked') {
        playTactileTone('error');
        return;
      }
    }

    const nextPath = `/lesson/${encodeURIComponent(unitId)}/${encodeURIComponent(
      levelId
    )}/${lessonIndex}`;
    try {
      window.history.pushState({}, '', nextPath);
    } catch {
      // Ignore history pushState restriction in sandboxed environments
    }
    setLessonRoute({ unitId, levelId, lessonIndex });
  };

  const exitLessonRoute = () => {
    try {
      if (
        window.location.pathname.startsWith('/lesson/') ||
        window.location.pathname.startsWith('/exercise/')
      ) {
        window.history.pushState({}, '', '/');
      }
    } catch {
      // Ignore history restriction
    }
    setLessonRoute(null);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {
      // Ignore storage quota issues
    }
  }, [appState]);

  // Combined curriculum completion map (persisted in kanglish-progress-v1 + legacy fallback)
  const mergedCompletedLessons = {
    ...(appState.completedCurriculumLessons || {}),
    ...progress.completedLessonsMap,
  };

  const hydratedSituations: Situation[] = SITUATIONS.map((sit) => {
    const pct =
      appState.situationProgress[sit.id] !== undefined
        ? appState.situationProgress[sit.id]
        : sit.progressPercent;
    return {
      ...sit,
      progressPercent: pct,
      completedPhrases: Math.round((pct / 100) * sit.totalPhrases),
    };
  });

  const activeSituation =
    hydratedSituations.find((s) => s.id === appState.activeSituationId) ||
    hydratedSituations[0];

  const handleStartSituationLesson = (
    situationId: string,
    mode: 'lesson' | 'speak' | 'flashcards' = 'lesson'
  ) => {
    playTactileTone('tap');
    setAppState((prev) => ({
      ...prev,
      activeSituationId: situationId,
    }));
    setLessonMode(mode);
    setViewMode('app');
    setActiveTab('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompleteLesson = (
    situationId: string,
    earnedXp: number,
    phrasesCount: number
  ) => {
    progress.addXP(earnedXp);
    setAppState((prev) => {
      const currentPct = prev.situationProgress[situationId] ?? 50;
      const nextPct = Math.min(100, currentPct + 20);
      return {
        ...prev,
        totalXp: prev.totalXp + earnedXp,
        lessonsCompleted: prev.lessonsCompleted + 1,
        phrasesLearned: prev.phrasesLearned + phrasesCount,
        todayWordsLearned: Math.min(
          prev.dailyGoalWords,
          prev.todayWordsLearned + phrasesCount
        ),
        situationProgress: {
          ...prev.situationProgress,
          [situationId]: nextPct,
        },
      };
    });
    setActiveTab('home');
  };

  const handleCompleteCurriculumLesson = (
    unitId: string,
    levelId: string,
    lessonId: string,
    earnedXp: number
  ) => {
    progress.completeLesson(unitId, levelId, lessonId, earnedXp, 100);
    setAppState((prev) => ({
      ...prev,
      totalXp: prev.totalXp + earnedXp,
      lessonsCompleted: prev.lessonsCompleted + 1,
      phrasesLearned: prev.phrasesLearned + 6,
      todayWordsLearned: Math.min(
        prev.dailyGoalWords,
        prev.todayWordsLearned + 4
      ),
      completedCurriculumLessons: {
        ...prev.completedCurriculumLessons,
        [lessonId]: true,
      },
    }));
  };

  const handleToggleSavePhrase = (phraseId: string) => {
    setAppState((prev) => {
      const exists = prev.savedPhraseIds.includes(phraseId);
      return {
        ...prev,
        savedPhraseIds: exists
          ? prev.savedPhraseIds.filter((id) => id !== phraseId)
          : [...prev.savedPhraseIds, phraseId],
      };
    });
  };

  // 1. LANDING PAGE VIEW
  if (viewMode === 'landing') {
    return (
      <LandingPage
        streak={progress.streak}
        onStartOnboarding={() => {
          playTactileTone('tap');
          setViewMode('onboarding');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onEnterApp={(initialTab, situationId) => {
          playTactileTone('tap');
          if (situationId) {
            setAppState((p) => ({ ...p, activeSituationId: situationId }));
          }
          setViewMode('app');
          setActiveTab((initialTab as AppTab) || 'home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onTryLesson={(situationId) => {
          handleStartSituationLesson(situationId || 'auto-ride', 'lesson');
        }}
      />
    );
  }

  // 2. ONBOARDING VIEW
  if (viewMode === 'onboarding') {
    return (
      <OnboardingFlow
        onDone={() => {
          const data = getOnboarding();
          const minutesNum = Number(data?.minutes) || 5;
          setAppState((prev) => ({
            ...prev,
            userName: data?.name || prev.userName,
            dailyGoalWords: minutesNum * 2,
            activeSituationId: 'auto-ride',
          }));
          setLessonMode('speak');
          setViewMode('app');
          setActiveTab('practice');
        }}
      />
    );
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-surface text-on-surface flex flex-col">
      {/* Static decorative ambient blobs for glassmorphism depth */}
      <div aria-hidden="true" className="app-glass-canvas-bg" />

      {/* ================================================================= */}
      {/* COLD-START SPLASH / LAUNCH SCREEN (1.2s + 250ms crossfade)        */}
      {/* ================================================================= */}
      {splashPhase !== 'hidden' && (
        <div
          data-splash-screen="kaliyona"
          aria-label="Kaliyona launch screen"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, #8273f7 0%, #6c5ce7 48%, #4d3cc2 100%)',
            opacity: splashPhase === 'fading' ? 0 : 1,
            transition: 'opacity 250ms ease-out',
          }}
          className="kaliyona-splash-screen fixed inset-0 z-50 flex flex-col items-center justify-center px-6 select-none pointer-events-none overflow-hidden"
        >
          {/* Ambient pulsing halo rings behind the logo */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.85, 1.22, 1.08], opacity: [0, 0.32, 0.18] }}
            transition={{ duration: 1.15, ease: 'easeOut' }}
            className="absolute w-72 h-72 rounded-full border-2 border-white/25 bg-white/5 pointer-events-none"
          />
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.6, 1.45], opacity: [0.35, 0] }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute w-80 h-80 rounded-full border border-amber-300/40 pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center text-center gap-3.5">
            {/* Animated Kannada script pill */}
            <motion.span
              initial={{ y: -14, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 20,
                delay: 0.08,
              }}
              className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-amber-200 font-bold text-xs tracking-wider shadow-xs"
            >
              ಕಲಿಯೋಣ · Let&apos;s Learn
            </motion.span>

            {/* Main Kaliyona Logo with springy pop-in + playful tilt */}
            <motion.div
              initial={{ scale: 0.55, opacity: 0, rotate: -8, y: 18 }}
              animate={{
                scale: [0.55, 1.08, 1],
                opacity: 1,
                rotate: [-8, 3, 0],
                y: [18, -4, 0],
              }}
              transition={{
                duration: 0.72,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex items-center justify-center"
            >
              <img
                src="/logo-full.webp"
                alt="Kaliyona"
                width={190}
                loading="eager"
                draggable={false}
                className="w-[190px] h-auto object-contain block drop-shadow-[0_10px_24px_rgba(20,12,64,0.35)]"
              />
            </motion.div>

            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' }}
              className="text-white/90 font-caption tracking-wide text-sm"
            >
              Kannada, the Bengaluru way
            </motion.p>

            {/* Startup progress shimmer bar */}
            <div className="w-36 h-1.5 rounded-full bg-white/20 overflow-hidden mt-1">
              <motion.div
                initial={{ width: '12%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.05, ease: 'easeInOut' }}
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-white to-amber-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* FIXED HEADER: logo, streak flame, avatar                          */}
      {/* ================================================================= */}
      <header className="glass-strong !rounded-none !border-x-0 !border-t-0 fixed top-0 left-0 right-0 w-full max-w-full z-30 h-16 box-border">
        <div className="w-full max-w-3xl h-full mx-auto px-4 flex items-center justify-between gap-2">
          {/* Left: Animated Logo Icon (28px) + Kaliyona Wordmark */}
          <motion.button
            type="button"
            onClick={() => navigateToTab('home')}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="group flex items-center gap-2 sm:gap-2.5 cursor-pointer text-left min-w-0 touch-manipulation"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -18 }}
              animate={{ scale: [0.5, 1.16, 1], rotate: [-18, 8, 0] }}
              transition={{
                duration: 0.65,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex items-center justify-center shrink-0"
            >
              <img
                src="/logo-icon.webp"
                alt=""
                width={28}
                height={28}
                loading="eager"
                draggable={false}
                className="w-7 h-7 object-contain shrink-0 block transition-transform duration-300 group-hover:rotate-6"
              />
            </motion.div>
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.22 }}
              className="font-headline-md text-on-surface text-base sm:text-lg truncate"
            >
              Kaliyona
            </motion.span>
          </motion.button>

          {/* Right: Streak Flame, Avatar */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Streak Flame */}
            <button
              type="button"
              onClick={() => navigateToTab('progress')}
              aria-label={`${progress.streak} day streak`}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300/80 text-amber-800 font-label-bold text-xs cursor-pointer shadow-[0_2px_0_0_#fde68a] active:translate-y-[1px] active:shadow-none transition-all shrink-0 tabular-nums touch-manipulation"
            >
              <Flame size={15} animated={false} />
              <span>{progress.streak}</span>
            </button>

            {/* Avatar */}
            <button
              type="button"
              onClick={() => navigateToTab('profile')}
              aria-label="Open profile"
              className="w-10 h-10 rounded-full bg-primary-fixed border border-primary-fixed-dim flex items-center justify-center overflow-hidden cursor-pointer shrink-0 text-primary touch-manipulation"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN PAGE CONTENT AREA                                            */}
      {/* ================================================================= */}
      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-4 pt-20 mobile-shell-content mobile-shell-content--desktop-unchanged overflow-x-hidden">
        {activeTab === 'home' && (
          <HomeDashboard
            userName={appState.userName}
            situations={hydratedSituations}
            activeSituationId={appState.activeSituationId}
            streak={progress.streak}
            totalXp={progress.xp}
            phrasesLearned={
              appState.phrasesLearned +
              Object.keys(progress.completedLessonsMap).length * 4
            }
            dailyGoalWords={progress.dailyGoal}
            todayWordsLearned={Math.min(
              progress.dailyGoal,
              progress.todayXP
            )}
            completedCurriculumLessons={mergedCompletedLessons}
            onCompleteCurriculumLesson={handleCompleteCurriculumLesson}
            onOpenLessonRoute={navigateToLessonRoute}
            onUpdateDailyGoal={(newGoal) => {
              progress.setDailyGoal(newGoal);
              setAppState((p) => ({ ...p, dailyGoalWords: newGoal }));
            }}
            onStartLesson={handleStartSituationLesson}
            onNavigateTab={(tab) => navigateToTab(tab as AppTab)}
          />
        )}

        {activeTab === 'situations' && (
          <ExploreAndPhrasebookScreen
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            savedPhraseIds={appState.savedPhraseIds}
            onToggleSavePhrase={handleToggleSavePhrase}
            onStartSituationLesson={handleStartSituationLesson}
            onGoToPath={() => navigateToTab('home')}
          />
        )}

        {activeTab === 'explore' && (
          <ExploreAndPhrasebookScreen
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            savedPhraseIds={appState.savedPhraseIds}
            onToggleSavePhrase={handleToggleSavePhrase}
            onStartSituationLesson={handleStartSituationLesson}
            onGoToPath={() => navigateToTab('home')}
          />
        )}

        {activeTab === 'practice' && (
          <LessonAndSpeakScreen
            situation={activeSituation}
            initialMode={lessonMode}
            onBack={() => navigateToTab('home')}
            onCompleteLesson={handleCompleteLesson}
            onOpenRoleplay={(sitId) => {
              setAppState((p) => ({ ...p, activeSituationId: sitId }));
              navigateToTab('roleplay');
            }}
            onOpenPhrasebook={() => navigateToTab('explore')}
          />
        )}

        {activeTab === 'roleplay' && (
          <RoleplayScreen
            initialSituationId={appState.activeSituationId}
            onBack={() => navigateToTab('home')}
            onEarnXp={(xp) => {
              progress.addXP(xp);
              setAppState((p) => ({ ...p, totalXp: p.totalXp + xp }));
            }}
          />
        )}

        {(activeTab === 'progress' || activeTab === 'achievements') && (
          <ProgressScreen
            totalXp={progress.xp}
            lessonsCompleted={progress.totalLessonsCompletedCount}
            phrasesLearned={
              appState.phrasesLearned +
              Object.keys(progress.completedLessonsMap).length * 4
            }
            streak={progress.streak}
            situations={hydratedSituations}
            onSelectSituation={(id) =>
              handleStartSituationLesson(id, 'lesson')
            }
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            userName={appState.userName}
            userEmail={appState.userEmail}
            dailyGoalWords={progress.dailyGoal}
            streak={progress.streak}
            lessonsCompleted={progress.totalLessonsCompletedCount}
            phrasesLearned={
              appState.phrasesLearned +
              Object.keys(progress.completedLessonsMap).length * 4
            }
            savedPhraseIds={appState.savedPhraseIds}
            onUpdateProfile={(name, email, goal) => {
              progress.setDailyGoal(goal);
              const existingOnboarding = getOnboarding();
              if (existingOnboarding) {
                completeOnboarding({
                  ...existingOnboarding,
                  name,
                });
              }
              setAppState((p) => ({
                ...p,
                userName: name,
                userEmail: email,
                dailyGoalWords: goal,
              }));
            }}
            onNavigateTab={(tab) => navigateToTab(tab as AppTab)}
          />
        )}
      </main>

      {/* ================================================================= */}
      {/* ROUTE: /lesson/:unitId/:levelId/:lessonIndex SESSION ENGINE       */}
      {/* ================================================================= */}
      {lessonRoute && (
        <LessonSessionEngine
          unitId={lessonRoute.unitId}
          levelId={lessonRoute.levelId}
          lessonIndex={lessonRoute.lessonIndex}
          lessonId={lessonRoute.lessonId}
          onExit={exitLessonRoute}
          onLessonCompleted={(lessonId, earnedXp) => {
            setAppState((prev) => ({
              ...prev,
              totalXp: prev.totalXp + earnedXp,
              lessonsCompleted: prev.lessonsCompleted + 1,
              phrasesLearned: prev.phrasesLearned + 6,
              completedCurriculumLessons: {
                ...prev.completedCurriculumLessons,
                [lessonId]: true,
              },
            }));
          }}
        />
      )}

      {/* ================================================================= */}
      {/* GLOBAL TALK TO ANNA MODAL                                         */}
      {/* ================================================================= */}
      <TalkToAnnaModal
        isOpen={isTalkToAnnaOpen}
        onClose={() => setIsTalkToAnnaOpen(false)}
      />

      {/* ================================================================= */}
      {/* CITY READER SHEET (OFFLINE KANNADA SIGN & MENU TRANSLATOR)        */}
      {/* ================================================================= */}
      <CityReaderSheet
        isOpen={isCityReaderOpen}
        onClose={closeCityReader}
        onOpenRoleplayWithWord={() => {
          closeCityReader();
          playTactileTone('tap');
          setIsTalkToAnnaOpen(true);
        }}
      />

      {/* ================================================================= */}
      {/* FLOATING APP DOCK (MOBILE ONLY: <768px)                           */}
      {/* ================================================================= */}
      <AppDock
        activeTab={activeTab}
        onSelectTab={(tab) => navigateToTab(tab)}
        onOpenReader={openCityReader}
        onOpenChat={() => {
          playTactileTone('tap');
          setIsTalkToAnnaOpen(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <OnboardingGate>
      <AppShell />
    </OnboardingGate>
  );
}
