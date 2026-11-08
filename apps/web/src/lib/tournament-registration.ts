import { z } from "zod";
import type { GameSlug } from "@clutchverse/core";

export const tournamentRegistrationInputSchema = z.object({
  mode: z.enum(["solo", "duo", "squad"]),
  teamName: z.string().trim().min(3).max(24).optional(),
  region: z.string().trim().min(2).max(32),
  members: z
    .array(
      z.object({
        inGameName: z.string().trim().min(2).max(40),
        inGameId: z.string().trim().min(2).max(80),
      }),
    )
    .min(1)
    .max(6),
  eligibilityConfirmed: z.literal(true),
  rulesAccepted: z.literal(true),
  idempotencyKey: z.string().uuid(),
});

export type TournamentRegistrationInput = z.infer<
  typeof tournamentRegistrationInputSchema
>;

const gameModeConfig: Record<
  GameSlug,
  { modes: Array<"solo" | "duo" | "squad">; sizes: Record<string, number> }
> = {
  "pubg-mobile": {
    modes: ["solo", "duo", "squad"],
    sizes: { solo: 1, duo: 2, squad: 4 },
  },
  "free-fire": {
    modes: ["solo", "duo", "squad"],
    sizes: { solo: 1, duo: 2, squad: 4 },
  },
  "tekken-8": { modes: ["solo"], sizes: { solo: 1 } },
  fifa: { modes: ["solo", "duo"], sizes: { solo: 1, duo: 2 } },
};

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
  const modes = allowedModes
    ? config.modes.filter((mode) => allowedModes.includes(mode))
    : config.modes;
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
  if (
    parsed.data.teamName &&
    (/\b(?:admin|moderator|support|clutchverse)\b/i.test(parsed.data.teamName) ||
      /\b(?:fuck|shit|bitch|asshole)\b/i.test(parsed.data.teamName))
  ) {
    return invalid("This team name is reserved or not allowed.");
  }
  const ids = parsed.data.members.map(({ inGameId }) => inGameId.toLowerCase());
  if (new Set(ids).size !== ids.length) {
    return invalid("Each player must have a different in-game ID.");
  }
  return { success: true as const, data: parsed.data };
}

export function normalizeTeamName(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

export function getRegistrationStatus(
  registeredEntries: number,
  capacity: number,
): "registered" | "waitlisted" {
  return registeredEntries >= capacity ? "waitlisted" : "registered";
}
