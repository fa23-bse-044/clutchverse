import { describe, expect, it } from "vitest";
import {
  battleRoyalePoints,
  DemoPaymentAdapter,
  eloChange,
  generateRoundRobin,
  generateSingleEliminationBracket,
  hasPermission,
  rankTier,
  MemoryEmailAdapter,
  MemoryStorageAdapter,
  resolveStreamEmbed,
} from "../src/index.js";

describe("tournament formats", () => {
  it("generates a complete bracket and advances a bye", () => {
    const bracket = generateSingleEliminationBracket([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
      { id: "c", name: "Charlie" },
    ]);
    expect(bracket).toHaveLength(3);
    expect(bracket[1]?.state).toBe("bye");
    expect(bracket[1]?.winner?.id).toBe("c");
  });

  describe("external-service development adapters", () => {
    it("keeps demo payments pending and never marks them paid", async () => {
      const result = await new DemoPaymentAdapter().createCheckout({
        userId: "player-1",
        amount: 500,
        currency: "USD",
        description: "Test entry",
      });
      expect(result.status).toBe("pending");
      expect(result.provider).toBe("demo");
    });

    it("validates uploads and stores demo objects in memory", async () => {
      const storage = new MemoryStorageAdapter();
      const uploaded = await storage.upload({
        name: "clip.png",
        contentType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      });
      expect((await storage.read(uploaded.key))?.bytes).toEqual(new Uint8Array([1, 2, 3]));
      await expect(storage.upload({
        name: "clip.exe",
        contentType: "application/octet-stream",
        bytes: new Uint8Array([1]),
      })).rejects.toThrow(RangeError);
    });

    it("queues valid demo email and restricts video embeds to known providers", async () => {
      const email = new MemoryEmailAdapter();
      await email.send({ to: "player@example.com", subject: "Match reminder", text: "Your match is next." });
      expect(email.outbox).toHaveLength(1);
      expect(resolveStreamEmbed("https://youtu.be/dQw4w9WgXcQ", "https://clutchverse.gg")?.provider).toBe("youtube");
      expect(resolveStreamEmbed("https://attacker.example/watch", "https://clutchverse.gg")).toBeNull();
    });
  });

  it("pairs each round-robin entrant exactly once", () => {
    expect(
      generateRoundRobin([
        { id: "a", name: "Alpha" },
        { id: "b", name: "Bravo" },
        { id: "c", name: "Charlie" },
      ]),
    ).toHaveLength(3);
  });
});

describe("competitive scoring and authorization", () => {
  it("scores battle royale placement and eliminations", () => {
    expect(battleRoyalePoints(1, 4)).toBe(14);
    expect(() => battleRoyalePoints(0, 0)).toThrow(RangeError);
  });

  it("updates Elo and maps ratings to tiers", () => {
    expect(eloChange(1000, 1000, 1)).toBe(1016);
    expect(rankTier(1920)).toBe("Master");
  });

  it("keeps admin permissions separate from player permissions", () => {
    expect(hasPermission("admin", "admin:access")).toBe(true);
    expect(hasPermission("player", "admin:access")).toBe(false);
  });
});
