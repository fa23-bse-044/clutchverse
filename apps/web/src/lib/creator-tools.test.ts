import { describe, expect, it } from "vitest";
import { newCreatorToken } from "./creator-tools";

describe("creator overlay tokens", () => {
  it("creates unguessable URL-safe token material", () => {
    const first = newCreatorToken();
    const second = newCreatorToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });
});
