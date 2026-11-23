import type { Prisma } from "@clutchverse/db";

export function nextBracketSlot(position: number): {
  position: number;
  entrantField: "entrantAId" | "entrantBId";
} {
  return {
    position: Math.ceil(position / 2),
    entrantField: position % 2 === 1 ? "entrantAId" : "entrantBId",
  };
}

export async function finalizeMatchResult(
  transaction: Prisma.TransactionClient,
  input: {
    matchId: string;
    scoreA: number;
    scoreB: number;
    winnerRegistrationId?: string;
  },
) {
  if (input.scoreA === input.scoreB) {
    throw new Error("A completed match must have a winner.");
  }
  const match = await transaction.match.findUnique({
    where: { id: input.matchId },
    include: { tournament: { select: { format: true } } },
  });
  if (!match) throw new Error("MATCH_NOT_FOUND");
  const winnerRegistrationId =
    input.winnerRegistrationId ??
    (input.scoreA > input.scoreB ? match.entrantAId : match.entrantBId);
  if (
    !winnerRegistrationId ||
    ![match.entrantAId, match.entrantBId].includes(winnerRegistrationId)
  ) {
    throw new Error("WINNER_NOT_IN_MATCH");
  }
  const saved = await transaction.match.update({
    where: { id: match.id },
    data: {
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      winnerRegistrationId,
      state: "completed",
    },
  });
  if (match.tournament.format === "SINGLE_ELIMINATION") {
    const nextSlot = nextBracketSlot(match.position);
    const nextMatch = await transaction.match.findUnique({
      where: {
        tournamentId_round_position: {
          tournamentId: match.tournamentId,
          round: match.round + 1,
          position: nextSlot.position,
        },
      },
      select: { id: true, entrantAId: true, entrantBId: true },
    });
    if (nextMatch) {
      const current =
        nextSlot.entrantField === "entrantAId"
          ? nextMatch.entrantAId
          : nextMatch.entrantBId;
      if (current && current !== winnerRegistrationId)
        throw new Error("NEXT_BRACKET_SLOT_ALREADY_ASSIGNED");
      if (!current) {
        const assigned =
          nextSlot.entrantField === "entrantAId"
            ? await transaction.match.updateMany({
                where: { id: nextMatch.id, entrantAId: null },
                data: { entrantAId: winnerRegistrationId },
              })
            : await transaction.match.updateMany({
                where: { id: nextMatch.id, entrantBId: null },
                data: { entrantBId: winnerRegistrationId },
              });
        if (assigned.count !== 1)
          throw new Error("NEXT_BRACKET_SLOT_ALREADY_ASSIGNED");
      }
    }
  }
  return saved;
}
