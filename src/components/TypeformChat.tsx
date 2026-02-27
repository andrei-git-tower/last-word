import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat } from "@/lib/chat-stream";
import { parseInsights, cleanMessage } from "@/lib/constants";
import type { Message, Insight } from "@/lib/constants";
import { toast } from "sonner";

const FIRST_MESSAGE = "Hey — what's the main reason you're thinking of cancelling?";

type Phase = "entering" | "visible" | "exiting";

interface TypeformChatProps {
  onInsight: (insight: Insight) => void;
  apiKey: string;
  autoStart?: boolean;
  primaryColor?: string;
  buttonColor?: string;
  fontFamily?: string;
}

export function TypeformChat({
  onInsight,
  apiKey,
  autoStart = false,
  primaryColor,
  buttonColor,
  fontFamily,
}: TypeformChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("visible");
  const [stepCount, setStepCount] = useState(0);
  const fullTextRef = useRef("");
  const autoStarted = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const accentColor = buttonColor || primaryColor || "#2563eb";

  // Auto-focus textarea when a question becomes fully visible
  useEffect(() => {
    if (phase === "visible" && started && !complete && !loading) {
      textareaRef.current?.focus();
    }
  }, [phase, started, complete, loading]);

  function animateIn(newQuestion: string) {
    setCurrentQuestion(newQuestion);
    setPhase("entering");
    // Double rAF ensures the browser has painted the entering state
    // before we flip to visible, triggering the CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase("visible");
        setLoading(false);
      });
    });
  }

  function animateOut(then: () => void) {
    setPhase("exiting");
    setTimeout(then, 300);
  }

  const startInterview = useCallback(() => {
    setStarted(true);
    setMessages([]);
    setComplete(false);
    setCurrentAnswer("");
    setStepCount(0);
    setCurrentQuestion("");
    fullTextRef.current = "";
    setPhase("entering");
    setTimeout(() => {
      setCurrentQuestion(FIRST_MESSAGE);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("visible"));
      });
    }, 500);
  }, []);

  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      startInterview();
    }
  }, [autoStart, startInterview]);

  const submitAnswer = useCallback(() => {
    if (!currentAnswer.trim() || loading || complete) return;
    const msg = currentAnswer.trim();
    setCurrentAnswer("");

    const userMsg: Message = { role: "user", content: msg };
    const assistantMsg: Message = { role: "assistant", content: currentQuestion };
    const updatedMessages = [...messages, assistantMsg, userMsg];
    setMessages(updatedMessages);
    setStepCount((c) => c + 1);
    setLoading(true);

    let assistantSoFar = "";
    fullTextRef.current = "";

    streamChat({
      messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      apiKey,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        fullTextRef.current = assistantSoFar;
      },
      onDone: () => {
        const raw = fullTextRef.current;
        if (raw.includes("[INTERVIEW_COMPLETE]")) {
          animateOut(() => setComplete(true));
          const insight = parseInsights(raw);
          if (insight) onInsight({ ...insight, date: "just now" });
        } else {
          animateOut(() => animateIn(cleanMessage(raw)));
        }
      },
    }).catch((err) => {
      setLoading(false);
      toast.error(err.message || "Failed to send message");
    });
  }, [currentAnswer, loading, complete, messages, currentQuestion, apiKey, onInsight]);

  // Animate the card content
  const cardStyle: React.CSSProperties = {
    transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    opacity: phase === "visible" ? 1 : 0,
    transform:
      phase === "exiting"
        ? "translateY(-28px)"
        : phase === "entering"
        ? "translateY(28px)"
        : "translateY(0)",
  };

  // ─── Start screen ────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-8 bg-background"
        style={fontFamily ? { fontFamily } : undefined}
      >
        <div style={cardStyle} className="text-center max-w-xs">
          <p className="text-3xl font-bold text-foreground mb-3">Quick question</p>
          <p className="text-muted-foreground text-sm mb-8">
            Takes less than a minute. We'd love to understand.
          </p>
          <button
            onClick={startInterview}
            className="px-7 py-3 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accentColor }}
          >
            Let's go →
          </button>
        </div>
      </div>
    );
  }

  // ─── Complete screen ──────────────────────────────────────────────────────────
  if (complete) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-8 bg-background"
        style={fontFamily ? { fontFamily } : undefined}
      >
        <div className="text-center max-w-xs">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: accentColor }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-foreground mb-2">Thank you</p>
          <p className="text-muted-foreground text-sm">Your feedback means a lot to us.</p>
        </div>
      </div>
    );
  }

  // ─── Question card ────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-background"
      style={fontFamily ? { fontFamily } : undefined}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-border shrink-0">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${Math.min(10 + stepCount * 18, 88)}%`, backgroundColor: accentColor }}
        />
      </div>

      {/* Centered card content */}
      <div className="flex-1 flex flex-col justify-center px-8 pb-8 min-h-0">
        <div style={cardStyle}>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-5">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">{stepCount + 1}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>

          {/* Question text */}
          <p className="text-2xl font-bold text-foreground leading-snug mb-7">
            {currentQuestion}
          </p>

          {/* Underline textarea */}
          <textarea
            ref={textareaRef}
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitAnswer();
              }
            }}
            placeholder="Type your answer…"
            rows={3}
            disabled={loading}
            className="w-full bg-transparent text-foreground text-lg placeholder:text-muted-foreground/50 resize-none outline-none pb-2 disabled:opacity-50 border-b-2 border-border focus:border-b-2"
            style={{ borderBottomColor: "var(--border)" }}
          />

          {/* OK button + hint */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={submitAnswer}
              disabled={loading || !currentAnswer.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: accentColor }}
            >
              {loading ? (
                <>
                  <span className="animate-bounce inline-block" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce inline-block" style={{ animationDelay: "120ms" }}>·</span>
                  <span className="animate-bounce inline-block" style={{ animationDelay: "240ms" }}>·</span>
                </>
              ) : (
                <>
                  OK
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </>
              )}
            </button>
            {!loading && currentAnswer.trim() && (
              <span className="text-xs text-muted-foreground">
                press <kbd className="font-mono">Enter ↵</kbd>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
