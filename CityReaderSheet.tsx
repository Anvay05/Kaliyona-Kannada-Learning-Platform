'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Camera,
  ScanLine,
  ChevronRight,
  WifiOff,
  MessageCircle,
} from 'lucide-react';
import { GuidedGallery } from './GuidedGallery';
import { LiveCapture } from './LiveCapture';
import { hasGeminiApiKey } from './gemini';
import { stopReaderTts } from './tts';
import { playTactileTone } from './kanglishData';
import { STRINGS } from './i18n';

export type ReaderMode = 'picker' | 'guided' | 'capture';

export interface CityReaderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRoleplayWithWord?: (word: {
    kn: string;
    translit: string;
    en: string;
  }) => void;
}

export const CityReaderSheet: React.FC<CityReaderSheetProps> = ({
  isOpen,
  onClose,
  onOpenRoleplayWithWord,
}) => {
  const reduce = useReducedMotion() ?? false;
  const [mode, setMode] = useState<ReaderMode>('picker');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMode('picker');
      stopReaderTts();
    } else if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine !== false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopReaderTts();
    };
  }, []);

  const handleBack = () => {
    playTactileTone('tap');
    stopReaderTts();
    if (mode !== 'picker') {
      setMode('picker');
      return;
    }
    onClose();
  };

  const handleOpenRoleplayDirect = () => {
    playTactileTone('tap');
    stopReaderTts();
    if (onOpenRoleplayWithWord) {
      onOpenRoleplayWithWord({
        kn: 'ಮಸಾಲೆ ದೋಸೆ',
        translit: 'masale dose',
        en: 'Masala Dosa',
      });
      return;
    }
    onClose();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kaliyona:open-anna'));
    }
  };

  const handleSwitchToGuided = () => {
    playTactileTone('tap');
    stopReaderTts();
    setMode('guided');
  };

  const isReaderOnlineAvailable = isOnline && hasGeminiApiKey();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="city-reader-sheet"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          transition={
            reduce
              ? { duration: 0.1 }
              : { type: 'spring', stiffness: 380, damping: 32 }
          }
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#f6f5fc] text-neutral-900"
        >
          {/* Decorative off-canvas radial blobs for glassmorphism */}
          <div aria-hidden="true" className="app-glass-canvas-bg" />

          {/* Sticky Top Bar */}
          <header className="glass-strong !rounded-none !border-x-0 !border-t-0 sticky top-0 z-30 px-4 py-3">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Back"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-neutral-200 bg-white/85 text-neutral-800 transition-colors hover:bg-white active:scale-95"
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="min-w-0">
                  <h1 className="truncate text-base sm:text-lg font-extrabold tracking-tight text-neutral-900">
                    City Reader
                  </h1>
                  <p className="truncate text-xs font-medium text-neutral-500">
                    Kannada padho, tap karke samjho
                  </p>
                </div>
              </div>

              {/* Quick mode toggle when inside a sub-mode */}
              {mode !== 'picker' && (
                <div className="glass-soft !rounded-xl flex items-center gap-1 p-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleSwitchToGuided}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      mode === 'guided'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playTactileTone('tap');
                      stopReaderTts();
                      setMode('capture');
                    }}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      mode === 'capture'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Live Scan
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Main Reader Body */}
          <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pt-5 mobile-shell-content">
            {mode === 'picker' && (
              <div className="space-y-4">
                <div className="space-y-1 px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                    CHOOSE HOW TO READ
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                    Decode Bengaluru street Kannada
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-500">
                    Tap words on real Bengaluru boards or scan any signboard with Gemini Vision.
                  </p>
                </div>

                {/* Compact Offline / Missing-Key Notice Card when unavailable */}
                {!isReaderOnlineAvailable && (
                  <div
                    role="status"
                    className="glass-tinted p-4 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <WifiOff size={20} />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-neutral-900 leading-snug">
                        {STRINGS.reader.offlineNotice}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-13">
                      <button
                        type="button"
                        onClick={handleSwitchToGuided}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition-transform active:scale-95"
                      >
                        <Camera size={14} />
                        <span>{STRINGS.reader.guidedGalleryButton}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenRoleplayDirect}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-800 transition-colors hover:border-primary"
                      >
                        <MessageCircle size={14} />
                        <span>{STRINGS.reader.roleplayButton}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Two Big Mode Picker Cards with Staggered Spring */}
                <div className="grid grid-cols-1 gap-4 pt-1">
                  {/* Card 1: Explore Bengaluru (Guided Gallery) */}
                  <motion.button
                    type="button"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={
                      reduce
                        ? { duration: 0.1 }
                        : {
                            type: 'spring',
                            stiffness: 380,
                            damping: 28,
                            delay: 0.03,
                          }
                    }
                    onClick={handleSwitchToGuided}
                    className="glass-strong !border-2 !border-primary group flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left transition-all"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
                        <Camera size={26} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                          6 real spots • 100% offline
                        </span>
                        <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900">
                          Explore Bengaluru
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-500">
                          Guided gallery of darshini menus, BMTC bus boards, Namma Metro &amp; street signs.
                        </p>
                      </div>
                    </div>

                    <ChevronRight
                      size={22}
                      className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                    />
                  </motion.button>

                  {/* Card 2: Scan your own (Live Capture) */}
                  <motion.button
                    type="button"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={
                      reduce
                        ? { duration: 0.1 }
                        : {
                            type: 'spring',
                            stiffness: 380,
                            damping: 28,
                            delay: 0.09,
                          }
                    }
                    onClick={() => {
                      playTactileTone('tap');
                      setMode('capture');
                    }}
                    className="glass-soft glass-interactive group flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left transition-all"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white/85 text-neutral-800">
                        <ScanLine size={26} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <span className="inline-block rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600">
                          Gemini Vision • online
                        </span>
                        <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900">
                          Scan your own
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-500">
                          Snap or upload any photo — instant Kannada detection &amp; in-place translations.
                        </p>
                      </div>
                    </div>

                    <ChevronRight
                      size={22}
                      className="shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </motion.button>
                </div>
              </div>
            )}

            {mode === 'guided' && (
              <GuidedGallery
                onOpenRoleplayWithWord={onOpenRoleplayWithWord}
              />
            )}

            {mode === 'capture' && (
              <LiveCapture
                onOpenRoleplayWithWord={onOpenRoleplayWithWord}
                onSwitchToGuided={handleSwitchToGuided}
                onOpenRoleplay={handleOpenRoleplayDirect}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
