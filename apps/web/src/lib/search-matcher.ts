export type Ranked<T> = { item: T; score: number };

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(left: string, right: string): number {
  if (Math.abs(left.length - right.length) > 2) return 3;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function tokenScore(queryToken: string, textToken: string): number {
  if (queryToken === textToken) return 1;
  if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) {
    return 0.82;
  }
  const distance = editDistance(queryToken, textToken);
  const allowedDistance = queryToken.length >= 7 ? 2 : queryToken.length >= 4 ? 1 : 0;
  return distance <= allowedDistance ? 0.74 - distance * 0.12 : 0;
}

export function rankCandidates<T>(
  query: string,
  candidates: readonly T[],
  getText: (candidate: T) => string,
): Ranked<T>[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const queryTokens = normalizedQuery.split(" ");

  return candidates
    .map((item) => {
      const text = normalize(getText(item));
      const textTokens = text.split(" ");
      const score =
        text === normalizedQuery
          ? 1
          : text.includes(normalizedQuery)
            ? 0.96
            : queryTokens.reduce((sum, token) => {
                const best = textTokens.reduce(
                  (current, word) => Math.max(current, tokenScore(token, word)),
                  0,
                );
                return sum + best;
              }, 0) / queryTokens.length;
      return { item, score };
    })
    .filter(({ score }) => score >= 0.5)
    .sort((left, right) => right.score - left.score);
}
