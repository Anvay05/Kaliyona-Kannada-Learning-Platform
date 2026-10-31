import React, { useEffect, useRef, useState, useCallback } from 'react';

export type OrbState = 'idle' | 'thinking' | 'speaking' | 'success';

export interface AnnaOrbProps {
  size?: number; // default 120
  state?: OrbState; // 'idle' | 'thinking' | 'speaking' | 'success'
  color?: string; // base color, default theme primary hex #6C5CE7
  pulseTrigger?: number; // optional trigger to spike pulse on speech boundary
  onTap?: () => void;
  className?: string;
}

const STATE_CONFIG: Record<OrbState, { energy: number; defaultColor: string }> = {
  idle: { energy: 0.3, defaultColor: '#6C5CE7' },
  thinking: { energy: 0.55, defaultColor: '#F97316' },
  speaking: { energy: 0.9, defaultColor: '#0EA5E9' },
  success: { energy: 0.6, defaultColor: '#22C55E' },
};

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  let r = 0.42;
  let g = 0.36;
  let b = 0.91;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  }
  return [r, g, b];
}

const VERTEX_SHADER_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;
uniform float u_energy;
uniform float u_pulse;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * mix(0.14, 0.36, clamp(u_energy, 0.0, 1.0));
  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );
  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.28;
  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 0.55 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  // Calm knob: raise 0.32 toward 0.5 for more texture, lower toward 0.2
  // for near-flat gradient. Keep <= 0.5 for premium look.
  float shade = clamp(g + (f - 0.5) * 0.32 * anchor + u_pulse * 0.07, 0.0, 1.0);

  vec3 white = vec3(0.99, 1.0, 1.0);
  vec3 light = mix(white, u_color, 0.5);
  vec3 dark = u_color;
  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.58, 0.88, shade));

  float r = distance(uv, vec2(0.5)) * (1.0 - u_pulse * 0.035);
  float edge = smoothstep(0.5, 0.49, r);
  gl_FragColor = vec4(col * edge, edge);
}
`;

export const AnnaOrb: React.FC<AnnaOrbProps> = ({
  size = 120,
  state = 'idle',
  color,
  pulseTrigger,
  onTap,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [effectiveState, setEffectiveState] = useState<OrbState>(state);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Success auto-returns to idle after 1.2s
  useEffect(() => {
    if (state === 'success') {
      setEffectiveState('success');
      const timer = window.setTimeout(() => {
        setEffectiveState('idle');
      }, 1200);
      return () => window.clearTimeout(timer);
    } else {
      setEffectiveState(state);
    }
  }, [state]);

  // Reduced motion listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Compute current target hex color and energy
  const targetHex =
    effectiveState === 'idle'
      ? color || STATE_CONFIG.idle.defaultColor
      : STATE_CONFIG[effectiveState].defaultColor;

  const targetRGB = hexToRgb(targetHex);
  const targetEnergy = STATE_CONFIG[effectiveState].energy;

  // Refs for WebGL context & animation loop values
  const currentRGBRef = useRef<[number, number, number]>([...targetRGB]);
  const currentEnergyRef = useRef<number>(targetEnergy);
  const currentPulseRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Spike pulse on speaking transitions or boundary pulseTrigger
  const spikePulse = useCallback(() => {
    currentPulseRef.current = 1.0;
  }, []);

  const prevPulseTriggerRef = useRef(pulseTrigger);
  useEffect(() => {
    if (pulseTrigger !== undefined && pulseTrigger !== prevPulseTriggerRef.current) {
      prevPulseTriggerRef.current = pulseTrigger;
      spikePulse();
    }
  }, [pulseTrigger, spikePulse]);

  const prevStateRef = useRef(effectiveState);
  useEffect(() => {
    if (effectiveState === 'speaking' && prevStateRef.current !== 'speaking') {
      spikePulse();
    }
    prevStateRef.current = effectiveState;
  }, [effectiveState, spikePulse]);

  // WebGL Render Loop Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      setWebglSupported(false);
      return;
    }

    // Helper: compile shader
    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fragShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

    if (!vertShader || !fragShader) {
      setWebglSupported(false);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglSupported(false);
      return;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      setWebglSupported(false);
      return;
    }

    gl.useProgram(program);

    // Quad geometry covering NDC [-1, 1]
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uColorLoc = gl.getUniformLocation(program, 'u_color');
    const uEnergyLoc = gl.getUniformLocation(program, 'u_energy');
    const uPulseLoc = gl.getUniformLocation(program, 'u_pulse');

    // Transparent alpha blending setup
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // DPR setup (clamped to 2)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Render single frame
    const renderFrame = (timeSec: number) => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(uTimeLoc, timeSec);
      gl.uniform3f(
        uColorLoc,
        currentRGBRef.current[0],
        currentRGBRef.current[1],
        currentRGBRef.current[2]
      );
      gl.uniform1f(uEnergyLoc, currentEnergyRef.current);
      gl.uniform1f(uPulseLoc, currentPulseRef.current);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Reduced motion: draw one static frame and exit
    if (prefersReducedMotion) {
      currentRGBRef.current = [...targetRGB];
      currentEnergyRef.current = targetEnergy;
      currentPulseRef.current = 0;
      renderFrame(0);
      return () => {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
      };
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      totalTimeRef.current += dt;

      // 8% LERP toward target RGB
      currentRGBRef.current[0] += (targetRGB[0] - currentRGBRef.current[0]) * 0.08;
      currentRGBRef.current[1] += (targetRGB[1] - currentRGBRef.current[1]) * 0.08;
      currentRGBRef.current[2] += (targetRGB[2] - currentRGBRef.current[2]) * 0.08;

      // 8% LERP toward target Energy
      currentEnergyRef.current += (targetEnergy - currentEnergyRef.current) * 0.08;

      // Pulse decay (* 0.88)
      currentPulseRef.current *= 0.88;
      if (currentPulseRef.current < 0.001) {
        currentPulseRef.current = 0;
      }

      renderFrame(totalTimeRef.current);
      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    // Pause on document hidden to preserve battery
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
      } else {
        lastTimeRef.current = performance.now();
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(loop);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
    };
  }, [size, targetRGB, targetEnergy, prefersReducedMotion]);

  // WebGL Fallback View
  if (!webglSupported) {
    return (
      <button
        type="button"
        onClick={onTap}
        disabled={!onTap}
        aria-label="Hear Anna speak"
        className={`relative inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 select-none ${
          onTap ? 'cursor-pointer active:scale-95 transition-transform' : ''
        } ${className}`}
        style={{ width: size, height: size }}
      >
        <div
          className={`w-full h-full rounded-full ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{
            background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${targetHex} 62%, rgba(0,0,0,0.2) 100%)`,
            boxShadow: `0 8px 28px -4px ${targetHex}77`,
          }}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      aria-label="Hear Anna speak"
      className={`relative inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 select-none ${
        onTap ? 'cursor-pointer active:scale-95 transition-transform' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          pointerEvents: 'none',
        }}
        className="rounded-full"
      />
    </button>
  );
};

export default AnnaOrb;
