'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { BadgeCheck, Layers3, RotateCw, Shuffle, Sparkles, X } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Shuffling deck', icon: Shuffle },
  { id: 2, label: 'Mixing phrases', icon: Layers3 },
  { id: 3, label: 'Dealing fresh set', icon: Sparkles },
] as const;

const STEP_MS = 1400;
const WIDTHS = { idle: 158, running: 300, done: 196 } as const;

function AnimatedText({
  text,
  delayStep = 0.04,
  instant = false,
  className = '',
}: {
  text: string;
  delayStep?: number;
  instant?: boolean;
  className?: string;
}) {
  if (instant) {
    return <span className={`inline-flex whitespace-nowrap ${className}`}>{text}</span>;
  }

  return (
    <span className={`inline-flex whitespace-nowrap ${className}`}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={`${text}-${i}`}
          initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 20,
            delay: i * delayStep,
          }}
          className="inline-block"
        >
          {ch === ' ' ? '\u00A0' : ch}
        </motion.span>
      ))}
    </span>
  );
}

export interface DeckRotateButtonProps {
  onRotate: () => void;
}

export function DeckRotateButton({ onRotate }: DeckRotateButtonProps) {
  const reduce = useReducedMotion() ?? false;
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => () => clear(), []);

  const start = () => {
    if (status !== 'idle') return;
    if (reduce) {
      onRotate();
      setStatus('done');
      timers.current.push(window.setTimeout(() => setStatus('idle'), 900));
      return;
    }

    clear();
    setStatus('running');
    setStepIdx(0);

    STEPS.forEach((_, idx) => {
      if (idx > 0) {
        timers.current.push(
          window.setTimeout(() => setStepIdx(idx), idx * STEP_MS)
        );
      }
    });

    timers.current.push(
      window.setTimeout(() => {
        onRotate();
        setStatus('done');
        timers.current.push(
          window.setTimeout(() => {
            setStatus('idle');
            setStepIdx(0);
          }, 1100)
        );
      }, STEPS.length * STEP_MS + 200)
    );
  };

  const cancel = (e: MouseEvent<HTMLButtonElement | HTMLSpanElement>) => {
    e.stopPropagation();
    clear();
    setStatus('idle');
    setStepIdx(0);
  };

  const spring: Transition = reduce
    ? { duration: 0 }
    : { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 };

  const currentStep = STEPS[stepIdx] ?? STEPS[0];
  const StepIcon = currentStep.icon;

  return (
    <div className="flex flex-none items-center justify-end">
      <motion.div
        role={status === 'idle' ? 'button' : undefined}
        tabIndex={status === 'idle' ? 0 : -1}
        onClick={status === 'idle' ? start : undefined}
        onKeyDown={(e) => {
          if (status === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            start();
          }
        }}
        animate={{ width: WIDTHS[status] }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: 'spring', stiffness: 140, damping: 24, mass: 1 }
        }
        aria-label="Rotate deck to next set of sentences"
        className="relative flex h-11 flex-none shrink-0 select-none items-center justify-center overflow-hidden rounded-full"
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === 'idle' && (
            <motion.span
              key="idle"
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(4px)' }}
              transition={spring}
              className="flex h-full w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              <RotateCw className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Rotate Deck</span>
            </motion.span>
          )}

          {status === 'running' && (
            <motion.div
              key="running"
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(4px)' }}
              transition={spring}
              className="flex h-full items-center gap-2.5 whitespace-nowrap rounded-full bg-primary/[0.07] px-4 ring-1 ring-primary/20"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`icon-${currentStep.id}`}
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: 20 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 150, damping: 22, mass: 0.8 }
                  }
                  className="inline-flex shrink-0 items-center justify-center"
                >
                  <StepIcon className="h-4 w-4 shrink-0 text-primary" />
                </motion.span>
              </AnimatePresence>

              <AnimatedText
                key={`label-${currentStep.id}`}
                text={currentStep.label}
                delayStep={0.04}
                instant={reduce}
                className="text-[16px] font-bold text-neutral-800"
              />

              <button
                type="button"
                aria-label="Cancel deck rotation"
                onClick={cancel}
                className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-neutral-200/80 text-neutral-600 transition-colors hover:bg-neutral-300 hover:text-neutral-900"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </motion.div>
          )}

          {status === 'done' && (
            <motion.span
              key="done"
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.94, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: 'blur(4px)' }}
              transition={spring}
              className="flex h-full w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-700 shadow-xs"
            >
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <AnimatedText text="Fresh deck!" delayStep={0.04} instant={reduce} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
