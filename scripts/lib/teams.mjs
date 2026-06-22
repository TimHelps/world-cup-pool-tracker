// Pure helpers for matching football-data.org API data to our pool's team
// list and turning match results into W/D/L/points. Kept dependency-free and
// side-effect-free so they're easy to unit test (see tests/teams.test.mjs).

// Our canonical team list (code -> display name), derived from the pool picks.
export const CODE_TO_NAME = {
  GHA: "Ghana", EGY: "Egypt",
  NZL: "New Zealand", ALG: "Algeria", ARG: "Argentina",
  BIH: "Bosnia and Herzegovina", PAR: "Paraguay", NED: "Netherlands",
  IRQ: "Iraq", PAN: "Panama", ESP: "Spain", USA: "USA",
  SWE: "Sweden", HAI: "Haiti", NOR: "Norway", BRA: "Brazil",
  CIV: "Ivory Coast", JOR: "Jordan", AUS: "Australia", CRO: "Croatia",
  CUW: "Curacao", AUT: "Austria", MEX: "Mexico",
  RSA: "South Africa", ECU: "Ecuador", CAN: "Canada",
  KSA: "Saudi Arabia", SCO: "Scotland", POR: "Portugal",
  TUR: "Turkey", IRN: "Iran", MAR: "Morocco",
  QAT: "Qatar", KOR: "South Korea", ENG: "England",
  CPV: "Cape Verde", SEN: "Senegal", COL: "Colombia",
  TUN: "Tunisia", JPN: "Japan", FRA: "France",
  CZE: "Czechia", COD: "DR Congo", SUI: "Switzerland", BEL: "Belgium",
  UZB: "Uzbekistan", URU: "Uruguay", GER: "Germany",
};

// Alternate spellings football-data.org might use for tricky names. Matching
// is normalized (lowercase, accents stripped, punctuation removed) so most of
// these are belt-and-suspenders; the team's "tla" code is tried first.
export const ALIASES = {
  USA: ["United States", "USA", "United States of America"],
  KOR: ["South Korea", "Korea Republic", "Korea, South"],
  IRN: ["Iran", "IR Iran"],
  CIV: ["Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire"],
  CZE: ["Czechia", "Czech Republic"],
  CUW: ["Curacao", "Curaçao"],
  COD: ["DR Congo", "Congo DR", "Congo-Kinshasa"],
  BIH: ["Bosnia and Herzegovina", "Bosnia & Herzegovina", "Bosnia"],
  KSA: ["Saudi Arabia", "KSA"],
};

export function normalize(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function buildCandidates() {
  // code -> Set of normalized candidate strings
  const map = new Map();
  for (const [code, name] of Object.entries(CODE_TO_NAME)) {
    const candidates = new Set([normalize(name), ...(ALIASES[code] || []).map(normalize)]);
    map.set(code, candidates);
  }
  return map;
}

export function matchCode(team, candidateMap) {
  if (!team || !team.name) return null;
  if (team.tla && CODE_TO_NAME[team.tla]) return team.tla;
  const normalized = normalize(team.name);
  for (const [code, candidates] of candidateMap) {
    if (candidates.has(normalized)) return code;
  }
  return null;
}

export const STAGE_LABELS = {
  GROUP_STAGE: "Group Stage",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "3rd Place Final",
  FINAL: "Final",
};

export function simplifyStage(stage) {
  return STAGE_LABELS[stage] || stage || "Group Stage";
}

export function isKnockoutStage(stage) {
  return stage !== "GROUP_STAGE";
}

// football-data.org nests full-time scores at score.fullTime.{home,away}.
// Returns nulls (rather than throwing) if that shape isn't there, so one
// malformed fixture record degrades to "not finished" instead of crashing
// the whole batch.
export function extractScore(fx, isHome) {
  const fullTime = fx?.score?.fullTime;
  if (!fullTime) return { scoreFor: null, scoreAgainst: null };
  const scoreFor = isHome ? fullTime.home : fullTime.away;
  const scoreAgainst = isHome ? fullTime.away : fullTime.home;
  return { scoreFor: scoreFor ?? null, scoreAgainst: scoreAgainst ?? null };
}

export function classifyResult(scoreFor, scoreAgainst) {
  if (scoreFor > scoreAgainst) return { result: "W", points: 3 };
  if (scoreFor === scoreAgainst) return { result: "D", points: 1 };
  return { result: "L", points: 0 };
}

// Ranks teams within a group by points, then goal difference, then goals
// for. Doesn't implement head-to-head or disciplinary-points tiebreakers.
// Returns a new array (input objects are referenced, not mutated) ordered
// best-to-worst; callers assign position = index + 1.
export function rankGroup(teams) {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}
