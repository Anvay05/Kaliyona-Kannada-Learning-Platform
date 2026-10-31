import React, { useState, useEffect, useRef } from 'react';
import { playAnnaMascotPing } from './kanglishData';

export type AnnaMascotState =
  | 'idle'
  | 'happy'
  | 'celebrate'
  | 'thinking'
  | 'wrong'
  | 'speaking'
  | 'listening';

export type AnnaMouthState = 'closed' | 'half' | 'open';

export type AnnaMascotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

interface AnnaMascotProps {
  state?: AnnaMascotState;
  size?: AnnaMascotSize;
  variant?: 'avatar' | 'full';
  mouthState?: AnnaMouthState;
  className?: string;
  title?: string;
  animate?: boolean;
}

const SIZE_MAP: Record<Exclude<AnnaMascotSize, number>, number> = {
  xs: 28,
  sm: 36,
  md: 56,
  lg: 88,
  xl: 128,
};

export const ANNA_ASSETS = {
  avatar: '/anna-avatar.webp',
  front: '/anna-front.webp',
  front512: '/anna-front-512.webp',
  front1024: '/anna-front-1024.webp',
  full: '/anna-full.webp',
  mouthClosed: '/mouth-closed.webp',
  mouthHalf: '/mouth-half.webp',
  mouthOpen: '/mouth-open.webp',
} as const;

// Preload all tiger mascot frames once on module load in browser environments
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  Object.values(ANNA_ASSETS).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

/**
 * Bundled fallback SVG (original Auto-Rickshaw mascot).
 * Automatically swaps in silently if any image asset triggers onError.
 */
