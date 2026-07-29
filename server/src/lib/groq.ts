const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const MODEL_FAST = "llama-3.1-8b-instant";
export const MODEL_CHAT = "llama-3.3-70b-versatile";
export const MODEL_DOCS = "openai/gpt-oss-120b";

interface GroqChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function groqChat(
  prompt: string,
  systemInstruction?: string,
  opts?: GroqChatOptions
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: opts?.model || MODEL_CHAT,
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("GROQ error:", err);
    throw new Error(`GROQ API error: ${err}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || "";
}
