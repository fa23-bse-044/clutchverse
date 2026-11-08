import { createServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { jwtVerify } from "jose";
import { createClient } from "redis";
import { Server } from "socket.io";
import { z } from "zod";
import { canAccessChatRoom, prisma } from "@clutchverse/db";

const port = Number(process.env.REALTIME_PORT ?? 4001);
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "AUTH_SECRET or NEXTAUTH_SECRET must contain at least 32 characters.",
  );
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  },
  maxHttpBufferSize: 64 * 1024,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
});

const joinSchema = z.object({ roomId: z.string().min(1).max(100) });
const chatSchema = z.object({
  roomId: z.string().min(1).max(100),
  body: z.string().trim().min(1).max(300),
  replyToId: z.string().max(100).optional(),
});
const typingSchema = z.object({
  roomId: z.string().min(1).max(100),
  active: z.boolean(),
});
const reactionSchema = z.object({
  roomId: z.string().min(1).max(100),
  messageId: z.string().min(1).max(64),
  emoji: z.enum(["🔥", "😂", "💯", "👏", "❤️"]),
});
const rankingSchema = z.object({
  gameSlug: z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]),
  period: z.enum(["daily", "weekly", "season", "all-time"]),
  region: z.string().max(32).optional(),
});
const tournamentSubscribeSchema = z.object({ tournamentId: z.string().min(1).max(64) });
const forbiddenPatterns = [/\b(?:kill yourself|doxx?)\b/i];
const messageTimes = new Map<string, number>();
const online = new Map<string, number>();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (typeof token !== "string" || !token) {
      socket.data.user = {
        id: `guest:${socket.id}`,
        name: "Guest",
        role: "guest",
        authenticated: false,
      };
      next();
      return;
    }
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
      },
    );
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new Error("Invalid session claims.");
    }
    socket.data.user = {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "Player",
      role: payload.role,
      authenticated: true,
    };
    next();
  } catch {
    next(new Error("Authentication failed."));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user as {
    id: string;
    name: string;
    role: string;
    authenticated: boolean;
  };
  if (user.authenticated) {
    online.set(user.id, (online.get(user.id) ?? 0) + 1);
    io.emit("presence:update", {
      userId: user.id,
      state: "online",
      onlineCount: online.size,
    });
  }

  socket.on("tournament:subscribe", (input: unknown, ack?: (result: unknown) => void) => {
    const parsed = tournamentSubscribeSchema.safeParse(input);
    if (!parsed.success) return ack?.({ error: "Invalid tournament." });
    const room = `tournament:${parsed.data.tournamentId}`;
    socket.join(room);
    ack?.({ ok: true, room });
  });

  socket.on("tournament:unsubscribe", (input: unknown) => {
    const parsed = tournamentSubscribeSchema.safeParse(input);
    if (parsed.success) socket.leave(`tournament:${parsed.data.tournamentId}`);
  });

  socket.on("room:join", (input: unknown, ack?: (result: unknown) => void) => {
    if (!user.authenticated)
      return ack?.({ error: "Sign in to join community chat." });
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return ack?.({ error: "Invalid room." });
    const { roomId } = parsed.data;
    void canAccessChatRoom(roomId, user.id)
      .then((allowed) => {
        if (!allowed)
          return ack?.({ error: "Room not found or membership required." });
        socket.join(roomId);
        ack?.({ ok: true, roomId });
      })
      .catch((error: unknown) => {
        console.error("Room authorization failed.", error);
        ack?.({ error: "Unable to authorize this room." });
      });
  });

  socket.on("room:leave", (input: unknown) => {
    const parsed = joinSchema.safeParse(input);
    if (parsed.success) socket.leave(parsed.data.roomId);
  });

  socket.on("chat:send", (input: unknown, ack?: (result: unknown) => void) => {
    if (!user.authenticated)
      return ack?.({ error: "Sign in to send chat messages." });
    const parsed = chatSchema.safeParse(input);
    if (!parsed.success) return ack?.({ error: "Invalid message." });
    const { roomId, body, replyToId } = parsed.data;
    if (!socket.rooms.has(roomId))
      return ack?.({ error: "Join the room before sending." });
    if (forbiddenPatterns.some((pattern) => pattern.test(body))) {
      return ack?.({ error: "Message blocked by the safety filter." });
    }
    const now = Date.now();
    const last = messageTimes.get(user.id) ?? 0;
    if (now - last < 1200)
      return ack?.({ error: "Please wait before sending another message." });
    messageTimes.set(user.id, now);
    void (async () => {
      if (!(await canAccessChatRoom(roomId, user.id))) {
        ack?.({ error: "Room membership required." });
        return;
      }
      const room = await prisma.chatRoom.findUnique({
        where: { slug: roomId },
      });
      if (!room) {
        ack?.({ error: "Room not found." });
        return;
      }
      if (replyToId) {
        const reply = await prisma.chatMessage.findFirst({
          where: { id: replyToId, roomId: room.id },
        });
        if (!reply) {
          ack?.({ error: "Reply target is not in this room." });
          return;
        }
      }
      const saved = await prisma.chatMessage.create({
        data: { roomId: room.id, authorId: user.id, body, replyToId },
        include: { author: { select: { id: true, name: true } } },
      });
      const message = {
        id: saved.id,
        roomId,
        body: saved.body,
        replyToId: saved.replyToId,
        author: saved.author,
        createdAt: saved.createdAt.toISOString(),
      };
      io.to(roomId).emit("chat:message", message);
      ack?.({ ok: true, message });
    })().catch((error: unknown) => {
      console.error("Chat message persistence failed.", error);
      ack?.({ error: "Unable to send the message." });
    });
  });

  socket.on("chat:typing", (input: unknown) => {
    if (!user.authenticated) return;
    const parsed = typingSchema.safeParse(input);
    if (!parsed.success || !socket.rooms.has(parsed.data.roomId)) return;
    socket.to(parsed.data.roomId).emit("chat:typing", {
      roomId: parsed.data.roomId,
      userId: user.id,
      active: parsed.data.active,
    });
  });

  socket.on("chat:react", (input: unknown, ack?: (result: unknown) => void) => {
    if (!user.authenticated)
      return ack?.({ error: "Sign in to react to messages." });
    const parsed = reactionSchema.safeParse(input);
    if (!parsed.success || !socket.rooms.has(parsed.data.roomId)) {
      return ack?.({ error: "Join the room before reacting." });
    }
    void (async () => {
      if (!(await canAccessChatRoom(parsed.data.roomId, user.id))) {
        ack?.({ error: "Room membership required." });
        return;
      }
      const room = await prisma.chatRoom.findUnique({
        where: { slug: parsed.data.roomId },
      });
      if (!room) {
        ack?.({ error: "Room not found." });
        return;
      }
      const message = await prisma.chatMessage.findFirst({
        where: { id: parsed.data.messageId, roomId: room.id, deletedAt: null },
        select: { id: true },
      });
      if (!message) {
        ack?.({ error: "Message not found." });
        return;
      }
      const key = {
        messageId_userId_emoji: {
          messageId: message.id,
          userId: user.id,
          emoji: parsed.data.emoji,
        },
      };
      const existing = await prisma.chatReaction.findUnique({ where: key });
      if (existing) await prisma.chatReaction.delete({ where: key });
      else
        await prisma.chatReaction.create({
          data: { ...key.messageId_userId_emoji },
        });
      const totals = await prisma.chatReaction.groupBy({
        by: ["emoji"],
        where: { messageId: message.id },
        _count: { emoji: true },
      });
      const payload = {
        roomId: parsed.data.roomId,
        messageId: message.id,
        reactions: Object.fromEntries(
          totals.map(({ emoji, _count }) => [emoji, _count.emoji]),
        ),
      };
      io.to(parsed.data.roomId).emit("chat:reaction", payload);
      ack?.({ ok: true, ...payload });
    })().catch((error: unknown) => {
      console.error("Chat reaction update failed.", error);
      ack?.({ error: "Unable to update this reaction." });
    });
  });

  socket.on(
    "ranking:subscribe",
    (input: unknown, ack?: (result: unknown) => void) => {
      const parsed = rankingSchema.safeParse(input);
      if (!parsed.success)
        return ack?.({ error: "Invalid ranking subscription." });
      const channel = `ranking:${parsed.data.gameSlug}:${parsed.data.period}:${parsed.data.region ?? "Global"}`;
      socket.join(channel);
      ack?.({ ok: true, channel });
    },
  );

  socket.on("disconnect", () => {
    if (!user.authenticated) return;
    const remaining = Math.max(0, (online.get(user.id) ?? 1) - 1);
    if (remaining === 0) online.delete(user.id);
    else online.set(user.id, remaining);
    io.emit("presence:update", {
      userId: user.id,
      state: remaining === 0 ? "offline" : "online",
      onlineCount: online.size,
    });
  });
});

