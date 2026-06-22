import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { summarizePerson, compareSummaries, findChampion } from "../js/lib/ranking.mjs";

function team(overrides) {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, ...overrides };
}

describe("summarizePerson", () => {
  test("sums stats across all of a person's teams", () => {
    const teams = {
      ARG: team({ played: 2, won: 2, points: 6, goalsFor: 5, goalsAgainst: 1 }),
      NED: team({ played: 2, won: 1, drawn: 1, points: 4, goalsFor: 3, goalsAgainst: 2 }),
    };
    const summary = summarizePerson("Ste", ["ARG", "NED"], teams);

    assert.equal(summary.played, 4);
    assert.equal(summary.won, 3);
    assert.equal(summary.drawn, 1);
    assert.equal(summary.points, 10);
    assert.equal(summary.goalsFor, 8);
    assert.equal(summary.goalsAgainst, 3);
    assert.equal(summary.goalDiff, 5);
  });

  test("returns zeroed stats for a person with no teams played yet", () => {
    const summary = summarizePerson("Tim", ["GER"], { GER: team() });
    assert.equal(summary.points, 0);
    assert.equal(summary.goalDiff, 0);
  });

  test("ignores a code that isn't in the teams map instead of throwing", () => {
    const summary = summarizePerson("Ste", ["ARG", "ZZZ"], { ARG: team({ points: 3 }) });
    assert.equal(summary.teams.length, 1);
    assert.equal(summary.points, 3);
  });
});

describe("compareSummaries", () => {
  test("ranks higher points first", () => {
    const a = { owner: "A", points: 3, goalDiff: 0 };
    const b = { owner: "B", points: 6, goalDiff: 0 };
    assert.ok(compareSummaries(a, b) > 0);
  });

  test("breaks a points tie on goal difference", () => {
    const a = { owner: "A", points: 3, goalDiff: -1 };
    const b = { owner: "B", points: 3, goalDiff: 2 };
    assert.ok(compareSummaries(a, b) > 0);
  });

  test("breaks a points+goalDiff tie alphabetically by owner", () => {
    const a = { owner: "Zara", points: 3, goalDiff: 0 };
    const b = { owner: "Amir", points: 3, goalDiff: 0 };
    assert.ok(compareSummaries(a, b) > 0);
  });

  test("sorting a full list lands in the expected order", () => {
    const summaries = [
      { owner: "Low", points: 1, goalDiff: 0 },
      { owner: "High", points: 9, goalDiff: 0 },
      { owner: "Mid", points: 5, goalDiff: 0 },
    ];
    summaries.sort(compareSummaries);
    assert.deepEqual(summaries.map((s) => s.owner), ["High", "Mid", "Low"]);
  });
});

describe("findChampion", () => {
  test("returns the team with champion: true", () => {
    const teams = { ARG: team({ champion: true }), GER: team({ champion: false }) };
    assert.equal(findChampion(teams).champion, true);
  });

  test("returns undefined when no team has won the Final yet", () => {
    const teams = { ARG: team({ champion: false }), GER: team({ champion: false }) };
    assert.equal(findChampion(teams), undefined);
  });
});
