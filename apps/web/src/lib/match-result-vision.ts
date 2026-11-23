import { z } from "zod";

const visionSchema = z.object({
  placement: z.number().int().positive().max(1000).optional(),
  kills: z.number().int().min(0).max(1000).optional(),
  score: z.number().min(0).max(999).optional(),
});

export type MatchResultSuggestion = z.infer<typeof visionSchema>;

export async function suggestMatchResult(
  bytes: Uint8Array,
  mimeType: string,
): Promise<MatchResultSuggestion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.MATCH_VISION_GEMINI_MODEL || "gemini-flash-latest";
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) {
    throw new Error("MATCH_VISION_MODEL_INVALID");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Read this game-result screenshot. Return JSON only with numeric fields placement, kills, and score when each is clearly visible. Do not infer missing values. Use {} when none can be read.",
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: Buffer.from(bytes).toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`MATCH_VISION_PROVIDER_${response.status}`);
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.find(
      (part) => typeof part.text === "string",
    )?.text;
    if (!text) return null;
    const parsedJson: unknown = JSON.parse(text);
    const parsed = visionSchema.safeParse(parsedJson);
    return parsed.success ? parsed.data : null;
  } finally {
    clearTimeout(timeout);
  }
}
