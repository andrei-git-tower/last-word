// Converts Anthropic-format messages to Gemini `contents` array
// Anthropic: { role: "user"|"assistant", content: string }
// Gemini:    { role: "user"|"model",     parts: [{ text }] }
function toGeminiContents(messages: Array<{ role: string; content: string }>) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// Non-streaming Gemini call. Returns plain text, throws on failure.
export async function geminiNonStreaming(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  apiKey: string
): Promise<string> {
  const resp = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: toGeminiContents(messages),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}
