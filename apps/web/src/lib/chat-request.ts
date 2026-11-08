import { z } from "zod";

const requestObjectSchema = z
  .object({
    message: z.unknown().optional(),
    prompt: z.unknown().optional(),
    input: z.unknown().optional(),
    text: z.unknown().optional(),
    latestMessage: z.unknown().optional(),
    conversationId: z.string().cuid().nullish(),
    messages: z.array(z.unknown()).optional(),
    history: z.array(z.unknown()).optional(),
  })
  .passthrough();

const latestMessageSchema = z.string().trim().min(1).max(1000);

function getLastUserMessage(entries: unknown[]): unknown {
  for (const entry of [...entries].reverse()) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const role = record.role ?? record.author;
    if (typeof role === "string" && !["user", "human"].includes(role.toLowerCase())) {
      continue;
    }
    return record.content ?? record.text ?? record.message;
  }
  return undefined;
}

export const chatRequestSchema = z.unknown().transform((input, context) => {
  const parsed = requestObjectSchema.safeParse(input);
  if (!parsed.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid chat request.",
    });
    return z.NEVER;
  }
  const payload = parsed.data;
  const messageCandidate =
    payload.message ??
    payload.latestMessage ??
    payload.prompt ??
    payload.input ??
    payload.text ??
    (payload.messages ? getLastUserMessage(payload.messages) : undefined) ??
    (payload.history ? getLastUserMessage(payload.history) : undefined);
  const message = latestMessageSchema.safeParse(messageCandidate);
  if (!message.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        typeof messageCandidate === "string" && messageCandidate.trim().length > 1000
          ? "The latest message must be 1,000 characters or fewer."
          : "Provide a non-empty latest user message.",
    });
    return z.NEVER;
  }
  return {
    message: message.data,
    conversationId: payload.conversationId ?? undefined,
  };
});

export function extractChatErrorMessage(
  status: number,
  body: string,
  apiKey: string,
): { reason: string; userMessage: string } {
  let reason = "unknown";
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof parsed.error === "object" &&
      parsed.error !== null
    ) {
      const error = parsed.error;
      if ("status" in error && typeof error.status === "string") {
        reason = error.status;
      } else if (
        "details" in error &&
        Array.isArray(error.details) &&
        typeof error.details[0] === "object" &&
        error.details[0] !== null &&
        "reason" in error.details[0] &&
        typeof error.details[0].reason === "string"
      ) {
        reason = error.details[0].reason;
      }
    }
  } catch {
    reason = "invalid-error-response";
  }

  const safeBody = body.replaceAll(apiKey, "[redacted]").slice(0, 2000);
  const userMessage =
    status === 401 || status === 403
      ? "The AI provider rejected its server credentials. Please contact support."
      : status === 429
        ? "The AI service is busy or its quota is temporarily unavailable. Please try again later."
        : "The AI service could not answer right now. Please try again.";
  return { reason: `${reason}: ${safeBody}`, userMessage };
}
