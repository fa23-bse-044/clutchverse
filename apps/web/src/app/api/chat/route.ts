import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { gameRules } from "@/config/game-rules";
import {
  CHATBOT_SYSTEM_INSTRUCTION,
  findMentionedGame,
  getGreetingReply,
  getOutOfScopeReply,
  isClearlyUnrelated,
  isInScope,
  isSimpleGreeting,
  redactPersonalData,
} from "@/lib/chat-scope";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  chatRequestSchema,
  extractChatErrorMessage,
} from "@/lib/chat-request";
import { prisma } from "@clutchverse/db";
import { getRedisClient } from "@/lib/redis";
import { fetchYoutubeLiveGroup } from "@/lib/youtube-live";
import type { GameSlug } from "@clutchverse/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const maxRequestBytes = 65_536;
const fallbackGeminiModel = "gemini-3.5-flash-lite";
const allGameSlugs: GameSlug[] = ["pubg-mobile", "free-fire", "tekken-8", "fifa"];

function isCurrentGamingNewsQuestion(message: string): boolean {
  return /\b(?:latest|newest|recent|current|patch|update|meta|news|today|this week|season)\b/i.test(
    message,
  );
}

async function buildLivePlatformContext(
  userId: string,
  selectedGame: GameSlug | undefined,
): Promise<string> {
  const asOf = new Date().toISOString();
  const games = selectedGame ? [selectedGame] : allGameSlugs;
  const sections = [`Live platform data as of ${asOf} (sources may be unavailable):`];

  try {
    const redis = await getRedisClient();
    const rankingRows = [];
    for (const game of games) {
      let sortedIds: string[] = [];
      if (redis) {
        try {
          const sorted = await redis.zRange(
            `rank:${game}:season:Global:player`,
            0,
            9,
            { REV: true },
          );
          sortedIds = sorted;
        } catch {
          sortedIds = [];
        }
      }
      const rows = await prisma.ranking.findMany({
        where: {
          gameSlug: game,
          subjectType: "player",
          period: "season",
          region: "Global",
          ...(sortedIds.length ? { subjectId: { in: sortedIds } } : {}),
        },
        orderBy: [{ points: "desc" }, { rating: "desc" }],
        take: 10,
      });
      const byId = new Map(rows.map((row) => [row.subjectId, row]));
      const orderedRows = sortedIds.length
        ? sortedIds.flatMap((id) => {
            const row = byId.get(id);
            return row ? [row] : [];
          })
        : rows;
      const profiles = await prisma.playerProfile.findMany({
        where: { userId: { in: orderedRows.map((row) => row.subjectId) } },
        select: { userId: true, handle: true },
      });
      const names = new Map(profiles.map((profile) => [profile.userId, profile.handle]));
      rankingRows.push(
        `${game} top 10 (${sortedIds.length ? "Redis sorted set + PostgreSQL" : "PostgreSQL"}): ${
          orderedRows.length
            ? orderedRows
                .map((row, index) => `${index + 1}. ${names.get(row.subjectId) ?? "Player"} (${row.points} pts, ${row.rating} rating)`)
                .join("; ")
            : "No ranking entries available."
        }`,
      );
    }
    sections.push("Rankings source: Redis/PostgreSQL, fetched now.", ...rankingRows);
  } catch (error) {
    console.error("Chatbot live rankings unavailable.", {
      reason: error instanceof Error ? error.name : "query-error",
    });
    sections.push("Rankings source unavailable: PostgreSQL/Redis query failed.");
  }

  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        state: { in: ["LIVE", "UPCOMING"] },
        ...(selectedGame ? { game: { slug: selectedGame } } : {}),
      },
      orderBy: [{ state: "asc" }, { startsAt: "asc" }],
      take: 20,
      select: {
        title: true,
        state: true,
        startsAt: true,
        region: true,
        game: { select: { name: true } },
      },
    });
    sections.push(
      `Tournament source: PostgreSQL, fetched ${asOf}. ${
        tournaments.length
          ? tournaments
              .map((item) => `${item.game.name} — ${item.title}; ${item.state}; ${item.region}; starts ${item.startsAt.toISOString()}`)
              .join("; ")
          : "No live or upcoming platform tournaments found."
      }`,
    );
  } catch (error) {
    console.error("Chatbot live tournaments unavailable.", {
      reason: error instanceof Error ? error.name : "query-error",
    });
    sections.push("Tournament source unavailable: PostgreSQL query failed.");
  }

  try {
    const proEvents = await prisma.proSceneEvent.findMany({
      where: {
        status: { in: ["live", "upcoming"] },
        ...(selectedGame ? { gameSlug: selectedGame } : {}),
      },
      orderBy: [{ startsAt: "asc" }, { name: "asc" }],
      take: 10,
      select: {
        gameSlug: true,
        name: true,
        status: true,
        startsAt: true,
        sourceName: true,
        sourceUrl: true,
        fetchedAt: true,
        license: true,
      },
    });
    sections.push(
      `Pro Scene source: PostgreSQL admin-managed records, fetched ${asOf}. ${
        proEvents.length
          ? proEvents.map((event) =>
              `${event.gameSlug} — ${event.name}; ${event.status}; starts ${event.startsAt?.toISOString() ?? "date unavailable"}; source ${event.sourceName} ${event.sourceUrl}; updated ${event.fetchedAt.toISOString()}; license ${event.license}`,
            ).join("; ")
          : "No sourced live or upcoming Pro Scene events are stored."
      }`,
    );
  } catch (error) {
    console.error("Chatbot Pro Scene data unavailable.", {
      reason: error instanceof Error ? error.name : "query-error",
    });
    sections.push("Pro Scene data source unavailable: PostgreSQL query failed.");
  }

  try {
    const registrations = await prisma.registration.findMany({
      where: {
        userId,
        tournament: {
          state: { in: ["LIVE", "UPCOMING"] },
          ...(selectedGame ? { game: { slug: selectedGame } } : {}),
        },
      },
      orderBy: { tournament: { startsAt: "asc" } },
      take: 10,
      select: {
        status: true,
        tournament: {
          select: {
            title: true,
            state: true,
            startsAt: true,
            game: { select: { name: true } },
          },
        },
      },
    });
    sections.push(
      `Current user's registrations source: PostgreSQL, fetched ${asOf}. ${
        registrations.length
          ? registrations
              .map(({ status, tournament }) => `${tournament.game.name} — ${tournament.title}; ${status}; ${tournament.state}; starts ${tournament.startsAt.toISOString()}`)
              .join("; ")
          : "No live or upcoming registrations found for this user."
      }`,
    );
  } catch (error) {
    console.error("Chatbot user registrations unavailable.", {
      reason: error instanceof Error ? error.name : "query-error",
    });
    sections.push("User registration source unavailable: PostgreSQL query failed.");
  }

  try {
    const streamGroups = await Promise.all(
      games.map((game) => fetchYoutubeLiveGroup(game, "en")),
    );
    sections.push(
      `YouTube live stream source: cached YouTube Data API results, fetched ${asOf}.`,
      ...streamGroups.map((group) =>
        group.streams.length
          ? `${group.game} streams (${group.status}): ${group.streams
              .slice(0, 5)
              .map((stream) => `${stream.title} by ${stream.channelTitle} — https://www.youtube.com/watch?v=${stream.videoId}`)
              .join("; ")}`
          : `${group.game} stream source ${group.status}: ${group.diagnosticReason ?? "No live results."}`,
      ),
    );
  } catch (error) {
    console.error("Chatbot live streams unavailable.", {
      reason: error instanceof Error ? error.name : "provider-error",
    });
    sections.push("YouTube live stream source unavailable.");
  }

  return sections.join("\n").slice(0, 12_000);
}

async function readRequestBody(request: Request): Promise<
  | { kind: "ok"; value: unknown }
  | { kind: "invalid" }
  | { kind: "too-large" }
> {
  const reader = request.body?.getReader();
  if (!reader) return { kind: "invalid" };
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxRequestBytes) {
        await reader.cancel();
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      kind: "ok",
      value: JSON.parse(new TextDecoder().decode(body)) as unknown,
    };
  } catch {
    return { kind: "invalid" };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to use ClutchVerse AI." }, { status: 401 });
  }
  try {
    const conversations = await prisma.chatbotConversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        messageCount: conversation._count.messages,
      })),
    });
  } catch (error) {
    console.error("Chatbot conversation list query failed.", error);
    return NextResponse.json(
      { error: "Conversation history is unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to use ClutchVerse AI." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return NextResponse.json({ error: "Message is too large." }, { status: 413 });
  }
  const body = await readRequestBody(request);
  if (body.kind === "too-large") {
    return NextResponse.json({ error: "Message is too large." }, { status: 413 });
  }
  if (body.kind === "invalid") {
    return NextResponse.json(
      { error: "Request body must be valid JSON with a message." },
      { status: 400 },
    );
  }
  const parsed = chatRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid chat request." },
      { status: 400 },
    );
  }

  const limit = await checkRateLimit(`chatbot:user:${session.user.id}`, 8, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "You are sending messages too quickly. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const { message, conversationId } = parsed.data;
  const safeMessage = redactPersonalData(message);
  const greeting = isSimpleGreeting(message);
  const inScope = !isClearlyUnrelated(message);
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  if (inScope && !greeting && !apiKey) {
    return NextResponse.json(
      { error: "ClutchVerse AI is not configured. Set GEMINI_API_KEY on the server." },
      { status: 503 },
    );
  }
  if (inScope && !greeting && !/^[a-zA-Z0-9._-]{1,100}$/.test(model)) {
    console.error("GEMINI_MODEL contains unsupported characters.");
    return NextResponse.json(
      { error: "The configured AI model is invalid." },
      { status: 503 },
    );
  }
  let conversation;
  try {
    conversation = conversationId
      ? await prisma.chatbotConversation.findFirst({
          where: { id: conversationId, userId: session.user.id },
        })
      : await prisma.chatbotConversation.create({
          data: {
            userId: session.user.id,
            title: message.slice(0, 120),
          },
        });
  } catch (error) {
    console.error("Chatbot conversation could not be loaded.", error);
    return NextResponse.json(
      { error: "Unable to open a conversation." },
      { status: 503 },
    );
  }
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  let priorMessages;
  try {
    priorMessages = await prisma.chatbotMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  } catch (error) {
    console.error("Chatbot conversation context could not be loaded.", error);
    return NextResponse.json(
      { error: "Unable to load conversation context." },
      { status: 503 },
    );
  }
  const recentGamingContext = priorMessages
    .slice(0, 4)
    .some((entry) => entry.role === "USER" && isInScope(entry.content));
  const refuse = !greeting && isClearlyUnrelated(message) && !recentGamingContext;
  if (refuse || greeting) {
    if (refuse) console.info("Chatbot request blocked by topic scope guard.");
    const reply = greeting ? getGreetingReply() : getOutOfScopeReply(message);
    try {
      await prisma.chatbotMessage.createMany({
        data: [
          { conversationId: conversation.id, role: "USER", content: safeMessage },
          { conversationId: conversation.id, role: "ASSISTANT", content: reply },
        ],
      });
      await prisma.chatbotConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      console.error("Chatbot response could not be saved.", error);
      return NextResponse.json(
        { error: "Unable to save this conversation." },
        { status: 503 },
      );
    }
    return new Response(reply, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-chat-conversation-id": conversation.id,
      },
    });
  }

  try {
    const gameSlug = findMentionedGame(message);
    const selectedRules = gameSlug
      ? [[gameSlug, gameRules[gameSlug]] as const]
      : Object.entries(gameRules).map(([slug, rules]) => [slug, rules] as const);
    const activeTournaments = await prisma.tournament.findMany({
      where: {
        state: { in: ["UPCOMING", "LIVE"] },
        ...(gameSlug ? { game: { slug: gameSlug } } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 6,
      select: {
        title: true,
        state: true,
        startsAt: true,
        region: true,
        game: { select: { name: true } },
      },
    }    );
    const liveContext = await buildLivePlatformContext(session.user.id, gameSlug);
    const siteData = [
      "Game rules and FAQs:",
      ...selectedRules.map(
        ([slug, rules]) =>
          `${slug}: eligibility=${rules.eligibility} fair-play=${rules.fairPlay} scoring=${rules.scoring} disputes=${rules.disputes} FAQs=${rules.faqs
            .slice(0, 3)
            .map((faq) => `${faq.question} ${faq.answer}`)
            .join(" ")}`,
      ),
      "Current ClutchVerse tournaments (source of truth; do not infer missing events):",
      ...activeTournaments.map(
        (tournament) =>
          `${tournament.game.name} — ${tournament.title}; status=${tournament.state}; region=${tournament.region}; starts=${tournament.startsAt.toISOString()}`,
      ),
      activeTournaments.length === 0
        ? "No upcoming or live tournaments were found."
        : "",
      liveContext,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 6000);
    const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];
    for (const entry of priorMessages.reverse()) {
      const role = entry.role === "ASSISTANT" ? "model" : "user";
      const text = redactPersonalData(entry.content).slice(0, 1000);
      const previous = contents.at(-1);
      if (previous?.role === role) {
        previous.parts[0].text = `${previous.parts[0].text}\n${text}`.slice(0, 2000);
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }
    const last = contents.at(-1);
    if (last?.role === "user") {
      last.parts[0].text = `${last.parts[0].text}\n${safeMessage}`.slice(0, 2000);
    } else {
      contents.push({ role: "user", parts: [{ text: safeMessage }] });
    }
    while (contents[0]?.role === "model") contents.shift();

    await prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: safeMessage,
      },
    });

    const makeRequestBody = (withSearchGrounding: boolean) => JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: `${CHATBOT_SYSTEM_INSTRUCTION}\n\nClutchVerse site data:\n${siteData}`,
          },
        ],
      },
      contents,
      generationConfig: { maxOutputTokens: 512, temperature: 0.4 },
      ...(withSearchGrounding ? { tools: [{ google_search: {} }] } : {}),
    });
    const useSearchGrounding = isCurrentGamingNewsQuestion(message);
    const requestGemini = (modelName: string, withSearchGrounding: boolean) =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: makeRequestBody(withSearchGrounding),
          signal: AbortSignal.timeout(45_000),
        },
      );
    let upstream = await requestGemini(model, useSearchGrounding);
    if (useSearchGrounding && [400, 429].includes(upstream.status)) {
      const errorBody = await upstream.text();
      const diagnostic = extractChatErrorMessage(
        upstream.status,
        errorBody,
        apiKey,
      );
      console.warn("Gemini search grounding unavailable; retrying without search.", {
        status: upstream.status,
        reason: diagnostic.reason,
      });
      upstream = await requestGemini(model, false);
    }
    if (upstream.status === 503 && model !== fallbackGeminiModel) {
      const errorBody = await upstream.text();
      const diagnostic = extractChatErrorMessage(503, errorBody, apiKey);
      console.warn("Configured Gemini model is unavailable; trying fallback.", {
        status: 503,
        reason: diagnostic.reason,
      });
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(fallbackGeminiModel)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: makeRequestBody(useSearchGrounding),
          signal: AbortSignal.timeout(45_000),
        },
      );
      const fallbackBody = await fallbackResponse.text();
      if (!fallbackResponse.ok) {
        const fallbackError = extractChatErrorMessage(
          fallbackResponse.status,
          fallbackBody,
          apiKey,
        );
        console.error("Gemini fallback request failed.", {
          status: fallbackResponse.status,
          reason: fallbackError.reason,
        });
        return NextResponse.json(
          { error: fallbackError.userMessage },
          {
            status: 502,
            headers: { "x-chat-conversation-id": conversation.id },
          },
        );
      }

      let fallbackPayload: unknown;
      try {
        fallbackPayload = JSON.parse(fallbackBody) as unknown;
      } catch {
        fallbackPayload = null;
      }
      const candidates =
        typeof fallbackPayload === "object" &&
        fallbackPayload !== null &&
        "candidates" in fallbackPayload &&
        Array.isArray(fallbackPayload.candidates)
          ? fallbackPayload.candidates
          : [];
      const firstCandidate = candidates[0];
      const content =
        typeof firstCandidate === "object" &&
        firstCandidate !== null &&
        "content" in firstCandidate &&
        typeof firstCandidate.content === "object" &&
        firstCandidate.content !== null &&
        "parts" in firstCandidate.content &&
        Array.isArray(firstCandidate.content.parts)
          ? firstCandidate.content.parts
          : [];
      const fallbackText = content
        .flatMap((part: unknown) =>
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
            ? [part.text]
            : [],
        )
        .join("")
        .trim();
      if (!fallbackText) {
        console.error("Gemini fallback returned no text.", {
          status: fallbackResponse.status,
          reason: "empty-candidate",
        });
        return NextResponse.json(
          { error: "The AI service returned an empty response. Please try again." },
          {
            status: 502,
            headers: { "x-chat-conversation-id": conversation.id },
          },
        );
      }
      const fallbackSources = new Map<string, { title: string; url: string }>();
      if (
        typeof firstCandidate === "object" &&
        firstCandidate !== null &&
        "groundingMetadata" in firstCandidate &&
        typeof firstCandidate.groundingMetadata === "object" &&
        firstCandidate.groundingMetadata !== null &&
        "groundingChunks" in firstCandidate.groundingMetadata &&
        Array.isArray(firstCandidate.groundingMetadata.groundingChunks)
      ) {
        for (const item of firstCandidate.groundingMetadata.groundingChunks) {
          if (
            typeof item !== "object" ||
            item === null ||
            !("web" in item) ||
            typeof item.web !== "object" ||
            item.web === null ||
            !("uri" in item.web) ||
            typeof item.web.uri !== "string"
          ) continue;
          try {
            const sourceUrl = new URL(item.web.uri);
            if (sourceUrl.protocol !== "https:") continue;
            const title =
              "title" in item.web && typeof item.web.title === "string"
                ? item.web.title
                : sourceUrl.hostname;
            fallbackSources.set(sourceUrl.href, {
              title,
              url: sourceUrl.href,
            });
          } catch {
            continue;
          }
        }
      }
      const fullFallbackText = fallbackSources.size
        ? `${fallbackText}\n\n__CLUTCHVERSE_SOURCES__${JSON.stringify(
            [...fallbackSources.values()].slice(0, 8),
          )}`
        : fallbackText;
      await prisma.chatbotMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: fullFallbackText.slice(0, 8000),
        },
      });
      await prisma.chatbotConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return new Response(fullFallbackText, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-chat-conversation-id": conversation.id,
        },
      });
    }
    if (!upstream.ok || !upstream.body) {
      const errorBody = upstream.body ? await upstream.text() : "";
      const diagnostic = extractChatErrorMessage(
        upstream.status,
        errorBody,
        apiKey,
      );
      console.error("Gemini upstream request failed.", {
        status: upstream.status,
        reason: diagnostic.reason,
      });
      return NextResponse.json(
        { error: diagnostic.userMessage },
        {
          status: 502,
          headers: { "x-chat-conversation-id": conversation.id },
        },
      );
    }

    const upstreamReader = upstream.body.getReader();
    const conversationHeader = conversation.id;
    let responseText = "";
    const sourceLinks = new Map<string, { title: string; url: string }>();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = "";
        const processLine = (line: string) => {
          if (!line.startsWith("data:")) return;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") return;
          try {
            const chunk: unknown = JSON.parse(data);
            if (
              typeof chunk !== "object" ||
              chunk === null ||
              !("candidates" in chunk) ||
              !Array.isArray(chunk.candidates)
            )
              return;
            const candidate = chunk.candidates[0];
            if (
              typeof candidate !== "object" ||
              candidate === null ||
              !("content" in candidate) ||
              typeof candidate.content !== "object" ||
              candidate.content === null ||
              !("parts" in candidate.content) ||
              !Array.isArray(candidate.content.parts)
            )
              return;
            if (
              "groundingMetadata" in candidate &&
              typeof candidate.groundingMetadata === "object" &&
              candidate.groundingMetadata !== null &&
              "groundingChunks" in candidate.groundingMetadata &&
              Array.isArray(candidate.groundingMetadata.groundingChunks)
            ) {
              for (const groundingChunk of candidate.groundingMetadata.groundingChunks) {
                if (
                  typeof groundingChunk !== "object" ||
                  groundingChunk === null ||
                  !("web" in groundingChunk) ||
                  typeof groundingChunk.web !== "object" ||
                  groundingChunk.web === null ||
                  !("uri" in groundingChunk.web) ||
                  typeof groundingChunk.web.uri !== "string"
                ) continue;
                try {
                  const sourceUrl = new URL(groundingChunk.web.uri);
                  if (sourceUrl.protocol !== "https:") continue;
                  const title =
                    "title" in groundingChunk.web &&
                    typeof groundingChunk.web.title === "string"
                      ? groundingChunk.web.title
                      : sourceUrl.hostname;
                  sourceLinks.set(sourceUrl.href, { title, url: sourceUrl.href });
                } catch {
                  continue;
                }
              }
            }
            const text = candidate.content.parts
              .filter(
                (part: unknown): part is { text: string } =>
                  typeof part === "object" &&
                  part !== null &&
                  "text" in part &&
                  typeof part.text === "string",
              )
              .map((part: { text: string }) => part.text)
              .join("");
            if (text && !cancelled) {
              responseText += text;
              controller.enqueue(encoder.encode(text));
            }
          } catch {
            console.warn("A malformed Gemini stream chunk was ignored.");
          }
        };

        try {
          while (!cancelled) {
            const { done, value } = await upstreamReader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            lines.forEach(processLine);
          }
          buffer += decoder.decode();
          if (buffer) processLine(buffer);
          if (!cancelled && sourceLinks.size) {
            const sources = [...sourceLinks.values()].slice(0, 8);
            const sourceBlock = `\n\n__CLUTCHVERSE_SOURCES__${JSON.stringify(sources)}`;
            responseText += sourceBlock;
            controller.enqueue(encoder.encode(sourceBlock));
          }
          if (!cancelled && responseText) {
            await prisma.chatbotMessage.create({
              data: {
                conversationId: conversationHeader,
                role: "ASSISTANT",
                content: responseText.slice(0, 8000),
              },
            });
            await prisma.chatbotConversation.update({
              where: { id: conversationHeader },
              data: { updatedAt: new Date() },
            });
          }
          if (!cancelled) controller.close();
        } catch (error) {
          console.error("Gemini response stream failed.", error);
          if (!cancelled) controller.error(error);
        } finally {
          if (!cancelled) await upstreamReader.cancel().catch(() => undefined);
        }
      },
      async cancel() {
        cancelled = true;
        await upstreamReader.cancel().catch(() => undefined);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "x-chat-conversation-id": conversationHeader,
      },
    });
  } catch (error) {
    console.error("Chatbot request could not be prepared.", error);
    return NextResponse.json(
      { error: "Unable to prepare the AI response. Please try again." },
      {
        status: 503,
        headers: { "x-chat-conversation-id": conversation.id },
      },
    );
  }
}
