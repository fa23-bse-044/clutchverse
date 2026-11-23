type MatchResultValues = {
  scoreA: number;
  scoreB: number;
  placementA?: number | null;
  placementB?: number | null;
  killsA?: number | null;
  killsB?: number | null;
};

export function matchResultsAgree(
  first: MatchResultValues,
  second: MatchResultValues,
): boolean {
  return (
    first.scoreA === second.scoreA &&
    first.scoreB === second.scoreB &&
    (first.placementA ?? null) === (second.placementA ?? null) &&
    (first.placementB ?? null) === (second.placementB ?? null) &&
    (first.killsA ?? null) === (second.killsA ?? null) &&
    (first.killsB ?? null) === (second.killsB ?? null)
  );
}
