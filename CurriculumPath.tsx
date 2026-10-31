import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { TalkToAnnaModal } from './TalkToAnnaModal';
import { Mascot, MASCOT_PLACEMENTS } from './Mascot';
import {
  COURSE_PHASES,
  COURSE_UNITS,
  Unit,
  Level,
  Lesson,
  getUnitCrowns,
  computeLessonState,
  LessonNodeState,
} from './courseData';
import { playTactileTone } from './kanglishData';
import { useProgress } from './progressStore';
import { STRINGS } from './i18n';
import {
  UnitPathBackdropDoodles,
  UnitHeaderWatermarkDoodle,
  WINDING_OFFSETS,
} from './UnitBackgroundDoodles';

interface CurriculumPathProps {
  completedLessons: Record<string, boolean>;
  onStartCurriculumLesson: (
    unit: Unit,
    level: Level,
    lesson: Lesson,
    lessonIndex: number
  ) => void;
  onQuickCompleteLesson?: (
    unitId: string,
    levelId: string,
    lessonId: string,
    earnedXp: number
  ) => void;
}

const PHASE_ICONS: Record<number, string> = {
  1: '',
  2: '',
  3: '',
  4: '',
  5: '',
};

function getLessonMaterialIcon(levelNumber: 1 | 2 | 3 | 4 | 5): string {
  switch (levelNumber) {
    case 1:
      return 'waving_hand';
    case 2:
      return 'star';
    case 3:
      return 'chat_bubble';
    case 4:
      return 'record_voice_over';
    case 5:
      return 'emoji_events';
  }
}

/**
 * Builds a smooth cubic Bézier SVG path (M x0 y0 C ...) threading through every node center in order.
 */
function buildSmoothNodePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';

  const n = points.length;
  const tx: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const dxPrev = points[i].x - points[i - 1].x;
    const dxNext = points[i + 1].x - points[i].x;
    const dyPrev = points[i].y - points[i - 1].y;
    const dyNext = points[i + 1].y - points[i].y;
    if (dxPrev * dxNext > 0 && dyPrev < 170 && dyNext < 170) {
      tx[i] = (points[i + 1].x - points[i - 1].x) * 0.16;
    }
  }

  const fmt = (v: number) => Math.round(v * 10) / 10;
  const cmds: string[] = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dy = Math.max(1, p1.y - p0.y);
    const cpYOffset = Math.min(dy * 0.48, Math.max(60, dy * 0.42));

    const cx1 = p0.x + tx[i];
    const cy1 = p0.y + cpYOffset;
    const cx2 = p1.x - tx[i + 1];
    const cy2 = p1.y - cpYOffset;

    cmds.push(
      `C ${fmt(cx1)} ${fmt(cy1)}, ${fmt(cx2)} ${fmt(cy2)}, ${fmt(p1.x)} ${fmt(p1.y)}`
    );
  }

  return cmds.join(' ');
}

