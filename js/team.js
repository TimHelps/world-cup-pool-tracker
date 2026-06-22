import { flagEmoji } from "./lib/flags.mjs";

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderMatch(match) {
  const li = document.createElement("li");
  const score = `${match.scoreFor}-${match.scoreAgainst}`;
  li.innerHTML = `
    <span><span class="result-pill ${match.result}">${match.result}</span>${match.homeAway === "H" ? "vs" : "@"} ${flagEmoji(match.opponentCode)} ${escapeHtml(match.opponent)}</span>
    <span>${escapeHtml(score)} &middot; ${escapeHtml(formatDate(match.date))}</span>
  `;
  return li;
}

function renderContent(team) {
  const groupLabel = team.group
    ? `Group ${escapeHtml(team.group)}${team.groupPosition ? ` (${ordinal(team.groupPosition)})` : ""}`
    : escapeHtml(team.stage);

  const recentItems = team.recent.length
    ? team.recent.map(renderMatch).map((li) => li.outerHTML).join("")
    : `<li>No results yet.</li>`;

  const nextHtml = team.next
    ? `<div class="next-fixture"><strong>Next:</strong> ${team.next.homeAway === "H" ? "vs" : "@"} ${flagEmoji(team.next.opponentCode)} ${escapeHtml(team.next.opponent)} &mdash; ${escapeHtml(formatDate(team.next.date))} (${escapeHtml(team.next.round)})</div>`
    : `<div class="next-fixture">No upcoming fixture scheduled.</div>`;

  return `
    <div class="team-header">
      <h1>${flagEmoji(team.code)} ${escapeHtml(team.name)}</h1>
      <span class="owner">picked by ${escapeHtml(team.owner || "nobody")}</span>
      ${team.champion ? '<span class="badge-champion">🏆 World Cup Champions</span>' : ""}
      ${team.eliminated ? '<span class="badge-eliminated">Eliminated</span>' : ""}
    </div>
    <p>${groupLabel} &middot; ${escapeHtml(team.stage)}</p>

    <div class="stat-grid">
      <div class="stat-box"><div class="value">${team.played}</div><div class="label">Played</div></div>
      <div class="stat-box"><div class="value">${team.won}</div><div class="label">Won</div></div>
      <div class="stat-box"><div class="value">${team.drawn}</div><div class="label">Drawn</div></div>
      <div class="stat-box"><div class="value">${team.lost}</div><div class="label">Lost</div></div>
      <div class="stat-box"><div class="value">${team.goalsFor}-${team.goalsAgainst}</div><div class="label">Goals</div></div>
      <div class="stat-box"><div class="value">${team.points}</div><div class="label">Points</div></div>
    </div>

    <h2>Recent results</h2>
    <ul class="match-list">${recentItems}</ul>

    <h2>Upcoming</h2>
    ${nextHtml}
  `;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function main() {
  const code = new URLSearchParams(window.location.search).get("code");
  const content = document.querySelector("#content");
  if (!code) {
    content.textContent = "No team specified.";
    return;
  }

  const standings = await fetch("data/standings.json").then((r) => r.json());
  const team = standings.teams[code.toUpperCase()];
  if (!team) {
    content.textContent = `Unknown team code: ${code}`;
    return;
  }

  document.title = `${team.name} — World Cup Pool 2026`;
  content.innerHTML = renderContent(team);
}

main().catch((err) => {
  console.error(err);
  document.querySelector("#content").textContent = "Failed to load team data.";
});
