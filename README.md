# World Cup Pool 2026

Static site ranking everyone in the family World Cup pool by how their picked
teams are doing, with a per-team detail page (recent results, next fixture,
group standing).

## How it works

- `data/people.json` — who picked which teams (static, edit by hand if picks change).
- `data/standings.json` — generated file with each team's stats, recent results
  and next fixture. Produced by `scripts/fetch-data.mjs` from the
  [football-data.org](https://www.football-data.org/) API (its free tier
  includes the World Cup competition — API-Football's free tier doesn't
  cover the live 2026 season, only historical seasons).
- `index.html` / `js/app.js` — ranking table, sums points per person.
- `team.html` / `js/team.js` — per-team detail view (`team.html?code=ARG`).
- `.github/workflows/update-data.yml` — runs the fetch script hourly and
  commits the refreshed `data/standings.json`, so the live site stays current
  without anyone touching it during the tournament.

## One-time setup

1. **Get a football-data.org key**: sign up free at
   <https://www.football-data.org/client/register> and copy your API key
   from the confirmation email/dashboard.
2. **Add it as a GitHub secret**: in this repo on GitHub, go to
   Settings → Secrets and variables → Actions → New repository secret.
   Name it `FOOTBALL_DATA_KEY` and paste the key.
3. **Enable GitHub Pages**: Settings → Pages → Build and deployment → Source:
   "Deploy from a branch" → Branch: `main` / root.
4. Push this repo to GitHub. The workflow runs automatically on its hourly
   schedule, or trigger it manually from the Actions tab
   ("Update World Cup data" → Run workflow) to populate real data right away.

The free tier allows 10 requests/minute. The fetch script makes 1 request
per run (group standings are computed locally from match results, since the
API only exposes one flat 48-team table rather than per-group ones), so the
hourly schedule is well within limits even with a few manual runs.

## Local development

```sh
# one-off real data pull (requires an API key)
FOOTBALL_DATA_KEY=your_key_here node scripts/fetch-data.mjs

# serve the site locally
npx http-server .
```

(Avoid `npx serve` for local testing — its "clean URLs" redirect strips
the `?code=...` query string from `team.html` links. `http-server` and
GitHub Pages itself don't have this problem.)

Then open the printed local URL in a browser.

## If the picks change

Edit `data/people.json` (owner → list of FIFA-style 3-letter team codes used
throughout this project; see `CODE_TO_NAME` in `scripts/fetch-data.mjs` for
the full list of codes). No other changes needed.