export const AutoRickshawFallbackSvg: React.FC<{
  state: AnnaMascotState;
  px: number;
  uid: string;
  animClass: string;
  title?: string;
}> = ({ state, px, uid, animClass, title }) => {
  const isHappy = state === 'happy' || state === 'celebrate';
  const isThinking = state === 'thinking';
  const isWrong = state === 'wrong';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isCelebrate = state === 'celebrate';

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`overflow-visible ${animClass}`}
      aria-hidden={!title}
    >
      <defs>
        <linearGradient id={`canopy-${uid}`} x1="80" y1="18" x2="80" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`bodyGold-${uid}`} x1="80" y1="68" x2="80" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="55%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id={`glass-${uid}`} x1="45" y1="54" x2="115" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="50%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
        <radialGradient id={`beamGlow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#FACC15" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FACC15" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`chrome-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
      </defs>

      <ellipse cx="80" cy="147" rx="52" ry="7" fill="#050814" fillOpacity="0.45" />

      {isCelebrate && (
        <g className="anna-confetti-layer">
          <circle cx="22" cy="34" r="4.5" fill="#F43F5E" className="anna-particle p1" />
          <circle cx="138" cy="30" r="5" fill="#22D3EE" className="anna-particle p2" />
          <rect x="14" y="68" width="7" height="7" rx="2" transform="rotate(-20 14 68)" fill="#FACC15" className="anna-particle p3" />
          <rect x="138" y="66" width="7" height="7" rx="2" transform="rotate(25 138 66)" fill="#A855F7" className="anna-particle p4" />
          <path d="M34 16 L36 22 L42 24 L36 26 L34 32 L32 26 L26 24 L32 22 Z" fill="#FDE047" className="anna-particle p5" />
          <path d="M126 14 L128 20 L134 22 L128 24 L126 30 L124 24 L118 22 L124 20 Z" fill="#34D399" className="anna-particle p6" />
        </g>
      )}

      {isThinking && (
        <g className="anna-thought-bubble">
          <circle cx="128" cy="36" r="3" fill="#BAE6FD" opacity="0.85" />
          <circle cx="135" cy="27" r="4.5" fill="#BAE6FD" opacity="0.9" />
          <g transform="translate(126, 4)">
            <rect x="0" y="0" width="24" height="20" rx="10" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="2" />
            <text x="12" y="14.5" textAnchor="middle" fill="#0284C7" fontSize="13" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">
              ?
            </text>
          </g>
        </g>
      )}

      {isListening && (
        <g className="anna-sound-waves" stroke="#22D3EE" strokeWidth="2.8" strokeLinecap="round" fill="none">
          <path d="M140 72 C145 77, 145 87, 140 92" className="anna-wave-1" />
          <path d="M146 66 C154 74, 154 90, 146 98" className="anna-wave-2" />
        </g>
      )}

      <g className={isListening ? 'anna-glowing-mirror' : ''}>
        <path d="M35 76 L20 68" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
        <ellipse cx="17" cy="67" rx="6.5" ry="9" transform="rotate(-15 17 67)" fill={`url(#chrome-${uid})`} stroke="#1E293B" strokeWidth="2" />
        <path d="M125 76 L140 68" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
        <ellipse
          cx="143"
          cy="67"
          rx="6.5"
          ry="9"
          transform={isListening ? 'rotate(24 143 67) scale(1.08)' : 'rotate(15 143 67)'}
          fill={isListening ? '#FEF08A' : `url(#chrome-${uid})`}
          stroke={isListening ? '#F59E0B' : '#1E293B'}
          strokeWidth="2"
        />
      </g>

      <g>
        <rect x="26" y="118" width="16" height="24" rx="7" fill="#0F172A" stroke="#334155" strokeWidth="2" />
        <circle cx="34" cy="130" r="4" fill="#94A3B8" />
        <rect x="118" y="118" width="16" height="24" rx="7" fill="#0F172A" stroke="#334155" strokeWidth="2" />
        <circle cx="126" cy="130" r="4" fill="#94A3B8" />
      </g>

      <path
        d="M36 54 C36 28, 54 18, 80 18 C106 18, 124 28, 124 54 L128 60 C128 63, 125 65, 122 65 L38 65 C35 65, 32 63, 32 60 Z"
        fill={`url(#canopy-${uid})`}
        stroke="#064E3B"
        strokeWidth="2.5"
      />
      <path d="M48 34 C60 24, 100 24, 112 34" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" opacity="0.65" />

      <g>
        {[42, 54, 66, 78, 90, 102, 114].map((xPos, i) => (
          <circle key={xPos} cx={xPos} cy="64" r="3.5" fill={i % 2 === 0 ? '#FACC15' : '#FB7185'} stroke="#064E3B" strokeWidth="1" />
        ))}
      </g>

      <g>
        <rect x="58" y="34" width="44" height="15" rx="5" fill="#0F172A" stroke="#FACC15" strokeWidth="1.8" />
        <text x="80" y="44.5" textAnchor="middle" fill="#FDE047" fontSize="8.5" fontWeight="700" fontFamily="Plus Jakarta Sans, Noto Sans Kannada, sans-serif" letterSpacing="0.5">
          ನಮಸ್ಕಾರ
        </text>
      </g>

      <path d="M36 63 L31 94 L129 94 L124 63 Z" fill="#065F46" stroke="#064E3B" strokeWidth="2.5" />

      <path d="M39 62 L121 62 L125 91 C125 94, 122 96, 119 96 L41 96 C38 96, 35 94, 35 91 Z" fill={`url(#glass-${uid})`} stroke="#0F172A" strokeWidth="2.8" />

      <g>
        {isHappy ? (
          <>
            <path d="M51 80 C55 71, 65 71, 69 80" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M91 80 C95 71, 105 71, 109 80" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <ellipse cx="60" cy="79" rx="9.5" ry={isWrong ? 8.5 : 10} fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
            <circle cx={isThinking ? 62 : isListening ? 63 : 61} cy={isThinking ? 76 : 79} r="5.5" fill="#0F172A" />
            <circle cx={isThinking ? 64 : 63} cy={isThinking ? 74 : 76.5} r="2.2" fill="#FFFFFF" />
            <ellipse cx="100" cy="79" rx="9.5" ry={isWrong ? 8.5 : 10} fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
            <circle cx={isThinking ? 102 : isListening ? 103 : 101} cy={isThinking ? 76 : 79} r="5.5" fill="#0F172A" />
            <circle cx={isThinking ? 104 : 103} cy={isThinking ? 74 : 76.5} r="2.2" fill="#FFFFFF" />
          </>
        )}

        <ellipse cx="47" cy="87" rx="4.5" ry="2.5" fill="#FB7185" opacity={isHappy ? 0.65 : 0.4} />
        <ellipse cx="113" cy="87" rx="4.5" ry="2.5" fill="#FB7185" opacity={isHappy ? 0.65 : 0.4} />
      </g>

      <path d="M29 94 C29 91, 32 89, 36 89 L124 89 C128 89, 131 91, 131 94 L134 122 C134 128, 129 132, 122 132 L38 132 C31 132, 26 128, 26 122 Z" fill={`url(#bodyGold-${uid})`} stroke="#78350F" strokeWidth="2.6" />

      <g>
        <circle cx="44" cy="109" r="10" fill="#1E293B" stroke={`url(#chrome-${uid})`} strokeWidth="2.5" />
        <circle cx="44" cy="109" r="7" fill={isHappy || isSpeaking ? '#FEF08A' : '#FDE047'} />
        <circle cx="116" cy="109" r="10" fill="#1E293B" stroke={`url(#chrome-${uid})`} strokeWidth="2.5" />
        <circle cx="116" cy="109" r="7" fill={isHappy || isSpeaking ? '#FEF08A' : '#FDE047'} />
      </g>

      <g className={isSpeaking ? 'anna-speaking-mouth' : ''}>
        {isHappy ? (
          <g>
            <path d="M65 103 C70 116, 90 116, 95 103 Z" fill="#7F1D1D" stroke="#451A03" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M72 109 C76 113, 84 113, 88 109" stroke="#FB7185" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ) : (
          <path d="M67 104 C73 111, 87 111, 93 104" stroke="#451A03" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        )}
      </g>

      <g>
        <path d="M66 126 C66 116, 94 116, 94 126 L96 135 L64 135 Z" fill="#059669" stroke="#064E3B" strokeWidth="2.2" />
        <rect x="71" y="124" width="18" height="24" rx="9" fill="#0F172A" stroke="#334155" strokeWidth="2.4" />
        <circle cx="80" cy="136" r="4.5" fill="#E2E8F0" />
      </g>
    </svg>
  );
};

