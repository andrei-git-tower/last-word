import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { streamChat } from "@/lib/chat-stream";
import { parseInsights, cleanMessage } from "@/lib/constants";
import type { Message, Insight } from "@/lib/constants";
import { toast } from "sonner";

const FIRST_MESSAGE = "Hey — what's the main reason you're thinking of cancelling?";

interface InterviewChatProps {
  onInsight: (insight: Insight) => void;
  apiKey: string;
  autoStart?: boolean;
}

export function InterviewChat({ onInsight, apiKey, autoStart = false }: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const fullTextRef = useRef("");
  const autoStarted = useRef(false);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  const startInterview = useCallback(() => {
    setStarted(true);
    setMessages([]);
    setComplete(false);
    fullTextRef.current = "";
    setLoading(true);

    // Show dots briefly, then stream the static first message character by character
    setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        const partial = FIRST_MESSAGE.slice(0, i);
        setMessages([{ role: "assistant", content: partial }]);
        if (i >= FIRST_MESSAGE.length) {
          clearInterval(interval);
          setLoading(false);
        }
      }, 18);
    }, 600);
  }, []);

  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      startInterview();
    }
  }, [autoStart, startInterview]);

  const send = useCallback(() => {
    if (!input.trim() || loading || complete) return;
    const msg = input.trim();
    setInput("");

    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);
    let assistantSoFar = "";
    fullTextRef.current = "";

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    streamChat({
      messages: allMessages,
      apiKey,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        fullTextRef.current = assistantSoFar;
        const cleaned = cleanMessage(assistantSoFar);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleaned } : m));
          }
          return [...prev, { role: "assistant", content: cleaned }];
        });
      },
      onDone: () => {
        setLoading(false);
        const raw = fullTextRef.current;
        if (raw.includes("[INTERVIEW_COMPLETE]")) {
          setComplete(true);
          // Parse internal analytics payload; this is not shown in the chat UI.
          const insight = parseInsights(raw);
          if (insight) {
            onInsight({ ...insight, date: "just now" });
          }
        }
      },
    }).catch((err) => {
      setLoading(false);
      toast.error(err.message || "Failed to send message");
    });
  }, [input, loading, complete, messages, onInsight]);

  if (!started) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-12 text-center">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Simulate a Tower Cancellation</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
            Play the role of a customer cancelling their Tower subscription. The AI will dig into the real reasons and offer a smart retention path — never a discount.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {["Solo dev, too pricey", "Switching to GitKraken", "Too many crashes", "Budget cuts", "Team never adopted it"].map((p) => (
              <span key={p} className="text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-full">
                try: &ldquo;{p}&rdquo;
              </span>
            ))}
          </div>
          <button
            onClick={startInterview}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Start Exit Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div ref={chatRef} className="h-96 overflow-y-auto p-5 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs sm:max-w-sm rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-4 py-3 text-sm text-muted-foreground flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        {complete ? (
          <div className="flex gap-2">
            <button
              onClick={startInterview}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
            >
              Start Another Interview
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Respond as the cancelling customer..."
              className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
