import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AtSign, Send, Mic, MicOff } from 'lucide-react';

export interface Persona {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface Mention {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface MentionValue {
  text: string;
  mentions: Mention[];
}

export interface AnnaComposerProps {
  value: MentionValue;
  onChange: (value: MentionValue, addedMention?: Mention) => void;
  onSend: (cleanedText: string, mentions?: Mention[], rawText?: string) => void;
  personas: Persona[];
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  className?: string;
}

interface TriggerMatch {
  open: boolean;
  query: string;
  triggerIndex: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || 'A').toUpperCase();
}

/**
 * Shared font and metrics styles to ensure 100% caret & glyph parity
 * between the backdrop mirror and the transparent textarea.
 */
const sharedEditorStyles: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '15px',
  lineHeight: '24px',
  fontWeight: 400,
  fontVariantLigatures: 'none',
  fontKerning: 'normal',
  letterSpacing: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  whiteSpace: 'pre-wrap',
  boxSizing: 'border-box',
};

/**
 * Strips '@Name' mention tokens from text for reply engine evaluation.
 */
export function stripMentionTokens(text: string, mentions: Mention[]): string {
  if (!mentions.length) {
    return text.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();
  }
  let cleaned = text;
  const sorted = [...mentions].sort((a, b) => b.startIndex - a.startIndex);
  for (const m of sorted) {
    cleaned = cleaned.slice(0, m.startIndex) + cleaned.slice(m.endIndex);
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

const SEND_BUTTON_CSS = `
@keyframes kaliyona-fly {
  from { transform: translateY(0.1em); }
  to   { transform: translateY(-0.1em); }
}
.group\\/send:not(:disabled):hover .svg-float-wrapper,
.group\\/send:not(:disabled):active .svg-float-wrapper {
  animation: kaliyona-fly 0.6s ease-in-out infinite alternate;
}
/* touch fallback: active state also triggers the plane fly */
.group\\/send:not(:disabled):active svg {
  transform: translateX(1.2em) rotate(45deg) scale(1.1);
}
.group\\/send:not(:disabled):active span:not(.svg-float-wrapper) {
  transform: translateX(5em);
}
.group\\/send:disabled .svg-float-wrapper {
  animation: none !important;
}
.group\\/send:disabled svg,
.group\\/send:disabled span:not(.svg-float-wrapper) {
  transform: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .svg-float-wrapper { animation: none !important; }
  .group\\/send:hover svg,
  .group\\/send:active svg { transform: none !important; }
  .group\\/send:hover span:not(.svg-float-wrapper),
  .group\\/send:active span:not(.svg-float-wrapper) { transform: none !important; }
}
`;

export const AnnaComposer: React.FC<AnnaComposerProps> = ({
  value,
  onChange,
  onSend,
  personas,
  placeholder = 'Reply in Kanglish…',
  disabled = false,
  isSending = false,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [triggerState, setTriggerState] = useState<TriggerMatch>({
    open: false,
    query: '',
    triggerIndex: -1,
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Web Speech API state
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [micToast, setMicToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const dictationBaseTextRef = useRef<string>('');

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Filter personas based on current query
  const filteredPersonas = useMemo(() => {
    if (!triggerState.open) return [];
    const q = triggerState.query.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [triggerState.open, triggerState.query, personas]);

  // Keep selected index within range
  useEffect(() => {
    if (selectedIndex >= filteredPersonas.length) {
      setSelectedIndex(Math.max(0, filteredPersonas.length - 1));
    }
  }, [filteredPersonas.length, selectedIndex]);

  // Auto-grow textarea cleanly: strictly 36px when empty, up to 88px when typing
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value.text) {
      el.style.height = '36px';
      return;
    }
    el.style.height = '36px';
    const nextH = Math.min(Math.max(el.scrollHeight, 36), 88);
    el.style.height = `${nextH}px`;
  }, [value.text]);

  // Detect "@" trigger from cursor position
  const evaluateTrigger = useCallback((text: string, cursor: number) => {
    const textBeforeCursor = text.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) {
      setTriggerState({ open: false, query: '', triggerIndex: -1 });
      return;
    }
    const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
    if (!/\s/.test(charBeforeAt)) {
      setTriggerState({ open: false, query: '', triggerIndex: -1 });
      return;
    }
    const query = textBeforeCursor.slice(atIndex + 1);
    if (/\n/.test(query) || (query.length > 20 && !query.includes(' '))) {
      setTriggerState({ open: false, query: '', triggerIndex: -1 });
      return;
    }
    setTriggerState({
      open: true,
      query,
      triggerIndex: atIndex,
    });
    setSelectedIndex(0);
  }, []);

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;

    // Reconcile existing mentions with text length changes
    const diff = newText.length - value.text.length;
    let reconciledMentions: Mention[] = [];

    for (const m of value.mentions) {
      if (cursor <= m.startIndex) {
        reconciledMentions.push({
          ...m,
          startIndex: m.startIndex + diff,
          endIndex: m.endIndex + diff,
        });
      } else if (cursor > m.endIndex) {
        reconciledMentions.push(m);
      } else {
        // Edit inside mention: drop damaged mention
      }
    }

    onChange({ text: newText, mentions: reconciledMentions });
    evaluateTrigger(newText, cursor);
  };

  const handleClickOrKeyUp = (
    e: React.SyntheticEvent<HTMLTextAreaElement>
  ) => {
    const el = e.currentTarget;
    evaluateTrigger(el.value, el.selectionStart);
  };

  // Selecting a persona: Addressing mode!
  // The token STAYS in the message as a chip. Persona activates ONLY on Send.
  const selectPersona = useCallback(
    (persona: Persona) => {
      const textarea = textareaRef.current;
      const text = value.text;
      const atIdx =
        triggerState.triggerIndex >= 0
          ? triggerState.triggerIndex
          : text.lastIndexOf('@');
      const cursor = textarea ? textarea.selectionStart : text.length;

      const before = atIdx >= 0 ? text.slice(0, atIdx) : text;
      const queryLen = triggerState.query.length;
      const after =
        atIdx >= 0
          ? text.slice(atIdx + 1 + queryLen)
          : cursor <= text.length
          ? text.slice(cursor)
          : '';

      const mentionToken = `@${persona.name} `;
      const nextText = `${before}${mentionToken}${after}`;
      const tokenStart = before.length;
      const tokenEnd = tokenStart + mentionToken.length;

      const newMention: Mention = {
        id: persona.id,
        name: persona.name,
        startIndex: tokenStart,
        endIndex: tokenEnd - 1, // exclude the trailing space from chip styling
      };

      // Adjust any existing mentions occurring after the insertion point
      const textDiff = nextText.length - text.length;
      const nextMentions: Mention[] = [];
      for (const m of value.mentions) {
        if (m.endIndex <= atIdx) {
          nextMentions.push(m);
        } else if (m.startIndex >= atIdx + 1 + queryLen) {
          nextMentions.push({
            ...m,
            startIndex: m.startIndex + textDiff,
            endIndex: m.endIndex + textDiff,
          });
        }
      }
      nextMentions.push(newMention);

      // Close trigger popover
      setTriggerState({ open: false, query: '', triggerIndex: -1 });

      // Update text & mentions: token stays visible in composer!
      onChange({
        text: nextText,
        mentions: nextMentions,
      });

      // Refocus textarea and place cursor after token and trailing space
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(tokenEnd, tokenEnd);
        }
      }, 10);
    },
    [value.text, value.mentions, triggerState.triggerIndex, triggerState.query, onChange]
  );

  // Keyboard navigation & atomic Backspace
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Popover navigation
    if (triggerState.open && filteredPersonas.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPersonas.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredPersonas.length) % filteredPersonas.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const target = filteredPersonas[selectedIndex];
        if (target) {
          selectPersona(target);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setTriggerState({ open: false, query: '', triggerIndex: -1 });
        return;
      }
    }

    // Atomic Backspace over mentions
    if (e.key === 'Backspace' && value.mentions.length > 0) {
      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart === selectionEnd) {
        const mention = value.mentions.find(
          (m) =>
            m.endIndex === selectionStart ||
            (selectionStart > m.startIndex && selectionStart <= m.endIndex + 1)
        );
        if (mention) {
          e.preventDefault();
          const nextText = (
            value.text.slice(0, mention.startIndex) +
            value.text.slice(mention.endIndex + (value.text[mention.endIndex] === ' ' ? 1 : 0))
          );
          const nextMentions = value.mentions.filter((m) => m !== mention);
          onChange({ text: nextText, mentions: nextMentions });
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(
                mention.startIndex,
                mention.startIndex
              );
            }
          }, 0);
          return;
        }
      }
    }

    // Enter to send (without Shift, not in IME composition, and suggestions closed)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // Open suggestions via @ toolbar button
  const openSuggestions = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const cursor = textarea.selectionStart;
    const text = value.text;

    if (text.slice(0, cursor).endsWith('@')) {
      setTriggerState({
        open: true,
        query: '',
        triggerIndex: cursor - 1,
      });
      setSelectedIndex(0);
    } else {
      const before = text.slice(0, cursor);
      const needsSpace = before.length > 0 && !before.endsWith(' ');
      const inserted = (needsSpace ? ' ' : '') + '@';
      const nextText = before + inserted + text.slice(cursor);
      const nextCursor = cursor + inserted.length;

      onChange({ text: nextText, mentions: value.mentions });

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCursor, nextCursor);
          setTriggerState({
            open: true,
            query: '',
            triggerIndex: nextCursor - 1,
          });
          setSelectedIndex(0);
        }
      }, 0);
    }
  }, [value, onChange]);

  // Web Speech API Dictation
  const showMicToast = useCallback((msg: string) => {
    setMicToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setMicToast(null);
    }, 4000);
  }, []);

  const stopDictation = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  }, []);

  const startDictation = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showMicToast('Mic needs Chrome/Edge — or allow permission');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'kn-IN';

      dictationBaseTextRef.current = value.text ? `${value.text.trimEnd()} ` : '';

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const combined = `${finalTranscript} ${interimTranscript}`.trim();
        if (combined) {
          const nextText = `${dictationBaseTextRef.current}${combined}`;
          onChange({
            text: nextText,
            mentions: value.mentions,
          });
        }
      };

      recognition.onerror = (err: any) => {
        if (
          err.error === 'not-allowed' ||
          err.error === 'service-not-allowed' ||
          err.error === 'audio-capture'
        ) {
          showMicToast('Mic needs Chrome/Edge — or allow permission');
          stopDictation();
        } else if (
          err.error === 'language-not-supported' &&
          recognition.lang === 'kn-IN'
        ) {
          recognition.lang = 'en-IN';
          try {
            recognition.start();
          } catch {
            showMicToast('Mic needs Chrome/Edge — or allow permission');
            stopDictation();
          }
        } else {
          stopDictation();
        }
      };

      recognition.onend = () => {
        setIsDictating(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      showMicToast('Mic needs Chrome/Edge — or allow permission');
      setIsDictating(false);
    }
  }, [value.text, value.mentions, onChange, showMicToast, stopDictation]);

  const toggleDictation = useCallback(() => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  }, [isDictating, stopDictation, startDictation]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Clean text calculation
  const cleanedText = useMemo(() => {
    return stripMentionTokens(value.text, value.mentions);
  }, [value.text, value.mentions]);

  const canSend = value.text.trim().length > 0 && !disabled && !isSending;

  const handleSend = () => {
    const raw = value.text.trim();
    if (!raw || disabled || isSending) return;
    const mentionsToSend = [...value.mentions];
    const textToSend = cleanedText || raw;

    if (isDictating) {
      stopDictation();
    }

    // Clear composer
    onChange({ text: '', mentions: [] });
    setTriggerState({ open: false, query: '', triggerIndex: -1 });
    onSend(textToSend, mentionsToSend, raw);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-1.5 ${className}`}
    >
      <style dangerouslySetInnerHTML={{ __html: SEND_BUTTON_CSS }} />
      {/* =============================================================== */}
      {/* POPUP: Persona Mentions Popover (Placement: TOP ALWAYS, 264px)  */}
      {/* =============================================================== */}
      <AnimatePresence>
        {triggerState.open && (
          <motion.div
            id="persona-listbox"
            role="listbox"
            aria-label="Roleplay personas"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 8, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 6, scale: 0.96 }
            }
            transition={{
              type: 'spring',
              bounce: prefersReducedMotion ? 0 : 0.18,
              duration: prefersReducedMotion ? 0.05 : 0.22,
            }}
            className="absolute bottom-full mb-2.5 left-0 z-50 w-[264px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-xl overflow-hidden p-1.5 focus:outline-none"
          >
            {/* Header label */}
            <div className="px-2.5 py-1 text-[10px] font-mono-accent uppercase tracking-wider text-on-surface-variant/70">
              Address persona (@)
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-0.5">
              {filteredPersonas.length === 0 ? (
                <div className="px-3 py-2 text-xs text-on-surface-variant/70 italic">
                  No matching personas
                </div>
              ) : (
                filteredPersonas.map((persona, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={persona.id}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => selectPersona(persona)}
                      className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-surface-container-high'
                          : 'hover:bg-surface-container'
                      }`}
                    >
                      {/* Avatar initial circle */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: persona.color }}
                      >
                        {getInitials(persona.name)}
                      </div>

                      {/* Name & Tagline */}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-on-surface truncate">
                          {persona.name}
                        </div>
                        <div className="text-[11px] text-on-surface-variant truncate">
                          {persona.role}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =============================================================== */}
      {/* SINGLE HORIZONTAL COMPOSER ROW (WhatsApp / Telegram / IG style) */}
      {/* =============================================================== */}
      <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-outline-variant/80 bg-surface-container-low/80 focus-within:border-primary focus-within:bg-surface-container-lowest transition-colors px-2 py-1 shadow-2xs overflow-hidden">
        {/* @ Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openSuggestions}
          aria-label="Roleplay personas (@)"
          title="Roleplay personas (@)"
          className="w-9 h-9 rounded-full flex items-center justify-center text-primary bg-primary-fixed/70 hover:bg-primary-fixed transition-colors cursor-pointer shrink-0"
        >
          <AtSign className="w-[18px] h-[18px]" />
        </button>

        {/* Clean Single-Layer Horizontal Textarea (no overflowing mirror text) */}
        <div className="relative flex-1 min-w-0 flex items-center overflow-hidden">
          <textarea
            ref={textareaRef}
            rows={1}
            role="combobox"
            aria-expanded={triggerState.open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="persona-listbox"
            value={value.text}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onClick={handleClickOrKeyUp}
            onKeyUp={handleClickOrKeyUp}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full h-[36px] min-h-[36px] max-h-[88px] resize-none bg-transparent text-on-surface caret-primary px-2 py-1.5 text-[15px] leading-6 focus:outline-none placeholder:text-outline/75 placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis overflow-y-auto selection:bg-primary/20 antialiased"
            style={sharedEditorStyles}
          />
        </div>

        {/* Working Mic Button */}
        <motion.button
          type="button"
          onClick={toggleDictation}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          aria-label={isDictating ? 'Stop voice dictation' : 'Dictate with mic'}
          title={isDictating ? 'Stop dictation' : 'Dictate in Kannada/English'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 relative ${
            isDictating
              ? 'bg-red-500 text-white shadow-md ring-2 ring-red-400'
              : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
          } ${isDictating && !prefersReducedMotion ? 'animate-pulse' : ''}`}
        >
          {isDictating ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </motion.button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!canSend}
          onClick={handleSend}
          className="group/send relative flex h-9 sm:h-10 cursor-pointer items-center gap-0 overflow-hidden rounded-full bg-primary px-3.5 sm:px-4 text-white transition-all duration-200 hover:shadow-md hover:shadow-primary/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none disabled:active:scale-100 shrink-0"
          aria-label="Send message"
        >
          <span className="svg-float-wrapper flex items-center">
            <Send
              size={16}
              className="shrink-0 transition-transform duration-300 ease-in-out group-hover/send:translate-x-[1.1em] group-hover/send:rotate-45 group-hover/send:scale-110"
            />
          </span>
          <span className="ml-1.5 block text-xs sm:text-sm font-semibold transition-transform duration-300 ease-in-out group-hover/send:translate-x-[5em]">
            Send
          </span>
        </button>
      </div>

      {/* Mic Toast / Permission Warning */}
      {micToast && (
        <div
          role="status"
          aria-live="polite"
          className="text-[11px] font-medium text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1 text-center border border-amber-200"
        >
          {micToast}
        </div>
      )}
    </div>
  );
};
