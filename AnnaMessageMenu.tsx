import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreVertical,
  PencilLine,
  Copy,
  Heart,
  Trash2,
  X,
  Check,
} from 'lucide-react';

export interface AnnaMessageMenuProps {
  turnIndex: number;
  isOpen: boolean;
  prefersReducedMotion: boolean;
  isFavourited?: boolean;
  isCopied?: boolean;
  onOpenToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onToggleFavourite: () => void;
  onDelete: () => void;
}

const SPRING_TRANSITION = {
  type: 'spring' as const,
  stiffness: 450,
  damping: 32,
};

interface PositionState {
  top: number;
  left: number;
  openUp: boolean;
}

const computePosition = (
  triggerEl: HTMLElement,
  cardEl: HTMLElement | null
): PositionState => {
  const rect = triggerEl.getBoundingClientRect();
  const CARD_WIDTH = cardEl?.offsetWidth || (window.innerWidth >= 640 ? 264 : 248);
  const CARD_HEIGHT = cardEl?.offsetHeight || 260;

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUp = spaceBelow < CARD_HEIGHT + 16 && spaceAbove > spaceBelow;

  let top = openUp ? rect.top - CARD_HEIGHT - 8 : rect.bottom + 8;
  top = Math.max(8, Math.min(top, window.innerHeight - CARD_HEIGHT - 8));

  let left = rect.right - CARD_WIDTH;
  left = Math.max(8, Math.min(left, window.innerWidth - CARD_WIDTH - 8));

  return { top, left, openUp };
};

export const AnnaMessageMenu: React.FC<AnnaMessageMenuProps> = ({
  turnIndex,
  isOpen,
  prefersReducedMotion,
  isFavourited = false,
  isCopied = false,
  onOpenToggle,
  onClose,
  onEdit,
  onCopy,
  onToggleFavourite,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [position, setPosition] = useState<PositionState | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const nextPos = computePosition(triggerRef.current, cardRef.current);
    setPosition(nextPos);
  }, []);

  // Compute position synchronously before paint when menu opens or card size changes
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      setIsDeleting(false);
      return;
    }
    updatePosition();
  }, [isOpen, updatePosition]);

  useLayoutEffect(() => {
    if (isOpen && cardRef.current) {
      updatePosition();
    }
  }, [isOpen, updatePosition, isDeleting]);

  // Close on outside click, Escape, list/window scroll, or window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      onClose();
    };

    const handleResize = () => {
      onClose();
    };

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (cardRef.current && cardRef.current.contains(target)) {
        return;
      }
      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpenToggle}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
          isOpen
            ? 'bg-surface-container-high text-on-surface opacity-100'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/70 opacity-60 hover:opacity-100'
        }`}
        title="More options"
        aria-label="More options"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isCopied ? (
          <Check className="w-[15px] h-[15px] text-emerald-500 animate-in zoom-in-75 duration-150" />
        ) : (
          <MoreVertical className="w-[15px] h-[15px]" />
        )}
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && position && (
              <motion.div
                key={`anna-msg-menu-card-${turnIndex}`}
                ref={cardRef}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.92 }
                }
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.92 }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0.05 }
                    : SPRING_TRANSITION
                }
                style={{
                  position: 'fixed',
                  top: position.top,
                  left: position.left,
                  transformOrigin: position.openUp ? 'bottom right' : 'top right',
                  zIndex: 9999,
                }}
                className="w-[248px] sm:w-[264px] bg-surface-container-lowest border border-outline-variant/70 rounded-2xl shadow-2xl overflow-hidden text-on-surface select-none"
                role="menu"
                aria-orientation="vertical"
              >
                {/* Header: title + close chip */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-outline-variant/30 select-none">
                  <span className="text-xs sm:text-sm font-semibold text-on-surface-variant">
                    More Options
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-6 h-6 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                    aria-label="Close options"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Top group: Edit, Copy, Favourite */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onEdit();
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
                  >
                    <PencilLine className="w-[18px] h-[18px] text-on-surface-variant shrink-0" />
                    <span className="text-[15px] font-medium leading-none">Edit</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onCopy();
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
                  >
                    <Copy className="w-[18px] h-[18px] text-on-surface-variant shrink-0" />
                    <span className="text-[15px] font-medium leading-none">Copy</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleFavourite();
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
                  >
                    <Heart
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                        isFavourited
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-on-surface-variant'
                      }`}
                    />
                    <span className="text-[15px] font-medium leading-none">
                      {isFavourited ? 'Unfavourite' : 'Favourite'}
                    </span>
                  </button>
                </div>

                {/* Bottom group: 2-step Delete */}
                <div className="p-1.5 border-t border-outline-variant/30 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    {!isDeleting ? (
                      <motion.button
                        key="delete-action"
                        initial={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8 }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        exit={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8 }
                        }
                        transition={{ duration: 0.15 }}
                        type="button"
                        role="menuitem"
                        onClick={() => setIsDeleting(true)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-[18px] h-[18px] text-red-500 shrink-0" />
                        <span className="text-[15px] font-medium leading-none">
                          Delete
                        </span>
                      </motion.button>
                    ) : (
                      <motion.div
                        key="delete-confirm"
                        initial={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        exit={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }
                        }
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1.5 px-1 py-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onDelete();
                            onClose();
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs text-center transition-colors cursor-pointer shadow-xs"
                        >
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDeleting(false)}
                          className="py-1.5 px-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
