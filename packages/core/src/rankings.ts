export type Placement = {
  team: string;
  place: number;
  eliminations: number;
};

export function battleRoyalePoints(
  placement: number,
  eliminations: number,
): number {
  if (!Number.isInteger(placement) || placement < 1) {
    throw new RangeError("placement must be a positive integer");
  }
  if (!Number.isInteger(eliminations) || eliminations < 0) {
    throw new RangeError("eliminations must be a non-negative integer");
  }
  const placementPoints = [10, 6, 5, 4, 3, 2, 1];
  return (placementPoints[placement - 1] ?? 0) + eliminations;
}

export function eloChange(
  rating: number,
  opponentRating: number,
  score: 0 | 0.5 | 1,
  kFactor = 32,
): number {
  if (![rating, opponentRating, kFactor].every(Number.isFinite) || kFactor <= 0) {
    throw new RangeError("ratings must be finite and kFactor must be positive");
  }
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  return Math.round(rating + kFactor * (score - expected));
}

export function rankTier(rating: number): string {
  if (rating >= 2200) return "Elite";
  if (rating >= 1900) return "Master";
  if (rating >= 1600) return "Diamond";
  if (rating >= 1300) return "Platinum";
  if (rating >= 1000) return "Gold";
  return "Rookie";
}

export function rankByRating<T extends { rating: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.rating - a.rating);
}
