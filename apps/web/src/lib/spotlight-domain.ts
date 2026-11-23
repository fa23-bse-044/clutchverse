export type SpotlightSourceType = "provider" | "admin" | "ai_assisted_verified";

export const ISO_3166_ALPHA_2 = new Set(
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(
    " ",
  ),
);

export type SpotlightCsvTeam = {
  team: string;
  country: string;
  path?: string;
  source_url: string;
};

const sourcePriority: Record<SpotlightSourceType, number> = {
  ai_assisted_verified: 1,
  provider: 2,
  admin: 3,
};

export function isValidSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isIsoCountryCode(value: string): boolean {
  return ISO_3166_ALPHA_2.has(value.trim().toUpperCase());
}

export function countryFlagEmoji(code: string): string {
  return [...code.toUpperCase()].map((letter) =>
    String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65),
  ).join("");
}

export function parseSpotlightCsv(csv: string): SpotlightCsvTeam[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  while (rows.at(-1)?.every((value) => !value)) rows.pop();
  if (rows.length < 2 || rows.length > 501) {
    throw new Error("CSV must contain a header and between 1 and 500 teams.");
  }
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  for (const required of ["team", "country", "source_url"]) {
    if (!headers.includes(required))
      throw new Error(`CSV is missing the ${required} column.`);
  }
  const at = (cells: string[], key: string) => cells[headers.indexOf(key)]?.trim() ?? "";
  const seen = new Set<string>();
  return rows.slice(1).map((cells, index) => {
    const team = at(cells, "team");
    const country = at(cells, "country").toUpperCase();
    const source_url = at(cells, "source_url");
    const path = at(cells, "path");
    if (!team || team.length > 100)
      throw new Error(`Row ${index + 2} has an invalid team name.`);
    if (!isIsoCountryCode(country))
      throw new Error(`Row ${index + 2} has an invalid ISO country code.`);
    if (!isValidSourceUrl(source_url))
      throw new Error(`Row ${index + 2} needs a valid source URL.`);
    const key = team.normalize("NFKC").toLocaleLowerCase("en-US");
    if (seen.has(key))
      throw new Error(`Row ${index + 2} duplicates a team name.`);
    seen.add(key);
    return { team, country, path: path || undefined, source_url };
  });
}

export function shouldReplaceSpotlightRecord(
  existing: { sourceType: SpotlightSourceType; pinned: boolean },
  incoming: SpotlightSourceType,
): boolean {
  if (existing.pinned) return false;
  return sourcePriority[incoming] >= sourcePriority[existing.sourceType];
}

export function summarizeSpotlightCounts(
  participations: Array<{ countryCode: string; status: string }>,
  totalSlots: number | null,
  stageCount: number,
  prizePool: string | null,
) {
  const confirmed = participations.filter(
    (participation) => participation.status === "confirmed",
  );
  return {
    confirmedTeams: confirmed.length,
    totalSlots,
    countries: new Set(confirmed.map(({ countryCode }) => countryCode)).size,
    stages: stageCount,
    prizePool,
  };
}

export function parseSourceType(value: string): SpotlightSourceType {
  if (value === "admin" || value === "provider" || value === "ai_assisted_verified")
    return value;
  throw new Error("Unknown spotlight source type.");
}

export function isSpotlightDraftReviewable(status: string): boolean {
  return status === "pending";
}
