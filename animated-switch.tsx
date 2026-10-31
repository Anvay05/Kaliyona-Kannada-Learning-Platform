import React, { useState, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface AnimatedSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  required?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onIcon?: React.ReactNode;
  offIcon?: React.ReactNode;
}

const DRAG_THRESHOLD_PX = 8;

const SIZES = {
  sm: {
    trackClass: 'w-[42px] h-[24px] p-[2px]',
    knobHeight: 20,
    knobSize: 20,
    travel: 18,
    stretch: 4,
  },
  md: {
    trackClass: 'w-[51px] h-[31px] p-[2px]',
    knobHeight: 27,
    knobSize: 27,
    travel: 20,
    stretch: 6,
  },
  lg: {
    trackClass: 'w-[62px] h-[36px] p-[2px]',
    knobHeight: 32,
    knobSize: 32,
    travel: 26,
    stretch: 8,
  },
} as const;

export const AnimatedSwitch: React.FC<AnimatedSwitchProps> = ({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  size = 'md',
  className = '',
  id,
  name,
  value,
  required,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}) => {
  const isControlled = controlledChecked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const checked = isControlled ? controlledChecked : internalChecked;

  const [isPressing, setIsPressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isScrollingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const reducedMotion = useReducedMotion();
  const config = SIZES[size] || SIZES.md;

  const armClickSuppression = useCallback(() => {
    suppressClickRef.current = true;
    if (suppressTimerRef.current !== null) {
      window.clearTimeout(suppressTimerRef.current);
    }
    suppressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, 120);
  }, []);

  const setChecked = useCallback(
    (next: boolean) => {
      if (disabled) return;
      if (!isControlled) {
        setInternalChecked(next);
      }
      onCheckedChange?.(next);
    },
    [disabled, isControlled, onCheckedChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = performance.now();
    isDraggingRef.current = false;
    isScrollingRef.current = false;
    pointerIdRef.current = e.pointerId;
    setIsPressing(true);
    setIsDragging(false);
    setDragOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPressing || disabled) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (!isDraggingRef.current && !isScrollingRef.current) {
      if (Math.abs(dy) > DRAG_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
        isScrollingRef.current = true;
        setIsPressing(false);
        return;
      }
      if (Math.abs(dx) >= DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if unsupported
        }
      }
    }

    if (isDraggingRef.current) {
      setDragOffset(dx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPressing || disabled) return;
    if (pointerIdRef.current !== null) {
      try {
        if (e.currentTarget.hasPointerCapture?.(pointerIdRef.current)) {
          e.currentTarget.releasePointerCapture(pointerIdRef.current);
        }
      } catch {
        // Ignore
      }
      pointerIdRef.current = null;
    }

    const dt = performance.now() - startTimeRef.current;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    setIsPressing(false);
    setIsDragging(false);
    setDragOffset(0);

    if (isScrollingRef.current) {
      armClickSuppression();
      return;
    }

    let nextChecked = checked;

    if (isDraggingRef.current) {
      const velocity = dx / Math.max(dt, 1);
      if (Math.abs(velocity) > 0.25) {
        nextChecked = velocity > 0;
      } else {
        const baseX = checked ? config.travel : 0;
        nextChecked = baseX + dx > config.travel / 2;
      }
      armClickSuppression();
      setChecked(nextChecked);
    } else if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
      // Single tap (<8px movement): fire toggle immediately and suppress the follow-up synthetic click
      armClickSuppression();
      setChecked(!checked);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== null) {
      try {
        if (e.currentTarget.hasPointerCapture?.(pointerIdRef.current)) {
          e.currentTarget.releasePointerCapture(pointerIdRef.current);
        }
      } catch {
        // Ignore
      }
      pointerIdRef.current = null;
    }
    setIsPressing(false);
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setChecked(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setChecked(!checked);
    }
  };

  let knobX = checked ? config.travel : 0;
  let knobWidth: number = config.knobSize;

  if (isDragging) {
    const baseX = checked ? config.travel : 0;
    const rawX = baseX + dragOffset;
    knobX = Math.max(
      0,
      Math.min(rawX - (checked ? config.stretch : 0), config.travel - config.stretch)
    );
    knobWidth = config.knobSize + config.stretch;
  } else if (isPressing) {
    if (!checked) {
      knobX = 0;
      knobWidth = config.knobSize + config.stretch;
    } else {
      knobX = config.travel - config.stretch;
      knobWidth = config.knobSize + config.stretch;
    }
  }

  const spring = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 600, damping: 35 };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      name={name}
      value={value}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-required={required}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex items-center rounded-full cursor-pointer select-none touch-manipulation transition-colors duration-200 ${
        config.trackClass
      } ${
        checked ? 'bg-primary' : 'bg-neutral-200'
      } ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-hidden ${className}`}
    >
      {/* Hit-area extender (ensures >=44x44px touch target) */}
      <span
        className="absolute -inset-3 pointer-events-none rounded-full"
        aria-hidden="true"
      />

      {/* Knob */}
      <motion.span
        animate={{
          x: knobX,
          width: knobWidth,
        }}
        transition={spring}
        style={{
          height: config.knobHeight,
        }}
        className="block rounded-full bg-white shadow-sm pointer-events-none shrink-0"
      />
    </button>
  );
};
