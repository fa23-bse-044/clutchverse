import { z } from "zod";
import type { GameSlug } from "@clutchverse/core";

const rosterMemberSchema = z.object({
  inGameName: z.string().trim().min(2).max(40),
  inGameId: z.string().trim().min(2).max(80),
});

export const tournamentRegistrationInputSchema = z.object({
  mode: z.enum(["solo", "duo", "squad"]),
  teamName: z.string().trim().min(3).max(24).optional(),
  teamTag: z.string().trim().regex(/^[A-Za-z0-9]{2,6}$/).optional(),
  platform: z.string().trim().min(2).max(32),
  region: z.string().trim().min(2).max(32),
  members: z.array(rosterMemberSchema).min(1).max(6),
  substitutes: z.array(rosterMemberSchema).max(2).default([]),
  eligibilityConfirmed: z.literal(true),
  rulesAccepted: z.literal(true),
  idempotencyKey: z.string().uuid(),
});

export type TournamentRegistrationInput = z.infer<
  typeof tournamentRegistrationInputSchema
>;

const gameModeConfig: Record<
  GameSlug,
  {
    modes: Array<"solo" | "duo" | "squad">;
    sizes: Record<string, number>;
    platforms: string[];
    idPattern: RegExp;
  }
> = {
  "pubg-mobile": {
    modes: ["solo", "duo", "squad"],
    sizes: { solo: 1, duo: 2, squad: 4 },
    platforms: ["Android", "iOS"],
    idPattern: /^\d{5,20}$/,
  },
  "free-fire": {
    modes: ["solo", "duo", "squad"],
    sizes: { solo: 1, duo: 2, squad: 4 },
    platforms: ["Android", "iOS"],
    idPattern: /^\d{6,14}$/,
  },
  "tekken-8": {
    modes: ["solo"],
    sizes: { solo: 1 },
    platforms: ["PlayStation 5", "Xbox Series X|S", "PC"],
    idPattern: /^[\p{L}\p{N}_. -]{2,40}$/u,
  },
  fifa: {
    modes: ["solo", "duo"],
    sizes: { solo: 1, duo: 2 },
    platforms: ["PlayStation", "Xbox", "PC"],
    idPattern: /^[\p{L}\p{N}_. -]{2,40}$/u,
  },
};

export function getTournamentRegistrationConfig(game: GameSlug) {
  const { modes, sizes, platforms, idPattern } = gameModeConfig[game];
  return { modes, sizes, platforms, idPattern };
}

export function getAllowedRegistrationModes(
  game: GameSlug,
  allowedModes?: string[],
) {
  return allowedModes
    ? gameModeConfig[game].modes.filter((mode) => allowedModes.includes(mode))
    : gameModeConfig[game].modes;
}

export function validateTournamentRegistration(
  input: unknown,
  game: GameSlug,
  allowedModes?: string[],
) {
  const parsed = tournamentRegistrationInputSchema.safeParse(input);
  if (!parsed.success) return parsed;
  const invalid = (message: string) => ({
    success: false as const,
    error: { message },
  });
  const config = gameModeConfig[game];
  const modes = getAllowedRegistrationModes(game, allowedModes);
  if (!modes.includes(parsed.data.mode)) {
    return invalid("This registration mode is not enabled for the tournament.");
  }
  if (parsed.data.members.length !== config.sizes[parsed.data.mode]) {
    return invalid(
      `${parsed.data.mode} registration requires ${config.sizes[parsed.data.mode]} player(s).`,
    );
  }
  if (parsed.data.mode !== "solo" && !parsed.data.teamName) {
    return invalid("Enter a team name for duo or squad registration.");
  }
  if (!config.platforms.some(
    (platform) => platform.toLowerCase() === parsed.data.platform.toLowerCase(),
  )) {
    return invalid("Select a platform supported by this game.");
  }
  if (
    parsed.data.teamTag &&
    parsed.data.mode === "solo"
  ) {
    return invalid("A team tag is only valid for duo or squad entries.");
  }
  if (parsed.data.substitutes.length && parsed.data.mode !== "squad") {
    return invalid("Substitutes are only supported for squad registration.");
  }
  if (
    [...parsed.data.members, ...parsed.data.substitutes].some(
      ({ inGameId }) => !config.idPattern.test(inGameId),
    )
  ) {
    return invalid("An in-game ID does not match the selected game's ID format.");
  }
  if (
    parsed.data.teamName &&
    (/\b(?:admin|moderator|support|clutchverse)\b/i.test(parsed.data.teamName) ||
      /\b(?:fuck|shit|bitch|asshole)\b/i.test(parsed.data.teamName))
  ) {
    return invalid("This team name is reserved or not allowed.");
  }
  const ids = [...parsed.data.members, ...parsed.data.substitutes].map(
    ({ inGameId }) => inGameId.toLowerCase(),
  );
  if (new Set(ids).size !== ids.length) {
    return invalid("Each player must have a different in-game ID.");
  }
  return { success: true as const, data: parsed.data };
}

export function normalizeTeamName(value: string): string {
  return value
    .trim()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

export function getRegistrationStatus(
  registeredEntries: number,
  capacity: number,
): "registered" | "waitlisted" {
  return registeredEntries >= capacity ? "waitlisted" : "registered";
}
