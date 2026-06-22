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

function renderRow(rank, summary) {
  const tr = document.createElement("tr");
  tr.className = `rank-${rank}`;

  const teamBadges = summary.teams
    .map(
      (t) =>
        `<a class="team-badge${t.eliminated ? " eliminated" : ""}" href="team.html?code=${encodeURIComponent(t.code)}">${escapeHtml(t.name)}</a>`
    )
    .join("");

  tr.innerHTML = `
    <td>${rank}</td>
    <td>${escapeHtml(summary.owner)}</td>
    <td><div class="teams">${teamBadges}</div></td>
    <td class="numeric">${summary.played}</td>
    <td class="numeric">${summary.won}</td>
    <td class="numeric">${summary.drawn}</td>
    <td class="numeric">${summary.lost}</td>
    <td class="numeric">${summary.goalDiff > 0 ? "+" : ""}${summary.goalDiff}</td>
    <td class="points">${summary.points}</td>
  `;
  return tr;
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

  const tbody = document.querySelector("#rankings tbody");
  summaries.forEach((summary, i) => tbody.appendChild(renderRow(i + 1, summary)));

  const updated = new Date(standings.generatedAt);
  document.querySelector("#updated").textContent = `Last updated ${updated.toLocaleString()}`;
}

main().catch((err) => {
  console.error(err);
  document.querySelector("#updated").textContent = "Failed to load data.";
});
