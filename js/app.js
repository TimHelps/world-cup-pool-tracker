import { summarizePerson, compareSummaries, findChampion } from "./lib/ranking.mjs";
import { flagEmoji } from "./lib/flags.mjs";

async function loadData() {
  const [people, standings] = await Promise.all([
    fetch("data/people.json").then((r) => r.json()),
    fetch("data/standings.json").then((r) => r.json()),
  ]);
  return { people, standings };
}

function renderCard(rank, summary) {
  const li = document.createElement("li");
  li.className = `person-card rank-${rank}`;

  const teamBadges = summary.teams
    .map((t) => {
      const marker = t.champion ? " 🏆" : t.eliminated ? " ❌" : "";
      const cls = `team-badge${t.champion ? " champion" : ""}${t.eliminated ? " eliminated" : ""}`;
      return `<a class="${cls}" href="team.html?code=${encodeURIComponent(t.code)}">${flagEmoji(t.code)} ${escapeHtml(t.name)}${marker}</a>`;
    })
    .join("");

  const gd = `${summary.goalDiff > 0 ? "+" : ""}${summary.goalDiff}`;

  li.innerHTML = `
    <div class="card-top">
      <span class="rank">${rank}</span>
      <span class="name">${escapeHtml(summary.owner)}</span>
      <span class="pts">${summary.points}<span class="pts-label">pts</span></span>
    </div>
    <div class="teams">${teamBadges}</div>
    <div class="card-stats">${summary.played}P &middot; ${summary.won}W ${summary.drawn}D ${summary.lost}L &middot; GD ${gd}</div>
  `;
  return li;
}

function renderChampionBanner(championTeam) {
  const banner = document.querySelector("#champion-banner");
  if (!championTeam) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.innerHTML = `🏆 <strong>${escapeHtml(championTeam.owner)}</strong> wins the pool — ${flagEmoji(championTeam.code)} ${escapeHtml(championTeam.name)} are World Cup Champions!`;
}

async function main() {
  const { people, standings } = await loadData();
  const summaries = Object.entries(people).map(([owner, codes]) =>
    summarizePerson(owner, codes, standings.teams)
  );

  summaries.sort(compareSummaries);

  renderChampionBanner(findChampion(standings.teams));

  const list = document.querySelector("#rankings");
  summaries.forEach((summary, i) => list.appendChild(renderCard(i + 1, summary)));

  const updated = new Date(standings.generatedAt);
  document.querySelector("#updated").textContent = `Last updated ${updated.toLocaleString()}`;
}

main().catch((err) => {
  console.error(err);
  document.querySelector("#updated").textContent = "Failed to load data.";
});