if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  const rankingSubscriber = pubClient.duplicate();
  for (const client of [pubClient, subClient, rankingSubscriber]) {
    client.on("error", (error: unknown) =>
      console.error("Realtime Redis connection error.", error),
    );
  }
  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
    rankingSubscriber.connect(),
  ]);
  io.adapter(createAdapter(pubClient, subClient));
  const rankingEventSchema = z.object({
    gameSlug: rankingSchema.shape.gameSlug,
    period: rankingSchema.shape.period,
    region: z.string().max(32),
    entries: z.array(
      z.object({
        registrationId: z.string(),
        subjectId: z.string(),
        subjectType: z.enum(["player", "team"]),
        points: z.number().int(),
        rating: z.number().int(),
        rank: z.number().int(),
      }),
    ),
    updatedAt: z.string().datetime(),
  });
  const registrationEventSchema = z.object({
    type: z.enum(["registration:created", "registration:updated", "registration:cancelled"]),
    tournamentId: z.string().min(1).max(64),
    registration: z.object({
      id: z.string().min(1).max(64),
      teamName: z.string().max(24),
      region: z.string().max(32),
      mode: z.string().max(16),
      status: z.string().max(24),
    }),
    slots: z.object({
      registered: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      waitlist: z.number().int().nonnegative(),
    }),
    updatedAt: z.string().datetime(),
  });
  await rankingSubscriber.subscribe("ranking-events", (message) => {
    try {
      const event = rankingEventSchema.parse(JSON.parse(message) as unknown);
      io.to(`ranking:${event.gameSlug}:${event.period}:${event.region}`).emit(
        "ranking:update",
        event,
      );
    } catch (error) {
      console.error("Invalid ranking event received from Redis.", error);
    }
  });
  await rankingSubscriber.subscribe("tournament-registration-events", (message) => {
    try {
      const event = registrationEventSchema.parse(JSON.parse(message) as unknown);
      const room = `tournament:${event.tournamentId}`;
      io.to(room).emit(event.type, event);
      io.to(room).emit("slots:updated", {
        tournamentId: event.tournamentId,
        ...event.slots,
        updatedAt: event.updatedAt,
      });
    } catch (error) {
      console.error("Invalid tournament registration event received from Redis.", error);
    }
  });
}

httpServer.listen(port, () => {
  console.log(`ClutchVerse realtime server listening on :${port}`);
});
