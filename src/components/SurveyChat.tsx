import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat } from "@/lib/chat-stream";
import { parseInsights, cleanMessage } from "@/lib/constants";
import type { Message, Insight } from "@/lib/constants";
import { toast } from "sonner";

const FIRST_MESSAGE = "Hey — what's the main reason you're thinking of cancelling?";

interface SurveyChatProps {
  onInsight: (insight: Insight) => void;
  apiKey: string;
  autoStart?: boolean;
  primaryColor?: string;
  buttonColor?: string;
  fontFamily?: string;
}

export function SurveyChat({ onInsight, apiKey, autoStart = false, primaryColor, buttonColor, fontFamily }: SurveyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const fullTextRef = useRef("");
  const autoStarted = useRef(false);

  const accentColor = buttonColor || primaryColor || "#2563eb";

  const startInterview = useCallback(() => {
    setStarted(true);
    setMessages([]);
    setComplete(false);
    setCurrentAnswer("");
    setCurrentQuestion("");
    fullTextRef.current = "";
    setLoading(true);

    setTimeout(() => {
      setCurrentQuestion(FIRST_MESSAGE);
      setLoading(false);
    }, 600);
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

    setLoading(true);
    let assistantSoFar = "";
    fullTextRef.current = "";

    const allMessages = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    streamChat({
      messages: allMessages,
      apiKey,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        fullTextRef.current = assistantSoFar;
        // Accumulate silently — question updates only when fully received
      },
      onDone: () => {
        const raw = fullTextRef.current;
        if (raw.includes("[INTERVIEW_COMPLETE]")) {
          setComplete(true);
          const insight = parseInsights(raw);
          if (insight) {
            onInsight({ ...insight, date: "just now" });
          }
        } else {
          setCurrentQuestion(cleanMessage(raw));
        }
        setLoading(false);
      },
    }).catch((err) => {
      setLoading(false);
      toast.error(err.message || "Failed to send message");
    });
  }, [currentAnswer, loading, complete, messages, currentQuestion, apiKey, onInsight]);

  if (!started) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Quick Exit Survey</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Answer a few short questions and we'll do our best to help.
          </p>
          <button
            onClick={startInterview}
            className="px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-white"
            style={{ backgroundColor: accentColor }}
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Thank you</h2>
          <p className="text-muted-foreground text-sm">
            Your feedback has been recorded. We appreciate you taking the time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-6 pt-4 pb-4" style={fontFamily ? { fontFamily } : undefined}>
      {/* Question */}
      <div className="flex-1 flex flex-col">
        {loading && !currentQuestion ? (
          <div className="flex gap-1 mb-3">
            <span className="text-2xl text-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
            <span className="text-2xl text-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
            <span className="text-2xl text-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
          </div>
        ) : (
          <p className="text-xl font-semibold text-foreground mb-3 leading-snug">
            {currentQuestion}
          </p>
        )}

        {/* Answer textarea */}
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
          }}
          placeholder="Type your answer here..."
          rows={7}
          disabled={loading}
          className="flex-1 w-full text-sm bg-secondary/40 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 resize-none disabled:opacity-50"
          style={{ focusRingColor: accentColor } as React.CSSProperties}
        />
      </div>

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={submitAnswer}
          disabled={loading || !currentAnswer.trim()}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
          style={{ backgroundColor: accentColor }}
        >
          {loading ? (
            <>
              <span className="animate-bounce inline-block" style={{ animationDelay: "0ms" }}>·</span>
              <span className="animate-bounce inline-block" style={{ animationDelay: "150ms" }}>·</span>
              <span className="animate-bounce inline-block" style={{ animationDelay: "300ms" }}>·</span>
            </>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </div>
  );
}
