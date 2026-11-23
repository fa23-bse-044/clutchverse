import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const MAX_CREATOR_CLIP_BYTES = 100 * 1024 * 1024;
const allowedTypes = new Set(["video/mp4", "video/webm"]);

function storageDirectory() {
  if (process.env.NODE_ENV === "production" && !process.env.CREATOR_MEDIA_DIRECTORY) {
    throw new Error("CREATOR_MEDIA_DIRECTORY_REQUIRED");
  }
  return resolve(
    process.env.CREATOR_MEDIA_DIRECTORY ??
      join(process.env.TMPDIR ?? "/tmp", "clutchverse-creator-media"),
  );
}

export async function saveCreatorClip(file: File) {
  if (!allowedTypes.has(file.type) || file.size < 16 || file.size > MAX_CREATOR_CLIP_BYTES) {
    throw new Error("INVALID_CREATOR_CLIP");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const isMp4 =
    file.type === "video/mp4" &&
    bytes.subarray(4, 8).toString("ascii") === "ftyp";
  const isWebm =
    file.type === "video/webm" &&
    bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!isMp4 && !isWebm) throw new Error("INVALID_CREATOR_CLIP_SIGNATURE");
  const storageKey = `${randomUUID()}.${isMp4 ? "mp4" : "webm"}`;
  const directory = storageDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, storageKey), bytes, { flag: "wx", mode: 0o600 });
  return {
    storageKey,
    mimeType: file.type,
    sizeBytes: bytes.byteLength,
  };
}

export async function readCreatorClip(storageKey: string) {
  if (!/^[a-f0-9-]{36}\.(mp4|webm)$/.test(storageKey)) {
    throw new Error("INVALID_CREATOR_CLIP_KEY");
  }
  return readFile(join(storageDirectory(), storageKey));
}

export async function deleteCreatorClip(storageKey: string) {
  if (!/^[a-f0-9-]{36}\.(mp4|webm)$/.test(storageKey)) {
    throw new Error("INVALID_CREATOR_CLIP_KEY");
  }
  await rm(join(storageDirectory(), storageKey), { force: true });
}
