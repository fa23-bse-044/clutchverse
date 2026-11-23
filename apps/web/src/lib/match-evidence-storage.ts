import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const extensionForMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function storageDirectory(): string {
  const configured = process.env.MATCH_EVIDENCE_DIRECTORY;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("MATCH_EVIDENCE_STORAGE_NOT_CONFIGURED");
  }
  return path.resolve(
    configured ?? path.join(tmpdir(), "clutchverse-match-evidence"),
  );
}

function resolveStorageKey(storageKey: string): string {
  if (!/^[\da-f-]{36}\.(?:jpg|png|webp)$/.test(storageKey)) {
    throw new Error("INVALID_MATCH_EVIDENCE_KEY");
  }
  return path.join(storageDirectory(), storageKey);
}

export async function saveMatchEvidence(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const extension = extensionForMime[mimeType];
  if (!extension) throw new Error("UNSUPPORTED_MATCH_EVIDENCE_TYPE");
  const storageKey = `${randomUUID()}${extension}`;
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(path.join(directory, storageKey), bytes, { mode: 0o600, flag: "wx" });
  return storageKey;
}

export async function readMatchEvidence(storageKey: string): Promise<Buffer> {
  return readFile(resolveStorageKey(storageKey));
}

export async function removeMatchEvidence(storageKey: string): Promise<void> {
  await unlink(resolveStorageKey(storageKey));
}

export function isSupportedMatchEvidenceType(mimeType: string): boolean {
  return Object.hasOwn(extensionForMime, mimeType);
}

export function isMatchEvidenceStorageConfigured(): boolean {
  return Boolean(process.env.MATCH_EVIDENCE_DIRECTORY) || process.env.NODE_ENV !== "production";
}
