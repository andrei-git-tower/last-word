import type { Message } from "./constants";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exit-interview`;

export interface UserContext {
  email?: string;
  plan?: string;
  account_age?: number;  // days
  seats?: number;
  mrr?: number;
}

export async function streamChat({
  messages,
  apiKey,
  userContext,
  onDelta,
  onDone,
}: {
  messages: Message[];
  apiKey: string;
  userContext?: UserContext | null;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ messages, userContext: userContext ?? null }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limited — please try again in a moment.");
    if (resp.status === 402) throw new Error("AI credits exhausted — please add funds.");
    throw new Error("Failed to start stream");
  }
  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.startsWith("event:") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        // Anthropic format
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          onDelta(parsed.delta.text);
        }
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.startsWith("event:") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          onDelta(parsed.delta.text);
        }
      } catch {
        /* ignore partial leftovers */
      }
    }
  }

  onDone();
}
