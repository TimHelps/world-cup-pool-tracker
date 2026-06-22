// Fetches World Cup 2026 fixtures from football-data.org and writes
// data/standings.json with per-team stats, recent results and next fixture.
// All the matching/aggregation logic lives in scripts/lib/teams.mjs
// (buildTeamsData) so it's testable without mocking the network or
// filesystem; this file is just the I/O shell around it.
//
// Usage: FOOTBALL_DATA_KEY=xxxx node scripts/fetch-data.mjs
//
// football-data.org's free tier includes the World Cup competition at
// 10 requests/minute. This script makes exactly 1 request per run, so an
// hourly schedule is comfortably within limits.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTeamsData } from "./lib/teams.mjs";

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

async function apiGet(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
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
  const matchesResponse = await apiGet(`/competitions/${COMPETITION}/matches?season=${SEASON}`);
  const fixtures = matchesResponse.matches || [];

  const people = JSON.parse(await readFile(path.join(ROOT, "data", "people.json"), "utf-8"));

  const { teams, unmatchedApiTeams, missingFixtures, missingGroup, malformedFixtures } = buildTeamsData(fixtures, people);

  if (unmatchedApiTeams.length > 0) {
    console.warn("Unmatched football-data.org team names (no corresponding pool code):", unmatchedApiTeams);
  }
  if (missingFixtures.length > 0) {
    console.warn("Teams with no fixtures found yet:", missingFixtures);
  }
  if (missingGroup.length > 0) {
    console.warn("Teams with no group assigned (no fixture carried a group label yet):", missingGroup);
  }
  if (malformedFixtures.length > 0) {
    console.warn("Skipped malformed fixtures:", malformedFixtures);
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
