export type CheckoutRequest = {
  userId: string;
  amount: number;
  currency: string;
  description: string;
};

export type CheckoutResult = {
  reference: string;
  status: "pending";
  provider: "demo";
};

export interface PaymentAdapter {
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

export interface StorageAdapter {
  upload(input: { name: string; contentType: string; bytes: Uint8Array }): Promise<{ key: string; url: string }>;
  read(key: string): Promise<{ contentType: string; bytes: Uint8Array } | null>;
}

export interface EmailAdapter {
  send(input: { to: string; subject: string; text: string }): Promise<{ queued: boolean }>;
}

export type StreamEmbed =
  | { provider: "youtube"; src: string }
  | { provider: "twitch"; src: string };

export class DemoPaymentAdapter implements PaymentAdapter {
  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    if (!request.userId || !Number.isSafeInteger(request.amount) || request.amount <= 0) {
      throw new RangeError("A user and a positive integer amount are required.");
    }
    return {
      reference: `demo_${globalThis.crypto.randomUUID()}`,
      status: "pending",
      provider: "demo",
    };
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, { contentType: string; bytes: Uint8Array }>();

  async upload(input: { name: string; contentType: string; bytes: Uint8Array }) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"]);
    const maxBytes = input.contentType.startsWith("video/") ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (!allowed.has(input.contentType) || input.bytes.byteLength === 0 || input.bytes.byteLength > maxBytes) {
      throw new RangeError("File type or size is not allowed.");
    }
    const key = `${globalThis.crypto.randomUUID()}/${input.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)}`;
    this.objects.set(key, { contentType: input.contentType, bytes: input.bytes.slice() });
    return { key, url: `memory://uploads/${encodeURIComponent(key)}` };
  }

  async read(key: string) {
    const value = this.objects.get(key);
    return value ? { contentType: value.contentType, bytes: value.bytes.slice() } : null;
  }
}

export class MemoryEmailAdapter implements EmailAdapter {
  readonly outbox: Array<{ to: string; subject: string; text: string }> = [];

  async send(input: { to: string; subject: string; text: string }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to) || !input.subject.trim() || !input.text.trim()) {
      throw new TypeError("A valid recipient, subject, and message are required.");
    }
    this.outbox.push({ ...input });
    return { queued: true };
  }
}

export function resolveStreamEmbed(input: string, parentOrigin: string): StreamEmbed | null {
  let url: URL;
  let parent: URL;
  try {
    url = new URL(input);
    parent = new URL(parentOrigin);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;

  if (["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"].includes(url.hostname)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const id = url.hostname === "youtu.be"
      ? segments[0]
      : url.searchParams.get("v") ?? (["embed", "live", "shorts"].includes(segments[0] ?? "") ? segments[1] : undefined);
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  if (["twitch.tv", "www.twitch.tv"].includes(url.hostname)) {
    const channel = url.pathname.split("/").filter(Boolean)[0];
    if (!channel || !/^[a-zA-Z0-9_]{3,25}$/.test(channel)) return null;
    if (!["https:", "http:"].includes(parent.protocol)) return null;
    return {
      provider: "twitch",
      src: `https://player.twitch.tv/?channel=${encodeURIComponent(channel.toLowerCase())}&parent=${encodeURIComponent(parent.hostname)}`,
    };
  }
  return null;
}
