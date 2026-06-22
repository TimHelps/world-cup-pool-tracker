import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_TO_NAME,
  normalize,
  buildCandidates,
  matchCode,
  simplifyStage,
  isKnockoutStage,
  extractScore,
  classifyResult,
  rankGroup,
  buildTeamsData,
} from "../scripts/lib/teams.mjs";

function fixture({ home, away, homeGoals, awayGoals, status = "FINISHED", stage = "GROUP_STAGE", group = "GROUP_A", date, id }) {
  return {
    id,
    homeTeam: { tla: home, name: CODE_TO_NAME[home] },
    awayTeam: { tla: away, name: CODE_TO_NAME[away] },
    status,
    stage,
    group,
    utcDate: date,
    score: { fullTime: { home: homeGoals, away: awayGoals } },
  };
}

describe("normalize", () => {
  test("strips accents, case and punctuation", () => {
    assert.equal(normalize("Côte d'Ivoire"), "cotedivoire");
    assert.equal(normalize("Bosnia & Herzegovina"), "bosniaherzegovina");
    assert.equal(normalize("USA"), "usa");
  });
});

describe("matchCode", () => {
  const candidates = buildCandidates();

  test("matches via tla fast path", () => {
    assert.equal(matchCode({ name: "anything", tla: "ARG" }, candidates), "ARG");
  });

  test("matches via canonical name", () => {
    assert.equal(matchCode({ name: "Germany" }, candidates), "GER");
  });

  test("matches via known alias", () => {
    assert.equal(matchCode({ name: "Korea Republic" }, candidates), "KOR");
    assert.equal(matchCode({ name: "Côte d'Ivoire" }, candidates), "CIV");
  });

  test("returns null for an unknown team", () => {
    assert.equal(matchCode({ name: "Narnia" }, candidates), null);
  });

  test("returns null for placeholder/TBD knockout slots", () => {
    assert.equal(matchCode(null, candidates), null);
    assert.equal(matchCode({ name: null, tla: null }, candidates), null);
  });

  test("every CODE_TO_NAME entry matches its own canonical name", () => {
    for (const [code, name] of Object.entries(CODE_TO_NAME)) {
      assert.equal(matchCode({ name }, candidates), code, `expected ${name} to match ${code}`);
    }
  });
});

describe("simplifyStage / isKnockoutStage", () => {
  test("maps known knockout stages to readable labels", () => {
    assert.equal(simplifyStage("QUARTER_FINALS"), "Quarter-finals");
    assert.equal(simplifyStage("FINAL"), "Final");
  });

  test("falls back to the raw stage when unrecognized", () => {
    assert.equal(simplifyStage("SOME_NEW_STAGE"), "SOME_NEW_STAGE");
  });

  test("falls back to Group Stage when stage is missing", () => {
    assert.equal(simplifyStage(null), "Group Stage");
  });

  test("group stage is not a knockout stage", () => {
    assert.equal(isKnockoutStage("GROUP_STAGE"), false);
  });

  test("every other stage counts as knockout", () => {
    assert.equal(isKnockoutStage("ROUND_OF_16"), true);
    assert.equal(isKnockoutStage("FINAL"), true);
  });
});

describe("extractScore", () => {
  // Regression test: an earlier version read score.fullTime.homeTeam/awayTeam
  // (which don't exist) instead of score.fullTime.home/away, so every
  // finished match silently scored as a 0-0-shaped draw.
  const fx = { score: { fullTime: { home: 3, away: 1 } } };

  test("reads the home team's perspective", () => {
    assert.deepEqual(extractScore(fx, true), { scoreFor: 3, scoreAgainst: 1 });
  });

  test("reads the away team's perspective", () => {
    assert.deepEqual(extractScore(fx, false), { scoreFor: 1, scoreAgainst: 3 });
  });

  test("returns nulls instead of throwing when score is missing", () => {
    assert.deepEqual(extractScore({}, true), { scoreFor: null, scoreAgainst: null });
  });

  test("returns nulls instead of throwing when fullTime is missing", () => {
    assert.deepEqual(extractScore({ score: {} }, true), { scoreFor: null, scoreAgainst: null });
  });

  test("returns nulls instead of throwing when fx itself is missing", () => {
    assert.deepEqual(extractScore(undefined, true), { scoreFor: null, scoreAgainst: null });
  });
});

describe("classifyResult", () => {
  test("more goals for than against is a win worth 3 points", () => {
    assert.deepEqual(classifyResult(2, 0), { result: "W", points: 3 });
  });

  test("equal goals is a draw worth 1 point", () => {
    assert.deepEqual(classifyResult(1, 1), { result: "D", points: 1 });
  });

  test("fewer goals for than against is a loss worth 0 points", () => {
    assert.deepEqual(classifyResult(0, 2), { result: "L", points: 0 });
  });
});

describe("rankGroup", () => {
  test("orders by points, then goal difference, then goals for", () => {
    const teams = [
      { code: "A", points: 4, goalsFor: 2, goalsAgainst: 2 },
      { code: "B", points: 6, goalsFor: 3, goalsAgainst: 1 },
      { code: "C", points: 4, goalsFor: 5, goalsAgainst: 3 },
      { code: "D", points: 4, goalsFor: 4, goalsAgainst: 2 },
    ];
    const ranked = rankGroup(teams).map((t) => t.code);
    assert.deepEqual(ranked, ["B", "C", "D", "A"]);
  });

  test("does not mutate the input array", () => {
    const teams = [
      { code: "A", points: 1, goalsFor: 0, goalsAgainst: 0 },
      { code: "B", points: 3, goalsFor: 0, goalsAgainst: 0 },
    ];
    rankGroup(teams);
    assert.deepEqual(teams.map((t) => t.code), ["A", "B"]);
  });
});

