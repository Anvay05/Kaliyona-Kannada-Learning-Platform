/**
 * MODULE 1 — EARS (anna-ears.ts)
 * Push-to-talk speech-to-text with 3-tier automatic fallback chain:
 *   1. Gemini Transcribe Live (WebSocket 16kHz mono PCM via AudioWorklet)
 *   2. webkitSpeechRecognition / SpeechRecognition (kn-IN -> en-IN)
 *   3. Plain text input box (by resolving null on any error/timeout/unsupported browser)
 *
 * PUSH-TO-TALK ONLY. No always-on VAD. Never throws to UI.
 */

import {
  VOICE_CONFIG,
  addDailyVoiceSeconds,
  isDailyMinutesCapReached,
} from './voiceConfig';

export interface PushToTalkController {
  /** Stops recording immediately and resolves the final transcript (or null if fallback to text input is needed). */
  stop: () => Promise<string | null>;
  /** Aborts recording without returning a transcript. */
  cancel: () => void;
}

export interface StartPushToTalkOptions {
  /** Receives live partial transcripts for a real-time caption effect. */
  onPartial?: (partialText: string) => void;
  /** Called if the 15s MAX_RECORD_SECONDS cap triggers an automatic release. */
  onAutoStop?: (finalTranscript: string | null) => void;
  /** Optional target phrase hint (used in MOCK_MODE when practicing a specific speak exercise). */
  targetHint?: string;
}

const MOCK_ROTATING_TRANSCRIPTS = [
  'Namaskara Anna, Majestic bartira?',
  'Meter haaku sir, UPI ideya?',
  'Ivattu tumba bisi ide, traffic jaasti!',
  'Nanage masala dose mattu coffee ishta.',
  'Illi signal hatra nillisi anna.',
  'Oota aayta guru? Kannada sulabha!',
  'Dhanyavada anna, hogbittu bartini!',
];

let mockTranscriptIndex = 0;

/**
 * Inline AudioWorklet processor source that downsamples/converts Float32 audio frames
 * into 16-bit PCM little-endian buffers and posts them to the main thread.
 */
const PCM16_WORKLET_CODE = `
class Pcm16CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const channelData = input[0];
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm16-capture-processor', Pcm16CaptureProcessor);
`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBrowserSpeechRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechRecognition ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/**
 * Starts a push-to-talk capture session.
 * Press = start stream, release = call controller.stop() to stop & get final transcript.
 * Automatically enforces VOICE_CONFIG.MAX_RECORD_SECONDS (15s cap).
 */
