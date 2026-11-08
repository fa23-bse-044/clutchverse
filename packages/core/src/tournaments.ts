export type Entrant = { id: string; name: string };
export type BracketMatch = {
  round: number;
  position: number;
  playerA: Entrant | null;
  playerB: Entrant | null;
  winner: Entrant | null;
  state: "scheduled" | "bye";
};

export function generateSingleEliminationBracket(
  entrants: Entrant[],
): BracketMatch[] {
  if (entrants.length < 2) {
    throw new RangeError("at least two entrants are required");
  }
  const size = 2 ** Math.ceil(Math.log2(entrants.length));
  const firstRound: BracketMatch[] = [];

  for (let index = 0; index < size; index += 2) {
    const playerA = entrants[index] ?? null;
    const playerB = entrants[index + 1] ?? null;
    const winner = playerA && !playerB ? playerA : null;
    firstRound.push({
      round: 1,
      position: index / 2 + 1,
      playerA,
      playerB,
      winner,
      state: winner ? "bye" : "scheduled",
    });
  }

  const matches = [...firstRound];
  let matchesInRound = firstRound.length;
  let round = 2;
  while (matchesInRound > 1) {
    const nextRound = Math.ceil(matchesInRound / 2);
    for (let position = 1; position <= nextRound; position += 1) {
      matches.push({
        round,
        position,
        playerA: null,
        playerB: null,
        winner: null,
        state: "scheduled",
      });
    }
    matchesInRound = nextRound;
    round += 1;
  }
  return matches;
}

export function generateRoundRobin(entrants: Entrant[]): [Entrant, Entrant][] {
  if (entrants.length < 2) {
    throw new RangeError("at least two entrants are required");
  }
  const schedule: [Entrant, Entrant][] = [];
  for (let left = 0; left < entrants.length; left += 1) {
    for (let right = left + 1; right < entrants.length; right += 1) {
      schedule.push([entrants[left]!, entrants[right]!]);
    }
  }
  return schedule;
}
