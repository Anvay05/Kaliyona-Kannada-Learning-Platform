'use client';

/**
 * AppDock — mobile bottom pill navigation dock (<768px).
 * Center FAB: "+" opens a speed-dial (Scan Kannada, New Goal).
 */

import * as React from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
  type SpringOptions,
} from 'motion/react';
import {
  House,
  Compass,
  Dumbbell,
  UserRound,
  Plus,
  Target,
  ScanLine,
} from 'lucide-react';
import { cn } from './utils';

const SPRING: SpringOptions = { stiffness: 380, damping: 24, mass: 0.35 };
const ICON = 54; // resting icon tile size, px
const MAGNIFY = 1.35; // max magnification at cursor
const DISTANCE = 80; // falloff radius, px
const ACTIVE_PILL = 34; // active tab indicator width, px

export type DockTabId = 'home' | 'explore' | 'practice' | 'profile';

const ITEMS = [
  { label: 'Home', id: 'home' as const, href: '/', icon: House },
  { label: 'Explore', id: 'explore' as const, href: '/explore', icon: Compass },
  { label: 'Practice', id: 'practice' as const, href: '/practice', icon: Dumbbell },
  { label: 'Profile', id: 'profile' as const, href: '/profile', icon: UserRound },
] as const;

function DockIcon({
  item,
  active,
  mouseX,
  finePointer,
  reduce,
  onNavigate,
}: {
  item: (typeof ITEMS)[number];
  active: boolean;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  finePointer: boolean;
  reduce: boolean;
  onNavigate: (tab: DockTabId, href: string) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const dist = useTransform(mouseX, (val) => {
    const el = wrapRef.current;
    if (!el || !Number.isFinite(val)) return DISTANCE * 100;
    const r = el.getBoundingClientRect();
    return Math.abs(val - (r.left + r.width / 2));
  });
  const gauss = (d: number) =>
    (MAGNIFY - 1) * Math.exp(-(d * d) / (2 * DISTANCE * DISTANCE)) + 1;
  const sizeRaw = useTransform(dist, (d) => ICON * gauss(d));
  const size = useSpring(sizeRaw, SPRING);

  const Icon = item.icon;
  const interactive = finePointer && !reduce;

  return (
    <div ref={wrapRef} className="relative flex flex-1 sm:flex-none flex-col items-center gap-0.5">
      <motion.button
        type="button"
        onClick={() => onNavigate(item.id, item.href)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        style={interactive ? { width: size, height: size } : undefined}
        className={cn(
          'relative flex h-11 w-[54px] cursor-pointer items-center justify-center rounded-2xl touch-manipulation',
          'transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
          interactive ? 'hover:bg-black/[0.05]' : 'active:bg-black/[0.06]',
          active ? 'text-[var(--primary)]' : 'text-neutral-400',
        )}
      >
        <Icon
          className="size-[24px]"
          strokeWidth={active ? 2.2 : 1.8}
        />
      </motion.button>
      <span
        className={cn(
          'select-none text-[10px] font-medium leading-none tracking-tight transition-colors',
          active ? 'text-[var(--primary)]' : 'text-neutral-400',
        )}
      >
        {item.label}
      </span>
      {active && (
        <motion.span
          layoutId={reduce ? undefined : 'dock-active-pill'}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 35 }
          }
          className="absolute -top-0.5 h-1 rounded-full bg-[var(--primary)]"
          style={{ width: ACTIVE_PILL / 4 }}
        />
      )}
    </div>
  );
}

export interface AppDockProps {
  activeTab?: string;
  onSelectTab?: (tab: DockTabId) => void;
  onOpenChat?: () => void;
  onOpenReader?: () => void;
}

