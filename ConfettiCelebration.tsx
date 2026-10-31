import React, { useEffect, useRef } from 'react';
import { hash32, mulberry32 } from './rng';

export const DEFAULT_CONFETTI_COLORS = [
  '#4F8CFF',
  '#22D3EE',
  '#34D399',
  '#FF9F2E',
  '#F5C518',
  '#F43F5E',
  '#A855F7',
  '#EDF2FC',
];

type ConfettiShape = 'ribbon' | 'circle' | 'star';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  shape: ConfettiShape;
  rotation: number;
  rotationSpeed: number;
  tilt: number;
  tiltAngle: number;
  tiltAngleIncrement: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  gravity: number;
  drag: number;
  bornAt: number;
  lifeMs: number;
}

export interface ConfettiCelebrationProps {
  active?: boolean;
  particleCount?: number;
  durationMs?: number;
  colors?: string[];
  intensity?: 'normal' | 'epic';
}

/**
 * Full-screen canvas + card-level confetti celebration component triggered
 * when a user completes a lesson in `LessonSessionEngine`.
 */
export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  active = true,
  particleCount = 96,
  durationMs = 4200,
  colors = DEFAULT_CONFETTI_COLORS,
  intensity = 'normal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    const burstTimers: ReturnType<typeof setTimeout>[] = [];
    const particles: Particle[] = [];
    const shapes: ConfettiShape[] = ['ribbon', 'ribbon', 'circle', 'star'];
    const rng = mulberry32(
      hash32(`confetti:${particleCount}:${durationMs}:${intensity}`)
    );

    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const spawnBurst = (
      originXRatio: number,
      originYRatio: number,
      count: number,
      angleCenterDeg: number,
      angleSpreadDeg: number,
      speedMin: number,
      speedMax: number
    ) => {
      const now = performance.now();
      const w = window.innerWidth;
      const h = window.innerHeight;
      const originX = w * originXRatio;
      const originY = h * originYRatio;

      for (let i = 0; i < count; i++) {
        const angleRad =
          ((angleCenterDeg + (rng() - 0.5) * angleSpreadDeg) *
            Math.PI) /
          180;
        const speed = speedMin + rng() * (speedMax - speedMin);
        const shape = shapes[Math.floor(rng() * shapes.length)];
        const color = colors[Math.floor(rng() * colors.length)];

        particles.push({
          x: originX + (rng() - 0.5) * 28,
          y: originY + (rng() - 0.5) * 20,
          vx: Math.cos(angleRad) * speed,
          vy: Math.sin(angleRad) * speed,
          width: 7 + rng() * 6,
          height: 11 + rng() * 8,
          color,
          shape,
          rotation: rng() * Math.PI * 2,
          rotationSpeed: (rng() - 0.5) * 0.22,
          tilt: rng() * 10,
          tiltAngle: rng() * Math.PI,
          tiltAngleIncrement: 0.06 + rng() * 0.08,
          wobble: rng() * Math.PI * 2,
          wobbleSpeed: 0.05 + rng() * 0.06,
          opacity: 1,
          gravity: 0.22 + rng() * 0.1,
          drag: 0.982,
          bornAt: now,
          lifeMs: durationMs * (0.72 + rng() * 0.35),
        });
      }
    };

    const totalBase = intensity === 'epic' ? Math.round(particleCount * 1.35) : particleCount;
    const sideCount = Math.max(18, Math.round(totalBase * 0.38));
    const centerCount = Math.max(20, Math.round(totalBase * 0.34));

    // Wave 1: Left & right celebratory cannons + top-center burst
    spawnBurst(0.14, 0.65, sideCount, -62, 48, 11, 21);
    spawnBurst(0.86, 0.65, sideCount, -118, 48, 11, 21);
    spawnBurst(0.5, 0.28, centerCount, -90, 120, 7, 16);

    // Wave 2: Secondary celebratory pop
    burstTimers.push(
      setTimeout(() => {
        spawnBurst(0.32, 0.35, Math.round(centerCount * 0.7), -80, 95, 8, 16);
        spawnBurst(0.68, 0.35, Math.round(centerCount * 0.7), -100, 95, 8, 16);
      }, 280)
    );

    // Wave 3: Extra golden/sparkle shower for epic / perfect completions
    if (intensity === 'epic') {
      burstTimers.push(
        setTimeout(() => {
          spawnBurst(0.5, 0.2, Math.round(centerCount * 0.85), -90, 140, 8, 17);
        }, 620)
      );
    }

    const drawStar = (
      context: CanvasRenderingContext2D,
      radius: number
    ) => {
      const spikes = 4;
      const outer = radius;
      const inner = radius * 0.42;
      context.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / spikes;
        if (i === 0) {
          context.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        } else {
          context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
      }
      context.closePath();
      context.fill();
    };

    const render = (now: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const age = now - p.bornAt;
        if (age >= p.lifeMs || p.y > h + 60) {
          particles.splice(i, 1);
          continue;
        }

        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 1.15;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.tiltAngle += p.tiltAngleIncrement;
        p.tilt = Math.sin(p.tiltAngle) * 12;

        const lifeProgress = age / p.lifeMs;
        p.opacity =
          lifeProgress > 0.72
            ? Math.max(0, 1 - (lifeProgress - 0.72) / 0.28)
            : 1;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.ellipse(
            0,
            0,
            p.width * 0.55,
            p.width * 0.55 * Math.max(0.25, Math.abs(Math.cos(p.tiltAngle))),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else if (p.shape === 'star') {
          drawStar(ctx, p.width * 0.75);
        } else {
          // 3D tumbling ribbon
          const scaleY = Math.cos(p.tiltAngle);
          ctx.scale(1, Math.abs(scaleY) < 0.18 ? 0.18 : scaleY);
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        }

        ctx.restore();
      }

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationFrameId);
      burstTimers.forEach(clearTimeout);
    };
  }, [active, particleCount, durationMs, colors, intensity]);

  if (!active) return null;

  return (
    <>
      {/* Full-viewport interactive-safe confetti canvas */}
      <canvas
        ref={canvasRef}
        data-testid="lesson-completion-confetti"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50"
      />
      {/* Card-top decorative confetti shimmer pieces */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden z-20"
        aria-hidden="true"
      >
        {Array.from({ length: 16 }).map((_, idx) => {
          const leftPct = 4 + idx * 6;
          const delayMs = (idx % 5) * 110;
          const bg = colors[idx % colors.length];
          return (
            <span
              key={idx}
              className="confetti-piece"
              style={{
                left: `${leftPct}%`,
                top: '-10px',
                backgroundColor: bg,
                animationDelay: `${delayMs}ms`,
              }}
            />
          );
        })}
      </div>
    </>
  );
};

export const ConfettiAnimation = ConfettiCelebration;
export default ConfettiCelebration;