/**
 * AnnaMascot — Cute Chibi Tiger Cub ("Anna") across the entire Kanglish app.
 * - Supports 7 states: idle, happy, celebrate, thinking, wrong, speaking, listening
 * - Supports variant="avatar" (circle/compact head-and-shoulders) and variant="full" (full standing body)
 * - Supports 3 lip-sync mouth states: 'closed' | 'half' | 'open'
 * - Includes automatic silent fallback to AutoRickshawFallbackSvg on image load error
 */
export const AnnaMascot: React.FC<AnnaMascotProps> = ({
  state = 'idle',
  size = 'md',
  variant = 'avatar',
  mouthState,
  className = '',
  title,
  animate = true,
}) => {
  const [imgError, setImgError] = useState(false);
  const px = typeof size === 'number' ? size : SIZE_MAP[size] || 56;
  const uid = React.useId().replace(/:/g, '');

  const isHappy = state === 'happy' || state === 'celebrate';
  const isThinking = state === 'thinking';
  const isWrong = state === 'wrong';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isCelebrate = state === 'celebrate';

  // Determine effective mouth frame when rendering full-body or speaking states
  const resolvedMouth: AnnaMouthState =
    mouthState ??
    (isSpeaking
      ? 'open'
      : isHappy
      ? 'open'
      : isThinking || isWrong
      ? 'half'
      : 'closed');

  const animClass = animate ? `anna-anim-${state}` : '';
  const prevStateRef = useRef<AnnaMascotState>(state);

  // Play subtle Web Audio ping whenever an Anna mascot animation state is triggered
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (state !== 'idle' && (prev !== state || animate)) {
      playAnnaMascotPing();
    }
  }, [state, animate]);

  // Reset error if variant changes
  useEffect(() => {
    setImgError(false);
  }, [variant]);

  if (imgError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
        style={{ width: px, height: px }}
        role={title ? 'img' : 'presentation'}
        aria-label={title || `Anna mascot (${state})`}
      >
        <AutoRickshawFallbackSvg
          state={state}
          px={px}
          uid={uid}
          animClass={animClass}
          title={title}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${animClass} ${className}`}
      style={{ width: px, height: px }}
      role={title ? 'img' : 'presentation'}
      aria-label={title || `Anna the tiger cub (${state})`}
    >
      {/* ================================================================= */}
      {/* TIGER CHARACTER IMAGE (Avatar Crop or Full-Body 3-Frame Lip-Sync) */}
      {/* ================================================================= */}
      {variant === 'full' ? (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Permanent 100% opaque base frame so the character body never blinks or ghosts during frame switches */}
          <img
            src={ANNA_ASSETS.mouthClosed}
            alt={title || 'Anna tiger mascot'}
            onError={() => setImgError(true)}
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-100"
          />
          <img
            src={ANNA_ASSETS.mouthHalf}
            alt=""
            aria-hidden="true"
            onError={() => setImgError(true)}
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
              resolvedMouth === 'half' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <img
            src={ANNA_ASSETS.mouthOpen}
            alt=""
            aria-hidden="true"
            onError={() => setImgError(true)}
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
              resolvedMouth === 'open' ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      ) : (
        <img
          src={ANNA_ASSETS.avatar}
          alt={title || 'Anna tiger avatar'}
          onError={() => setImgError(true)}
          draggable={false}
          className="w-full h-full object-contain pointer-events-none"
        />
      )}

      {/* ================================================================= */}
      {/* STATE OVERLAYS (Confetti, Thinking ?, Listening Waves, Speaking)  */}
      {/* ================================================================= */}
      {isCelebrate && px >= 40 && (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          aria-hidden="true"
        >
          <circle cx="10" cy="18" r="3.5" fill="#F43F5E" className="anna-particle p1" />
          <circle cx="90" cy="16" r="4" fill="#22D3EE" className="anna-particle p2" />
          <circle cx="8" cy="52" r="3" fill="#FACC15" className="anna-particle p3" />
          <circle cx="92" cy="50" r="3.5" fill="#A855F7" className="anna-particle p4" />
          <path
            d="M20 6 L22 11 L27 13 L22 15 L20 20 L18 15 L13 13 L18 11 Z"
            fill="#FDE047"
            className="anna-particle p5"
          />
          <path
            d="M82 5 L84 10 L89 12 L84 14 L82 19 L80 14 L75 12 L80 10 Z"
            fill="#00B894"
            className="anna-particle p6"
          />
        </svg>
      )}

      {isThinking && px >= 30 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-surface-container-lowest border border-primary text-primary font-display font-extrabold leading-none shadow-xs pointer-events-none animate-bounce"
          style={{ fontSize: Math.max(9, Math.round(px * 0.22)) }}
        >
          ?
        </span>
      )}

      {isListening && px >= 32 && (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          aria-hidden="true"
        >
          <path
            d="M90 36 C96 42, 96 54, 90 60"
            stroke="#5341cd"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            className="anna-wave-1"
          />
          <path
            d="M96 30 C104 38, 104 58, 96 66"
            stroke="#6c5ce7"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            className="anna-wave-2"
          />
        </svg>
      )}
    </div>
  );
};

export default AnnaMascot;