export const CurriculumPath: React.FC<CurriculumPathProps> = ({
  completedLessons,
  onStartCurriculumLesson,
}) => {
  const { demoUnlock, completedLessonsMap } = useProgress();
  const [isTalkToAnnaOpen, setIsTalkToAnnaOpen] = useState<boolean>(false);
  const [lockedToast, setLockedToast] = useState<string | null>(null);
  const [shakingNodeId, setShakingNodeId] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [svgPath, setSvgPath] = useState<string>('');
  const [svgSize, setSvgSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNodeRef = useRef<HTMLDivElement | null>(null);
  const pathContainerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const allCompletedMap = useMemo(
    () => ({
      ...completedLessons,
      ...completedLessonsMap,
    }),
    [completedLessons, completedLessonsMap]
  );

  const prevCompletedRef = useRef<Record<string, boolean>>(allCompletedMap);

  const getLessonState = useCallback(
    (unitId: string, lessonIndex: number): LessonNodeState => {
      return computeLessonState(
        unitId,
        lessonIndex,
        COURSE_UNITS,
        allCompletedMap,
        demoUnlock
      );
    },
    [allCompletedMap, demoUnlock]
  );

  const currentActiveLevelId = useMemo(() => {
    for (let uIdx = 0; uIdx < COURSE_UNITS.length; uIdx++) {
      const unit = COURSE_UNITS[uIdx];
      for (let lIdx = 0; lIdx < unit.levels.length; lIdx++) {
        if (getLessonState(unit.id, lIdx) === 'current') {
          return unit.levels[lIdx].id;
        }
      }
    }
    return COURSE_UNITS[0]?.levels[0]?.id || null;
  }, [getLessonState]);

  const firstLockedGateLevelId = useMemo(() => {
    for (let uIdx = 0; uIdx < COURSE_UNITS.length; uIdx++) {
      const unit = COURSE_UNITS[uIdx];
      const gateIdx = unit.levels.length - 1;
      const gateLevel = unit.levels[gateIdx];
      if (gateLevel && getLessonState(unit.id, gateIdx) === 'locked') {
        return gateLevel.id;
      }
    }
    return null;
  }, [getLessonState]);

  const [visibleLockedGateId, setVisibleLockedGateId] = useState<string | null>(
    null
  );

  const activeLockedGateId = visibleLockedGateId || firstLockedGateLevelId;

  useEffect(() => {
    const container = pathContainerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;

    const gateObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const gateId = (entry.target as HTMLElement).getAttribute(
              'data-locked-gate-id'
            );
            if (gateId) {
              setVisibleLockedGateId(gateId);
              break;
            }
          }
        }
      },
      { rootMargin: '80px 0px' }
    );

    const gateEls = container.querySelectorAll<HTMLElement>(
      '[data-locked-gate-id]'
    );
    gateEls.forEach((el) => gateObserver.observe(el));

    return () => gateObserver.disconnect();
  }, [firstLockedGateLevelId, demoUnlock, allCompletedMap]);

  const recomputeSvgPath = useCallback(() => {
    const container = pathContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const width = container.clientWidth || containerRect.width;
    const height = container.scrollHeight || containerRect.height;

    const nodeElements = container.querySelectorAll<HTMLElement>(
      '[data-lesson-node="true"]'
    );
    const points: { x: number; y: number }[] = [];

    nodeElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;
      points.push({ x, y });
    });

    const nextPath = buildSmoothNodePath(points);
    setSvgSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height }
    );
    setSvgPath((prev) => (prev === nextPath ? prev : nextPath));
  }, []);

  const scheduleRecomputeSvgPath = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      recomputeSvgPath();
    });
  }, [recomputeSvgPath]);

  useLayoutEffect(() => {
    scheduleRecomputeSvgPath();
  }, [scheduleRecomputeSvgPath, currentActiveLevelId, demoUnlock, allCompletedMap]);

  useEffect(() => {
    const container = pathContainerRef.current;
    if (!container) return;

    const handleViewportChange = () => {
      scheduleRecomputeSvgPath();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleRecomputeSvgPath();
      });
      resizeObserver.observe(container);
    }

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        () => {
          scheduleRecomputeSvgPath();
        },
        { rootMargin: '200px 0px' }
      );
      const unitSections = container.querySelectorAll<HTMLElement>(
        '[data-unit-idx]'
      );
      unitSections.forEach((sec) => intersectionObserver?.observe(sec));
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [scheduleRecomputeSvgPath]);

  useEffect(() => {
    const prev = prevCompletedRef.current;
    let newlyDone: string | null = null;
    for (const [key, val] of Object.entries(allCompletedMap)) {
      if (val && !prev[key]) {
        newlyDone = key;
        break;
      }
    }
    prevCompletedRef.current = allCompletedMap;
    if (newlyDone) {
      setJustCompletedId(newlyDone);
      const timer = setTimeout(() => {
        setJustCompletedId((cur) => (cur === newlyDone ? null : cur));
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [allCompletedMap]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const triggerLockedFeedback = (levelId: string) => {
    playTactileTone('error');
    setShakingNodeId(levelId);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => {
      setShakingNodeId((cur) => (cur === levelId ? null : cur));
    }, 450);

    setLockedToast(STRINGS.curriculum.lockedLessonToast);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setLockedToast(null);
    }, 2000);
  };

  const handleNodeTap = (
    unit: Unit,
    level: Level,
    lessonIndex: number
  ) => {
    const state = getLessonState(unit.id, lessonIndex);
    if (state === 'locked') {
      triggerLockedFeedback(level.id);
      return;
    }

    playTactileTone('tap');
    const targetLesson = level.lessons[0];
    if (targetLesson) {
      onStartCurriculumLesson(unit, level, targetLesson, 0);
    }
  };

  const phaseFirstUnitMap = useMemo(() => {
    const map = new Map<
      string,
      { phaseId: number; emoji: string; rangeLabel: string }
    >();
    for (const p of COURSE_PHASES) {
      const firstUnitId = p.units[0];
      if (!firstUnitId) continue;
      const nums = p.units
        .map((u) => parseInt(u.replace('u', ''), 10))
        .filter((n) => !isNaN(n));
      const minU = nums.length > 0 ? Math.min(...nums) : 1;
      const maxU = nums.length > 0 ? Math.max(...nums) : 1;
      map.set(firstUnitId, {
        phaseId: p.id,
        emoji: PHASE_ICONS[p.id] || '',
        rangeLabel: `Units ${minU}–${maxU}`,
      });
    }
    return map;
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto pb-6 relative overflow-x-hidden">
      {/* VERTICAL WINDING PATH CONTAINER */}
      <div ref={pathContainerRef} className="relative space-y-6">
        {/* 2a) CONNECTOR: continuous curved dotted SVG path behind all nodes and dividers */}
        <svg
          width={svgSize.width || '100%'}
          height={svgSize.height || '100%'}
          className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-visible"
          aria-hidden="true"
        >
          {svgPath && (
            <path
              d={svgPath}
              className="stroke-[#c8c4d7]"
              strokeWidth={6}
              strokeDasharray="2 14"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </svg>

        {COURSE_UNITS.map((unit, uIdx) => {
          const phaseMarker = phaseFirstUnitMap.get(unit.id);
          const crowns = getUnitCrowns(unit, allCompletedMap);
          const isCrowned = crowns >= unit.levels.length;

          return (
            <div
              key={unit.id}
              data-unit-idx={uIdx}
              className="relative space-y-5"
            >
              {/* 2g) PHASE MARKER: before each phase's first unit */}
              {phaseMarker && (
                <div className="relative z-10 bg-secondary-fixed rounded-xl p-3 flex items-center justify-between shadow-[0_3px_0_0_#c6bfff]">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-md text-on-secondary-fixed">
                      Phase {phaseMarker.phaseId}
                    </span>
                  </div>
                  <span className="bg-surface-container-lowest rounded-full px-2 py-0.5 font-caption text-on-surface">
                    {phaseMarker.rangeLabel}
                  </span>
                </div>
              )}

              {/* 2f) UNIT DIVIDER: full-width white bar with subtle unit doodle watermarks */}
              <div className="relative z-10 overflow-hidden bg-surface-container-lowest rounded-xl shadow-[0_3px_0_0_#e1e2e7] p-3 flex items-center justify-between">
                <UnitHeaderWatermarkDoodle unitId={unit.id} unitIndex={uIdx} />
                <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                  <h2 className="font-headline-md text-on-surface truncate">
                    Unit {uIdx + 1} — {unit.title}
                  </h2>
                </div>
                <span className="relative z-10 font-caption text-on-surface-variant shrink-0 ml-2">
                  {isCrowned ? '5/5' : `${crowns}/5`}
                </span>
              </div>

              {/* 2b–2e) LESSON NODES (5 per unit) + RICH UNIT DOODLE BACKDROP */}
              <div className="relative py-5">
                <UnitPathBackdropDoodles unitId={unit.id} unitIndex={uIdx} />

                <div className="relative z-10 flex flex-col items-center space-y-7">
                  {unit.levels.map((level, lIdx) => {
                    const globalLessonIdx = uIdx * 5 + lIdx;
                    const offsetPx =
                      WINDING_OFFSETS[globalLessonIdx % WINDING_OFFSETS.length];

                    const nodeState = getLessonState(unit.id, lIdx);
                    const isCompleted = nodeState === 'completed';
                    const isCurrent = nodeState === 'current';
                    const isPreview = nodeState === 'preview';
                    const isLocked = nodeState === 'locked';

                    const isShaking = shakingNodeId === level.id;
                    const isJustCompleted = justCompletedId === level.id;
                    const iconName = getLessonMaterialIcon(level.levelNumber);

                    let nodeButtonClasses =
                      'w-[72px] h-[72px] rounded-full flex items-center justify-center relative z-10 cursor-pointer transition-transform touch-manipulation ';

                    if (isCompleted) {
                      nodeButtonClasses +=
                        'bg-[#00B894] shadow-[0_4px_0_0_#02967a] text-white active:translate-y-1';
                    } else if (isCurrent) {
                      nodeButtonClasses +=
                        'bg-primary-container text-on-primary ring-4 ring-primary-fixed shadow-[0_4px_0_0_#5341cd] scale-pulse-loop active:translate-y-1';
                    } else if (isPreview) {
                      nodeButtonClasses +=
                        'bg-primary-container text-on-primary ring-4 ring-primary-fixed shadow-[0_4px_0_0_#5341cd] active:translate-y-1';
                    } else {
                      nodeButtonClasses +=
                        'bg-surface-container-high shadow-[0_3px_0_0_#d8dadf] text-outline';
                    }

                    if (isJustCompleted) {
                      nodeButtonClasses += ' node-complete-pop';
                    }

                    const isPlayable = !isLocked;
                    const isGateNode =
                      level.levelNumber === 5 ||
                      level.lessons[0]?.type === 'checkpoint';
                    const isLockedGate = isGateNode && isLocked;
                    const showPeekingSango =
                      isLockedGate && level.id === activeLockedGateId;

                    return (
                      <div
                        key={level.id}
                        ref={isCurrent ? currentNodeRef : undefined}
                        data-locked-gate-id={isLockedGate ? level.id : undefined}
                        className={`relative z-10 flex flex-col items-center ${
                          isShaking ? 'animate-shake' : ''
                        }`}
                        style={{ transform: `translateX(${offsetPx}px)` }}
                      >
                        {/* 2d) START CALLOUT above the CURRENT node only */}
                        {isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleNodeTap(unit, level, lIdx)}
                            className="mb-2 flex flex-col items-center animate-bounce cursor-pointer group touch-manipulation"
                          >
                            <span className="bg-surface-container-lowest rounded-full px-4 py-2 shadow-[0_4px_0_0_#d8dadf] font-label-bold text-primary-container flex items-center gap-1.5 whitespace-nowrap">
                              <span>START</span>
                            </span>
                            <span
                              className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-surface-container-lowest"
                              aria-hidden="true"
                            />
                          </button>
                        )}

                        {/* 2b & 2c) 72px Circular Lesson Node Button */}
                        <div className="relative flex items-center justify-center">
                          {showPeekingSango && (
                            <Mascot {...MASCOT_PLACEMENTS.homeLockedGatePeek} />
                          )}
                          <button
                            type="button"
                            data-lesson-node="true"
                            data-lesson-state={nodeState}
                            data-gate-node={isGateNode ? 'true' : undefined}
                            aria-disabled={isLocked}
                            onClick={() => handleNodeTap(unit, level, lIdx)}
                            className={nodeButtonClasses}
                            aria-label={`Unit ${uIdx + 1} L${level.levelNumber} ${level.name} (${nodeState})`}
                          >
                            {isCompleted ? (
                              <span
                                className="material-symbols-outlined text-[32px] text-white select-none"
                                style={{
                                  fontVariationSettings:
                                    "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24",
                                }}
                              >
                                check
                              </span>
                            ) : isLocked ? (
                              <span
                                className="material-symbols-outlined text-[28px] text-outline select-none"
                                style={{
                                  fontVariationSettings:
                                    "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24",
                                }}
                              >
                                lock
                              </span>
                            ) : (
                              <span
                                className="material-symbols-outlined text-[30px] text-white select-none"
                                style={{
                                  fontVariationSettings:
                                    "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24",
                                }}
                              >
                                {iconName}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* 2e) LABEL under each node */}
                        <span
                          className={`mt-2 px-3 py-1 rounded-lg bg-white/95 border border-outline-variant/30 shadow-xs font-caption uppercase tracking-wider text-center transition-colors ${
                            isPlayable
                              ? 'text-neutral-900 font-bold'
                              : 'text-neutral-600 font-semibold'
                          }`}
                        >
                          L{level.levelNumber} · {level.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* §3 LOCKED NODE TOAST */}
      {lockedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-on-primary rounded-full px-5 py-2.5 font-label-bold shadow-[0_4px_0_0_#5341cd] whitespace-nowrap"
        >
          {lockedToast}
        </div>
      )}

      {/* §4 FLOATING "TALK TO ANNA" PILL */}
      <button
        type="button"
        onClick={() => {
          playTactileTone('tap');
          setIsTalkToAnnaOpen(true);
        }}
        className="fixed bottom-28 right-4 z-40 md:bottom-8 md:right-6 max-w-[240px] h-14 px-7 rounded-full bg-primary-container text-on-primary font-label-bold uppercase tracking-wider flex items-center gap-2.5 shadow-[0_4px_0_0_#5341cd] active:translate-y-1 active:shadow-none cursor-pointer whitespace-nowrap touch-manipulation"
        aria-label="Talk to Anna"
      >
        <span>Talk to Anna</span>
      </button>

      {/* TALK TO ANNA VOICE CONVERSATION MODAL */}
      <TalkToAnnaModal
        isOpen={isTalkToAnnaOpen}
        onClose={() => setIsTalkToAnnaOpen(false)}
      />
    </div>
  );
};