export function AppDock({
  activeTab,
  onSelectTab,
  onOpenReader,
}: AppDockProps) {
  const reduce = useReducedMotion() ?? false;

  const [finePointer, setFinePointer] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    setFinePointer(mq.matches);
    const on = (e: MediaQueryListEvent) => setFinePointer(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const mouseX = useMotionValue(Infinity);
  const magnify = finePointer && !reduce;

  const [dialOpen, setDialOpen] = React.useState(false);

  const dockBarRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = dockBarRef.current;
    if (!el || typeof window === 'undefined') return;

    const updateNavOccupiedSpace = () => {
      if (Number.isFinite(mouseX.get())) return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight) {
        const occupied = Math.min(
          96,
          Math.max(64, Math.round(window.innerHeight - rect.top)),
        );
        document.documentElement.style.setProperty(
          '--bottom-nav-h',
          `${occupied}px`,
        );
        document.documentElement.style.setProperty(
          '--nav-occupied-space',
          `${occupied}px`,
        );
      }
    };

    updateNavOccupiedSpace();

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateNavOccupiedSpace)
        : null;
    ro?.observe(el);
    window.addEventListener('resize', updateNavOccupiedSpace);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateNavOccupiedSpace);
    };
  }, []);

  const navigate = React.useCallback(
    (tab: DockTabId, href: string) => {
      setDialOpen(false);
      if (onSelectTab) {
        onSelectTab(tab);
      } else if (typeof window !== 'undefined') {
        try {
          window.history.pushState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch {
          // Ignore sandbox history restriction
        }
      }
    },
    [onSelectTab],
  );

  const handleSpeedDialAction = React.useCallback(
    (target: 'reader' | 'practice') => {
      setDialOpen(false);
      if (target === 'reader') {
        if (onOpenReader) {
          onOpenReader();
        } else if (typeof window !== 'undefined') {
          try {
            window.history.pushState({}, '', '/reader');
            window.dispatchEvent(new PopStateEvent('popstate'));
          } catch {
            // Ignore sandbox history restriction
          }
        }
      } else if (target === 'practice') {
        navigate('practice', '/practice');
      }
    },
    [navigate, onOpenReader],
  );

  const isActive = (item: (typeof ITEMS)[number]) => {
    if (activeTab) {
      if (item.id === 'home') return activeTab === 'home';
      if (item.id === 'explore')
        return activeTab === 'explore' || activeTab === 'situations';
      if (item.id === 'practice')
        return activeTab === 'practice' || activeTab === 'roleplay';
      if (item.id === 'profile') return activeTab === 'profile';
      return false;
    }
    const pathname =
      typeof window !== 'undefined' ? window.location.pathname : '/';
    return item.href === '/'
      ? pathname === '/'
      : pathname?.startsWith(item.href);
  };

  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const renderItem = (item: (typeof ITEMS)[number]) => (
    <DockIcon
      key={item.href}
      item={item}
      active={!!isActive(item)}
      mouseX={mouseX}
      finePointer={magnify}
      reduce={reduce}
      onNavigate={navigate}
    />
  );

  const SPEED_DIAL_ACTIONS = [
    {
      label: 'Scan Kannada',
      sublabel: 'Translate signs & menus',
      target: 'reader' as const,
      icon: ScanLine,
      iconSize: 18,
    },
    {
      label: 'New Goal',
      sublabel: undefined,
      target: 'practice' as const,
      icon: Target,
      iconSize: 15,
    },
  ] as const;

  return (
    <>
      {/* scrim behind the speed-dial */}
      <AnimatePresence>
        {dialOpen && (
          <motion.div
            key="dock-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.15 }}
            onClick={() => setDialOpen(false)}
            className="fixed inset-0 z-40 bg-black/10"
          />
        )}
      </AnimatePresence>

      <nav className="app-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <div className="relative">
          {/* speed-dial actions */}
          <AnimatePresence>
            {dialOpen && (
              <div className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 flex-col items-center gap-2.5">
                {SPEED_DIAL_ACTIONS.map((action, i) => (
                  <motion.button
                    key={action.label}
                    type="button"
                    initial={
                      reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }
                    }
                    animate={
                      reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
                    }
                    exit={
                      reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }
                    }
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            type: 'spring',
                            stiffness: 420,
                            damping: 26,
                            delay: i * 0.05,
                          }
                    }
                    onClick={() => handleSpeedDialAction(action.target)}
                    className="glass-strong !rounded-full pointer-events-auto min-h-[44px] flex cursor-pointer items-center gap-2.5 whitespace-nowrap py-2 pl-3 pr-4 transition-colors hover:bg-white/90 touch-manipulation"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                      <action.icon size={action.iconSize} strokeWidth={2} />
                    </span>
                    <span className="flex flex-col items-start text-left leading-tight">
                      <span className="text-[13px] font-semibold text-neutral-800">
                        {action.label}
                      </span>
                      {action.sublabel && (
                        <span className="text-[10px] font-medium text-neutral-500">
                          {action.sublabel}
                        </span>
                      )}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* the dock bar */}
          <div
            ref={dockBarRef}
            onMouseMove={magnify ? (e) => mouseX.set(e.clientX) : undefined}
            onMouseLeave={magnify ? () => mouseX.set(Infinity) : undefined}
            className="glass-strong !rounded-[24px] pointer-events-auto flex w-[calc(100vw-1.5rem)] max-w-[440px] sm:w-auto sm:max-w-none items-end gap-2 px-4 py-1"
          >
            {left.map(renderItem)}

            {/* center FAB */}
            <motion.button
              type="button"
              aria-label={dialOpen ? 'Close quick actions' : 'Quick actions'}
              aria-expanded={dialOpen}
              onClick={() => setDialOpen((v) => !v)}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              className="mx-3 -mt-3 flex h-14 w-14 shrink-0 -translate-y-2 cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_6px_20px_rgba(108,92,231,0.45)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-offset-2 touch-manipulation"
            >
              <motion.span
                animate={{ rotate: dialOpen ? 45 : 0 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 28 }
                }
                className="flex"
              >
                <Plus size={26} strokeWidth={2.2} />
              </motion.span>
            </motion.button>

            {right.map(renderItem)}
          </div>
        </div>
      </nav>
    </>
  );
}
