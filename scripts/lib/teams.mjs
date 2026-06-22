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

function emptyTeam(code, owner) {
  return {
    code,
    name: CODE_TO_NAME[code],
    owner,
    group: null,
    groupPosition: null,
    stage: "Group Stage",
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    eliminated: false,
    recent: [],
    next: null,
  };
}

// Turns a list of football-data.org fixtures plus the pool's owner mapping
// into per-team stats, recent results, next fixture and group position.
// Pure and side-effect-free (no console output, no I/O) so it's testable
// without mocking the network or filesystem — see tests/teams.test.mjs.
// `now` is injectable so tests can pin "what counts as upcoming".
export function buildTeamsData(fixtures, people, now = Date.now()) {
  const candidateMap = buildCandidates();

  const codeToOwner = {};
  for (const [owner, codes] of Object.entries(people)) {
    for (const code of codes) codeToOwner[code] = owner;
  }

  const teams = {};
  for (const code of Object.keys(CODE_TO_NAME)) {
    teams[code] = emptyTeam(code, codeToOwner[code] || null);
  }

  const unmatchedApiTeams = new Set();
  const malformedFixtures = [];
  const fixturesByTeam = new Map(Object.keys(CODE_TO_NAME).map((c) => [c, []]));

  for (const fx of fixtures) {
    try {
      const homeCode = matchCode(fx.homeTeam, candidateMap);
      const awayCode = matchCode(fx.awayTeam, candidateMap);
      if (!homeCode && fx.homeTeam?.name) unmatchedApiTeams.add(fx.homeTeam.name);
      if (!awayCode && fx.awayTeam?.name) unmatchedApiTeams.add(fx.awayTeam.name);

      const groupLabel = fx.group ? fx.group.replace("GROUP_", "") : null;
      if (homeCode && groupLabel) teams[homeCode].group = groupLabel;
      if (awayCode && groupLabel) teams[awayCode].group = groupLabel;

      if (homeCode) fixturesByTeam.get(homeCode).push({ fx, isHome: true, opponentCode: awayCode });
      if (awayCode) fixturesByTeam.get(awayCode).push({ fx, isHome: false, opponentCode: homeCode });
    } catch (err) {
      malformedFixtures.push(`fixture ${fx?.id ?? "?"}: ${err.message}`);
    }
  }

  for (const code of Object.keys(CODE_TO_NAME)) {
    const team = teams[code];
    const entries = fixturesByTeam.get(code) || [];
    entries.sort((a, b) => new Date(a.fx.utcDate) - new Date(b.fx.utcDate));

    let latestStage = null;

    for (const entry of entries) {
      try {
        const { fx, isHome, opponentCode } = entry;
        const finished = fx.status === "FINISHED";
        const { scoreFor, scoreAgainst } = extractScore(fx, isHome);
        const opponentName = isHome ? fx.awayTeam?.name : fx.homeTeam?.name;
        const stage = simplifyStage(fx.stage);

        if (finished && scoreFor !== null && scoreAgainst !== null) {
          latestStage = stage;
          team.played += 1;
          team.goalsFor += scoreFor;
          team.goalsAgainst += scoreAgainst;

          const { result, points } = classifyResult(scoreFor, scoreAgainst);
          team.points += points;
          if (result === "W") team.won += 1;
          else if (result === "D") team.drawn += 1;
          else {
            team.lost += 1;
            if (isKnockoutStage(fx.stage)) team.eliminated = true;
          }

          team.recent.push({
            opponent: opponentName,
            opponentCode,
            date: fx.utcDate,
            round: stage,
            homeAway: isHome ? "H" : "A",
            scoreFor,
            scoreAgainst,
            result,
          });
        } else if (new Date(fx.utcDate).getTime() > now && !team.next) {
          team.next = {
            opponent: opponentName,
            opponentCode,
            date: fx.utcDate,
            round: stage,
          };
        }
      } catch (err) {
        malformedFixtures.push(`fixture ${entry.fx?.id ?? "?"} for ${code}: ${err.message}`);
      }
    }

    if (latestStage) team.stage = latestStage;
    team.recent = team.recent.slice(-5).reverse();
  }

  // Group position computed locally (points, then goal difference, then
  // goals for) since the API only exposes a flat 48-team table, not
  // per-group ones. Doesn't account for head-to-head tiebreakers.
  const byGroup = new Map();
  for (const team of Object.values(teams)) {
    if (!team.group) continue;
    if (!byGroup.has(team.group)) byGroup.set(team.group, []);
    byGroup.get(team.group).push(team);
  }
  for (const groupTeams of byGroup.values()) {
    rankGroup(groupTeams).forEach((team, i) => {
      team.groupPosition = i + 1;
    });
  }

  return {
    teams,
    unmatchedApiTeams: [...unmatchedApiTeams],
    missingFixtures: Object.values(teams).filter((t) => t.played === 0 && !t.next).map((t) => t.code),
    missingGroup: Object.values(teams).filter((t) => !t.group).map((t) => t.code),
    malformedFixtures,
  };
}