describe("buildTeamsData", () => {
  const NOW = new Date("2026-06-12T00:00:00Z").getTime();

  test("accumulates W/D/L/points/goals across multiple matches and orders recent results most-recent-first", () => {
    const fixtures = [
      fixture({ home: "ARG", away: "NED", homeGoals: 2, awayGoals: 1, date: "2026-06-10T00:00:00Z" }),
      fixture({ home: "GER", away: "ARG", homeGoals: 0, awayGoals: 0, date: "2026-06-15T00:00:00Z" }),
      fixture({ home: "ARG", away: "USA", homeGoals: null, awayGoals: null, status: "SCHEDULED", date: "2026-06-20T00:00:00Z" }),
    ];
    const { teams } = buildTeamsData(fixtures, { Ste: ["ARG"] }, NOW);
    const arg = teams.ARG;

    assert.equal(arg.played, 2);
    assert.equal(arg.won, 1);
    assert.equal(arg.drawn, 1);
    assert.equal(arg.lost, 0);
    assert.equal(arg.goalsFor, 2);
    assert.equal(arg.goalsAgainst, 1);
    assert.equal(arg.points, 4);
    assert.equal(arg.owner, "Ste");
    assert.deepEqual(arg.recent.map((m) => m.opponentCode), ["GER", "NED"]);
    assert.deepEqual(arg.next, { opponent: "USA", opponentCode: "USA", date: "2026-06-20T00:00:00Z", round: "Group Stage" });
  });

  test("marks eliminated on a knockout loss but not a group-stage loss or a win", () => {
    const fixtures = [
      fixture({ home: "ARG", away: "NED", homeGoals: 0, awayGoals: 1, date: "2026-06-10T00:00:00Z" }),
      fixture({ home: "GER", away: "USA", homeGoals: 0, awayGoals: 2, stage: "ROUND_OF_16", group: null, date: "2026-07-01T00:00:00Z" }),
    ];
    const { teams } = buildTeamsData(fixtures, {}, NOW);

    assert.equal(teams.ARG.eliminated, false);
    assert.equal(teams.GER.eliminated, true);
    assert.equal(teams.USA.eliminated, false);
  });

  test("caps recent results at 5, most recent first", () => {
    const fixtures = Array.from({ length: 7 }, (_, i) =>
      fixture({ home: "ARG", away: "USA", homeGoals: 1, awayGoals: 0, date: `2026-06-${10 + i}T00:00:00Z`, id: i })
    );
    const { teams } = buildTeamsData(fixtures, {}, NOW);

    assert.equal(teams.ARG.played, 7);
    assert.equal(teams.ARG.recent.length, 5);
    assert.equal(teams.ARG.recent[0].date, "2026-06-16T00:00:00Z");
  });

  test("computes group position by points, then goal difference, then goals for", () => {
    const fixtures = [
      fixture({ home: "ARG", away: "EGY", homeGoals: 3, awayGoals: 0, date: "2026-06-10T00:00:00Z", group: "GROUP_Z" }),
      fixture({ home: "USA", away: "GHA", homeGoals: 3, awayGoals: 1, date: "2026-06-10T00:00:00Z", group: "GROUP_Z" }),
      fixture({ home: "NED", away: "BRA", homeGoals: 2, awayGoals: 1, date: "2026-06-10T00:00:00Z", group: "GROUP_Z" }),
      fixture({ home: "GER", away: "FRA", homeGoals: 1, awayGoals: 0, date: "2026-06-10T00:00:00Z", group: "GROUP_Z" }),
    ];
    const { teams } = buildTeamsData(fixtures, {}, NOW);

    assert.equal(teams.ARG.group, "Z");
    assert.equal(teams.ARG.groupPosition, 1);
    assert.equal(teams.USA.groupPosition, 2);
    assert.equal(teams.NED.groupPosition, 3);
    assert.equal(teams.GER.groupPosition, 4);
  });

  test("reports teams with no fixtures yet and no group assigned", () => {
    const fixtures = [fixture({ home: "ARG", away: "NED", homeGoals: 1, awayGoals: 0, date: "2026-06-10T00:00:00Z" })];
    const { missingFixtures, missingGroup } = buildTeamsData(fixtures, {}, NOW);

    assert.ok(missingFixtures.includes("JPN"));
    assert.ok(!missingFixtures.includes("ARG"));
    assert.ok(missingGroup.includes("JPN"));
    assert.ok(!missingGroup.includes("ARG"));
  });

  test("skips a malformed fixture and reports it instead of throwing", () => {
    const fixtures = [
      fixture({ home: "ARG", away: "NED", homeGoals: 1, awayGoals: 0, date: "2026-06-10T00:00:00Z", id: 1 }),
      null,
      { id: 2 }, // missing homeTeam/awayTeam/status/utcDate entirely
    ];

    assert.doesNotThrow(() => buildTeamsData(fixtures, {}, NOW));
    const { teams, malformedFixtures } = buildTeamsData(fixtures, {}, NOW);

    assert.equal(teams.ARG.played, 1);
    assert.ok(malformedFixtures.length > 0);
  });
});
