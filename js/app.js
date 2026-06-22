async function loadData() {
  const [people, standings] = await Promise.all([
    fetch("data/people.json").then((r) => r.json()),
    fetch("data/standings.json").then((r) => r.json()),
  ]);
  return { people, standings };
}

function summarizePerson(owner, codes, teams) {
  const summary = {
    owner,
    teams: codes.map((code) => teams[code]).filter(Boolean),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
  for (const team of summary.teams) {
    summary.played += team.played;
    summary.won += team.won;
    summary.drawn += team.drawn;
    summary.lost += team.lost;
    summary.goalsFor += team.goalsFor;
    summary.goalsAgainst += team.goalsAgainst;
    summary.points += team.points;
  }
  summary.goalDiff = summary.goalsFor - summary.goalsAgainst;
  return summary;
}

function renderCard(rank, summary) {
  const li = document.createElement("li");
  li.className = `person-card rank-${rank}`;

  const teamBadges = summary.teams
    .map(
      (t) =>
        `<a class="team-badge${t.eliminated ? " eliminated" : ""}" href="team.html?code=${encodeURIComponent(t.code)}">${escapeHtml(t.name)}</a>`
    )
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

async function main() {
  const { people, standings } = await loadData();
  const summaries = Object.entries(people).map(([owner, codes]) =>
    summarizePerson(owner, codes, standings.teams)
  );

  summaries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return a.owner.localeCompare(b.owner);
  });

  const list = document.querySelector("#rankings");
  summaries.forEach((summary, i) => list.appendChild(renderCard(i + 1, summary)));

  const updated = new Date(standings.generatedAt);
  document.querySelector("#updated").textContent = `Last updated ${updated.toLocaleString()}`;
}

main().catch((err) => {
  console.error(err);
  document.querySelector("#updated").textContent = "Failed to load data.";
});
