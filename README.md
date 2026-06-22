# World Cup Pool Tracker

[![Tests](https://github.com/TimHelps/world-cup-pool-tracker/actions/workflows/test.yml/badge.svg)](https://github.com/TimHelps/world-cup-pool-tracker/actions/workflows/test.yml)

A small static site for tracking a World Cup sweepstake-style pool: each
person picks some teams, and the site ranks everyone by how their teams are
doing, with a per-team detail page (recent results, next fixture, group
standing). Scores update automatically during the tournament via a scheduled
GitHub Action — nobody has to touch it once it's set up.

This instance is wired up for one specific group's picks (`data/people.json`),
but the whole thing is meant to be forked and repointed at a different pool —
see [Using this for your own pool](#using-this-for-your-own-pool) below.

## How it works

- `data/people.json` — who picked which teams (static, edit by hand if picks change).
- `data/standings.json` — generated file with each team's stats, recent results
  and next fixture. Produced by `scripts/fetch-data.mjs` from the
  [football-data.org](https://www.football-data.org/) API.
- `scripts/lib/teams.mjs` — pure functions for matching API team data to the
  pool's codes, turning match results into W/D/L/points, and computing group
  standings; covered by the tests in `tests/`.
- `index.html` / `js/app.js` — ranking page, sums points per person.
- `team.html` / `js/team.js` — per-team detail view (`team.html?code=ARG`).
- `.github/workflows/update-data.yml` — runs the fetch script hourly and
  commits the refreshed `data/standings.json`, so the live site stays current
  without anyone touching it during the tournament.
- `.github/workflows/test.yml` — runs the unit tests on every push.

## Using this for your own pool

1. **Fork this repo.**
2. **Edit `data/people.json`** to map each person to the team codes they
   picked. Codes are the FIFA-style 3-letter codes listed in `CODE_TO_NAME` in
   `scripts/lib/teams.mjs`, which covers all 48 teams in the 2026 tournament.
3. **Get a free football-data.org API key**: sign up at
   <https://www.football-data.org/client/register>.
4. **Add it as a secret on your fork**: Settings → Secrets and variables →
   Actions → New repository secret → name it `FOOTBALL_DATA_KEY`.
5. **Enable GitHub Pages on your fork**: Settings → Pages → Build and
   deployment → Source: "Deploy from a branch" → Branch: `main` / root.
6. Trigger the "Update World Cup data" workflow manually from the Actions tab
   once to populate real data immediately — otherwise it'll wait for the next
   hourly run.

football-data.org's free tier allows 10 requests/minute, and the fetch script
makes exactly 1 request per run (group standings are computed locally from
match results, since the API only exposes one flat 48-team table rather than
per-group ones). An hourly schedule is comfortably within that limit; adjust
the cron expression in `.github/workflows/update-data.yml` if you want a
different cadence.

## Local development

```sh
# run the unit tests (no API key needed)
npm test

# one-off real data pull (requires an API key)
FOOTBALL_DATA_KEY=your_key_here node scripts/fetch-data.mjs

# serve the site locally
npx http-server .
```

Then open the printed local URL in a browser.

(Avoid `npx serve` for local testing — its "clean URLs" redirect strips
the `?code=...` query string from `team.html` links. `http-server` and
GitHub Pages itself don't have this problem.)

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md) — free to use, fork, and modify
for any noncommercial purpose; commercial use requires permission from the
copyright holder.

## Acknowledgments

Built with [Claude Code](https://claude.com/claude-code) (Anthropic) pairing
on implementation, debugging, and code review throughout.