export async function startAnnaEarsPushToTalk(
  options: StartPushToTalkOptions = {}
): Promise<PushToTalkController | null> {
  const { onPartial, onAutoStop, targetHint } = options;

  if (isDailyMinutesCapReached()) {
    console.warn('[anna-ears] Daily voice minutes cap reached.');
    return null;
  }

  const startedAtMs = Date.now();

  // =========================================================================
  // MOCK_MODE = true: Zero network, zero mic permission required
  // =========================================================================
  if (VOICE_CONFIG.MOCK_MODE) {
    const chosenTranscript = targetHint
      ? targetHint
      : MOCK_ROTATING_TRANSCRIPTS[
          mockTranscriptIndex++ % MOCK_ROTATING_TRANSCRIPTS.length
        ];

    const words = chosenTranscript.split(' ');
    let step = 0;
    const partialInterval = window.setInterval(() => {
      step = Math.min(words.length, step + 1);
      onPartial?.(words.slice(0, step).join(' '));
    }, 180);

    let stopped = false;
    const stopMock = async (): Promise<string | null> => {
      if (stopped) return chosenTranscript;
      stopped = true;
      window.clearInterval(partialInterval);
      window.clearTimeout(autoStopTimer);
      const elapsedSec = Math.max(1, (Date.now() - startedAtMs) / 1000);
      addDailyVoiceSeconds(elapsedSec);
      onPartial?.(chosenTranscript);
      return chosenTranscript;
    };

    const autoStopTimer = window.setTimeout(async () => {
      if (!stopped) {
        const final = await stopMock();
        onAutoStop?.(final);
      }
    }, VOICE_CONFIG.MAX_RECORD_SECONDS * 1000);

    return {
      stop: stopMock,
      cancel: () => {
        stopped = true;
        window.clearInterval(partialInterval);
        window.clearTimeout(autoStopTimer);
      },
    };
  }

  // =========================================================================
  // REAL MODE: Tier 1 (Gemini Transcribe Live WebSocket + 16kHz PCM)
  //            + Tier 2 (webkitSpeechRecognition fallback)
  // =========================================================================
  let mediaStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;
  let ws: WebSocket | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browserRecognition: any = null;

  let wsTranscript = '';
  let srFinalTranscript = '';
  let srInterimTranscript = '';
  let isStopped = false;

  const getBestCurrentTranscript = (): string => {
    if (wsTranscript.trim()) return wsTranscript.trim();
    const srCombined = `${srFinalTranscript} ${srInterimTranscript}`.trim();
    return srCombined;
  };

  // Start Tier 2 (webkitSpeechRecognition) in parallel so live captions work
  // immediately and act as an instant fallback if WebSocket is unavailable
  const SpeechRecognitionCtor = getBrowserSpeechRecognitionCtor();
  if (SpeechRecognitionCtor) {
    try {
      browserRecognition = new SpeechRecognitionCtor();
      browserRecognition.lang = 'kn-IN';
      browserRecognition.continuous = true;
      browserRecognition.interimResults = true;
      browserRecognition.maxAlternatives = 3;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      browserRecognition.onresult = (event: any) => {
        if (isStopped) return;
        let finalChunk = '';
        let interimChunk = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalChunk += `${text} `;
          } else {
            interimChunk += `${text} `;
          }
        }
        srFinalTranscript = finalChunk.trim();
        srInterimTranscript = interimChunk.trim();
        const currentBest = getBestCurrentTranscript();
        if (currentBest) {
          onPartial?.(currentBest);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      browserRecognition.onerror = (ev: any) => {
        console.warn(
          '[anna-ears] webkitSpeechRecognition warning:',
          ev?.error || 'unknown'
        );
      };

      browserRecognition.start();
    } catch (err) {
      console.warn('[anna-ears] Could not start webkitSpeechRecognition:', err);
      browserRecognition = null;
    }
  }

  // Start Tier 1: getUserMedia (echoCancellation + noiseSuppression) + 16kHz mono PCM + WebSocket
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      const AudioContextCtor =
        window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext;
      audioCtx = new AudioContextCtor({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(mediaStream);

      // Connect to Gemini Transcribe Live WebSocket bridge
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const keyParam =
        VOICE_CONFIG.GEMINI_API_KEY &&
        VOICE_CONFIG.GEMINI_API_KEY !== 'PASTE_KEY_HERE'
          ? `&key=${encodeURIComponent(VOICE_CONFIG.GEMINI_API_KEY)}`
          : '';
      const wsUrl = `${protocol}//${window.location.host}/api/anna/live-transcribe?model=${encodeURIComponent(
        VOICE_CONFIG.TRANSCRIBE_MODEL
      )}${keyParam}`;

      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        if (isStopped) return;
        try {
          const msg = JSON.parse(event.data);
          if (
            (msg.type === 'partial' || msg.type === 'final') &&
            typeof msg.transcript === 'string' &&
            msg.transcript.trim()
          ) {
            wsTranscript = msg.transcript.trim();
            onPartial?.(wsTranscript);
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onerror = () => {
        console.warn(
          '[anna-ears] Gemini Transcribe Live WebSocket unavailable; using webkitSpeechRecognition fallback.'
        );
      };

      const sendPcmBuffer = (pcmBuffer: ArrayBuffer) => {
        if (ws && ws.readyState === WebSocket.OPEN && !isStopped) {
          const base64Audio = arrayBufferToBase64(pcmBuffer);
          ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
        }
      };

      // Prefer AudioWorklet for 16kHz mono PCM conversion
      if (audioCtx.audioWorklet) {
        try {
          const blob = new Blob([PCM16_WORKLET_CODE], {
            type: 'application/javascript',
          });
          const workletUrl = URL.createObjectURL(blob);
          await audioCtx.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          workletNode = new AudioWorkletNode(
            audioCtx,
            'pcm16-capture-processor'
          );
          workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
            sendPcmBuffer(e.data);
          };
          source.connect(workletNode);
          workletNode.connect(audioCtx.destination);
        } catch {
          // Fallback to ScriptProcessorNode if AudioWorklet is blocked by CSP
          scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const channelData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
              const s = Math.max(-1, Math.min(1, channelData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            sendPcmBuffer(pcm16.buffer);
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(audioCtx.destination);
        }
      }
    }
  } catch (err) {
    console.warn('[anna-ears] Microphone capture failed or denied:', err);
    if (!browserRecognition) {
      return null;
    }
  }

  // If neither mic stream nor browser speech recognition started, resolve null
  if (!mediaStream && !browserRecognition) {
    console.warn(
      '[anna-ears] Neither Gemini Live stream nor webkitSpeechRecognition available; falling back to text input.'
    );
    return null;
  }

  const cleanupHardware = () => {
    if (workletNode) {
      try {
        workletNode.disconnect();
      } catch {
        // Ignore
      }
      workletNode = null;
    }
    if (scriptProcessor) {
      try {
        scriptProcessor.disconnect();
      } catch {
        // Ignore
      }
      scriptProcessor = null;
    }
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch {
        // Ignore
      }
      audioCtx = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore
      }
      mediaStream = null;
    }
    if (browserRecognition) {
      try {
        browserRecognition.stop();
      } catch {
        // Ignore
      }
      browserRecognition = null;
    }
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stop' }));
        }
        ws.close();
      } catch {
        // Ignore
      }
      ws = null;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (isStopped) {
      return getBestCurrentTranscript() || null;
    }
    isStopped = true;
    window.clearTimeout(autoStopTimer);

    const elapsedSec = Math.max(1, (Date.now() - startedAtMs) / 1000);
    addDailyVoiceSeconds(elapsedSec);

    // Give recognition / WebSocket 250ms to flush the final words before closing
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'stop' }));
      } catch {
        // Ignore
      }
    }
    if (browserRecognition) {
      try {
        browserRecognition.stop();
      } catch {
        // Ignore
      }
    }

    await new Promise((r) => setTimeout(r, 260));
    const finalTranscript = getBestCurrentTranscript();
    cleanupHardware();

    return finalTranscript.length > 0 ? finalTranscript : null;
  };

  // Enforce MAX_RECORD_SECONDS (15s) auto-release cap
  const autoStopTimer = window.setTimeout(async () => {
    if (!isStopped) {
      const finalTranscript = await stopRecording();
      onAutoStop?.(finalTranscript);
    }
  }, VOICE_CONFIG.MAX_RECORD_SECONDS * 1000);

  return {
    stop: stopRecording,
    cancel: () => {
      isStopped = true;
      window.clearTimeout(autoStopTimer);
      cleanupHardware();
    },
  };
}
