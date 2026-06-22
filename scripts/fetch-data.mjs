// Fetches World Cup 2026 fixtures from football-data.org and writes
// data/standings.json with per-team stats, recent results and next fixture.
// Group standings are computed locally from match results: the API's
// standings endpoint returns one flat 48-team table (no per-group
// breakdown), so it's not useful for "position within group".
//
// Usage: FOOTBALL_DATA_KEY=xxxx node scripts/fetch-data.mjs
//
// football-data.org's free tier includes the World Cup competition at
// 10 requests/minute. This script makes exactly 1 request per run, so an
// hourly schedule is comfortably within limits.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODE_TO_NAME,
  buildCandidates,
  matchCode,
  simplifyStage,
  isKnockoutStage,
  extractScore,
  classifyResult,
  rankGroup,
} from "./lib/teams.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API_KEY = process.env.FOOTBALL_DATA_KEY;
if (!API_KEY) {
  console.error("Missing FOOTBALL_DATA_KEY environment variable.");
  process.exit(1);
}

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup
const SEASON = 2026;

async function apiGet(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`football-data.org error for ${url} (${res.status}): ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const candidateMap = buildCandidates();

  const matchesResponse = await apiGet(`/competitions/${COMPETITION}/matches?season=${SEASON}`);
  const fixtures = matchesResponse.matches || [];

  const people = JSON.parse(await readFile(path.join(ROOT, "data", "people.json"), "utf-8"));
  const codeToOwner = {};
  for (const [owner, codes] of Object.entries(people)) {
    for (const code of codes) codeToOwner[code] = owner;
  }

  const teams = {};
  for (const code of Object.keys(CODE_TO_NAME)) {
    teams[code] = {
      code,
      name: CODE_TO_NAME[code],
      owner: codeToOwner[code] || null,
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

  const unmatchedApiTeams = new Set();

  // Per-team match history derived from every fixture in the tournament.
  const fixturesByTeam = new Map(Object.keys(CODE_TO_NAME).map((c) => [c, []]));

  for (const fx of fixtures) {
    const homeCode = matchCode(fx.homeTeam, candidateMap);
    const awayCode = matchCode(fx.awayTeam, candidateMap);
    if (!homeCode && fx.homeTeam?.name) unmatchedApiTeams.add(fx.homeTeam.name);
    if (!awayCode && fx.awayTeam?.name) unmatchedApiTeams.add(fx.awayTeam.name);

    const groupLabel = fx.group ? fx.group.replace("GROUP_", "") : null;
    if (homeCode && groupLabel) teams[homeCode].group = groupLabel;
    if (awayCode && groupLabel) teams[awayCode].group = groupLabel;

    if (homeCode) fixturesByTeam.get(homeCode).push({ fx, isHome: true, opponentCode: awayCode });
    if (awayCode) fixturesByTeam.get(awayCode).push({ fx, isHome: false, opponentCode: homeCode });
  }

  const now = Date.now();

  for (const code of Object.keys(CODE_TO_NAME)) {
    const team = teams[code];
    const entries = fixturesByTeam.get(code) || [];
    entries.sort((a, b) => new Date(a.fx.utcDate) - new Date(b.fx.utcDate));

    let latestStage = null;

    for (const entry of entries) {
      const { fx, isHome, opponentCode } = entry;
      const finished = fx.status === "FINISHED";
      const { scoreFor, scoreAgainst } = extractScore(fx, isHome);
      const opponentName = isHome ? fx.awayTeam.name : fx.homeTeam.name;
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

  if (unmatchedApiTeams.size > 0) {
    console.warn("Unmatched football-data.org team names (no corresponding pool code):", [...unmatchedApiTeams]);
  }
  const missingFixtures = Object.values(teams).filter((t) => t.played === 0 && !t.next);
  if (missingFixtures.length > 0) {
    console.warn("Teams with no fixtures found yet:", missingFixtures.map((t) => t.code));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    teams,
  };

  await writeFile(path.join(ROOT, "data", "standings.json"), JSON.stringify(output, null, 2));
  console.log(`Wrote data/standings.json with ${Object.keys(teams).length} teams.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
