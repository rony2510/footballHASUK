/* Builds the shared top bar + footer and fills each page from js/data.js + data/*.js */
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
  var navKey = document.body.getAttribute("data-nav") || page;   // which top-bar link to highlight
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
      var active = n[0].toLowerCase() === navKey ? ' class="active" aria-current="page"' : "";
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
    function setMenu(open) {
      nav.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "✕" : "☰";
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenu(!nav.classList.contains("open"));
    });
    // tap outside the menu, or press Escape, to close it
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  }

  /* ---------- Live data ----------
     Data files that the admin panel updates. They are loaded fresh on every
     visit (the ?t=... part stops the browser showing an old copy). */
  var DATA_FILES = ["data/teams.js"];

  function loadData(done) {
    var left = DATA_FILES.length;
    if (!left) return done();
    DATA_FILES.forEach(function (src) {
      var s = document.createElement("script");
      s.src = src + "?t=" + Date.now();
      s.onload = s.onerror = function () { if (--left === 0) done(); };
      document.head.appendChild(s);
    });
  }

  function render() {
    /* ---------- Data helpers ---------- */
    var TEAMS = window.TEAMS || [];
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

    // one team's record over every match it has played
    function teamRecord(id) {
      var r = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      played.forEach(function (m) {
        if (m.home !== id && m.away !== id) return;
        var mine = m.home === id ? m.homeGoals : m.awayGoals;
        var theirs = m.home === id ? m.awayGoals : m.homeGoals;
        r.p++; r.gf += mine; r.ga += theirs;
        if (mine > theirs) r.w++; else if (mine < theirs) r.l++; else r.d++;
      });
      return r;
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
        fill("teams-list", TEAMS.map(function (t) {
          return '<a class="team-tile" href="team.html?id=' + encodeURIComponent(t.id) + '">' +
            "<span>" + esc(t.name) + "</span></a>";
        }).join(""));
      },

      team: function () {
        var id = new URLSearchParams(location.search).get("id");
        var t = teamById[id];
        if (!t) {
          fill("team-detail", '<div class="card empty">Team not found. <a href="teams.html">See all teams</a></div>');
          return;
        }
        document.title = t.name + " | " + SITE.title;
        var r = teamRecord(t.id);
        var mine = function (m) { return m.home === t.id || m.away === t.id; };
        var players = t.players || [];
        // a section only appears when the team has something to show in it
        var section = function (title, list) {
          return list.length
            ? '<h2 class="section-title">' + title + '</h2><div class="grid two">' + list.map(matchCard).join("") + "</div>"
            : "";
        };

        fill("team-detail",
          '<a class="back" href="teams.html">← Teams</a>' +
          '<div class="team-head"><div class="crest">' + esc(t.short) + "</div><div>" +
            '<h1 class="page-title">' + esc(t.name) + "</h1>" +
            '<div class="muted">Group ' + esc(t.group) + (t.area ? " · " + esc(t.area) : "") + "</div>" +
          "</div></div>" +
          '<div class="grid stats record">' +
            statCards([[r.p, "Played"], [r.w, "Won"], [r.d, "Drawn"], [r.l, "Lost"], [r.gf, "Goals for"], [r.ga, "Goals against"]]) +
          "</div>" +
          (players.length
            ? '<h2 class="section-title">Squad</h2><ul class="squad">' +
              players.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>"
            : "") +
          section("Fixtures", upcoming.filter(mine)) +
          section("Results", played.filter(mine)));
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

    if (pages[page]) pages[page]();
  }

  layout();
  loadData(render);
})();
