/* Builds the shared top bar + footer and fills each page from js/data.js */
(function () {
  "use strict";

  var NAV = [
    ["Home", "index.html"],
    ["Teams", "teams.html"],
    ["Results", "results.html"],
    ["Fixtures", "fixtures.html"],
    ["Statistics", "statistics.html"],
    ["About", "about.html"]
  ];

  var page = document.body.getAttribute("data-page") || "home";
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fill(id, html) { var el = $(id); if (el) el.innerHTML = html; }

  /* ---------- Top bar + footer ---------- */
  function layout() {
    var links = NAV.map(function (n) {
      var active = n[0].toLowerCase() === page ? ' class="active" aria-current="page"' : "";
      return '<a href="' + n[1] + '"' + active + ">" + n[0] + "</a>";
    }).join("");

    fill("site-header",
      '<header class="topbar"><div class="container">' +
        '<a class="brand" href="index.html"><span class="ball" aria-hidden="true">⚽</span>' +
        "<span>" + esc(SITE.title) + "</span></a>" +
        '<button class="menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false">☰</button>' +
        '<nav class="nav" id="nav">' + links + "</nav>" +
      "</div></header>");

    var contact = [SITE.address, SITE.email, SITE.phone].filter(Boolean).map(esc).join(" · ");
    fill("site-footer",
      '<footer class="footer"><div class="container">' +
        "<div>© " + esc(SITE.year) + " <strong>" + esc(SITE.title) + "</strong>. All rights reserved.</div>" +
        "<div><strong>Address:</strong> " + contact + "</div>" +
      "</div></footer>");

    var btn = $("menu-btn"), nav = $("nav");
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Data helpers ---------- */
  var teamById = {};
  TEAMS.forEach(function (t) { teamById[t.id] = t; });
  function team(id) { return teamById[id] || { id: id, name: id, short: "?", group: "" }; }

  function isPlayed(m) { return m.homeGoals != null && m.awayGoals != null; }
  function stamp(m) { return m.date + "T" + (m.time || "00:00"); }
  function byDateAsc(a, b) { return stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0; }

  var played = MATCHES.filter(isPlayed).sort(byDateAsc).reverse();   // newest first
  var upcoming = MATCHES.filter(function (m) { return !isPlayed(m); }).sort(byDateAsc);

  function niceDate(m) {
    var p = m.date.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var s = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return m.time ? s + " · " + m.time : s;
  }

  function matchCard(m) {
    var done = isPlayed(m);
    var mid = done
      ? '<span class="score">' + esc(m.homeGoals) + " – " + esc(m.awayGoals) + "</span>"
      : '<span class="score vs">VS</span>';
    var scorers = "";
    if (done && m.scorers && m.scorers.length) {
      scorers = '<div class="scorers">⚽ ' + m.scorers.map(function (s) {
        return esc(s.player) + " (" + esc(team(s.team).name) + (s.minute ? ", " + esc(s.minute) + "'" : "") + ")";
      }).join(" · ") + "</div>";
    }
    return '<div class="card match">' +
      '<div class="info"><span>' + esc(niceDate(m)) + (m.venue ? " · " + esc(m.venue) : "") + "</span>" +
      '<span class="badge' + (done ? "" : " alt") + '">' + esc(m.stage || "") + "</span></div>" +
      '<div class="row"><span class="home">' + esc(team(m.home).name) + "</span>" + mid +
      '<span class="away">' + esc(team(m.away).name) + "</span></div>" + scorers + "</div>";
  }

  function matchList(list, emptyText) {
    return list.length ? list.map(matchCard).join("") : '<div class="card empty">' + emptyText + "</div>";
  }

  function groups() {
    var seen = [];
    TEAMS.forEach(function (t) { if (seen.indexOf(t.group) < 0) seen.push(t.group); });
    return seen.sort();
  }

  function standings(group) {
    var rows = {};
    TEAMS.filter(function (t) { return t.group === group; }).forEach(function (t) {
      rows[t.id] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });
    played.forEach(function (m) {
      if (m.stage !== "Group " + group) return;
      var h = rows[m.home], a = rows[m.away];
      if (!h || !a) return;
      h.p++; a.p++;
      h.gf += m.homeGoals; h.ga += m.awayGoals;
      a.gf += m.awayGoals; a.ga += m.homeGoals;
      if (m.homeGoals > m.awayGoals) { h.w++; a.l++; h.pts += 3; }
      else if (m.homeGoals < m.awayGoals) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (x, y) {
      return (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) ||
        x.team.name.localeCompare(y.team.name);
    });
  }

  function standingsTable(group) {
    var body = standings(group).map(function (r, i) {
      var gd = r.gf - r.ga;
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.team.name) + "</td><td>" + r.p + "</td><td>" + r.w +
        "</td><td>" + r.d + "</td><td>" + r.l + "</td><td>" + r.gf + "</td><td>" + r.ga + "</td><td>" +
        (gd > 0 ? "+" + gd : gd) + '</td><td class="pts">' + r.pts + "</td></tr>";
    }).join("");
    return '<h2 class="section-title">Group ' + esc(group) + " – Points Table</h2>" +
      '<div class="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>' +
      "<th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function topScorers() {
    var tally = {};
    played.forEach(function (m) {
      (m.scorers || []).forEach(function (s) {
        var key = s.player + "|" + s.team;
        tally[key] = tally[key] || { player: s.player, team: s.team, goals: 0 };
        tally[key].goals++;
      });
    });
    return Object.keys(tally).map(function (k) { return tally[k]; }).sort(function (a, b) {
      return (b.goals - a.goals) || a.player.localeCompare(b.player);
    });
  }

  function totals() {
    var goals = played.reduce(function (n, m) { return n + m.homeGoals + m.awayGoals; }, 0);
    return { teams: TEAMS.length, matches: MATCHES.length, played: played.length, goals: goals };
  }

  function statCards(items) {
    return items.map(function (s) {
      return '<div class="card stat"><div class="num">' + esc(s[0]) + '</div><div class="label">' + esc(s[1]) + "</div></div>";
    }).join("");
  }

  /* ---------- Pages ---------- */
  var pages = {
    home: function () {
      var t = totals();
      fill("hero-title", esc(SITE.title));
      fill("hero-tagline", esc(SITE.tagline));
      fill("home-stats", statCards([[t.teams, "Teams"], [t.matches, "Matches"], [t.played, "Played"], [t.goals, "Goals"]]));
      fill("home-fixtures", matchList(upcoming.slice(0, 2), "No upcoming matches."));
      fill("home-results", matchList(played.slice(0, 2), "No results yet."));
    },

    teams: function () {
      fill("teams-list", groups().map(function (g) {
        var cards = TEAMS.filter(function (t) { return t.group === g; }).map(function (t) {
          return '<div class="card team"><div class="crest">' + esc(t.short) + "</div><div>" +
            '<div class="name">' + esc(t.name) + '</div><div class="meta">' + esc(t.area || "") + "</div></div></div>";
        }).join("");
        return '<h2 class="section-title">Group ' + esc(g) + '</h2><div class="grid">' + cards + "</div>";
      }).join(""));
    },

    results: function () {
      fill("results-list", matchList(played, "No results yet. Check back after the first match."));
    },

    fixtures: function () {
      fill("fixtures-list", matchList(upcoming, "No upcoming matches."));
    },

    statistics: function () {
      var t = totals();
      var avg = t.played ? (t.goals / t.played).toFixed(2) : "0";
      fill("stats-summary", statCards([[t.played, "Matches played"], [t.goals, "Goals scored"], [avg, "Goals per match"], [t.teams, "Teams"]]));
      fill("stats-tables", groups().map(standingsTable).join(""));

      var scorers = topScorers().slice(0, 10);
      fill("stats-scorers", scorers.length
        ? '<div class="table-wrap"><table><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Goals</th></tr></thead><tbody>' +
          scorers.map(function (s, i) {
            return "<tr><td>" + (i + 1) + "</td><td>" + esc(s.player) + "</td><td>" + esc(team(s.team).name) +
              '</td><td class="pts">' + s.goals + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<div class="card empty">No goals recorded yet.</div>');
    },

    about: function () {
      fill("about-title", esc(SITE.title));
      fill("about-contact", [
        ["Address", SITE.address], ["Email", SITE.email], ["Phone", SITE.phone]
      ].filter(function (r) { return r[1]; }).map(function (r) {
        return "<p><strong>" + r[0] + ":</strong> " + esc(r[1]) + "</p>";
      }).join(""));
    }
  };

  layout();
  if (pages[page]) pages[page]();
})();
