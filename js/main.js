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
        '<div class="footer-address"><strong>Address:</strong> ' + contact + "</div>" +
        '<div class="footer-copy">© ' + esc(SITE.year) + " <strong>" + esc(SITE.title) + "</strong>. All rights reserved.</div>" +
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
  var DATA_FILES = ["data/teams.js", "data/matches.js"];

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
    function team(id) { return teamById[id] || { id: id, name: id, short: "?" }; }
    function teamName(id) { return team(id).name; }
    // letters for a team's badge: its short name, or else the initials of its name
    function badge(t) {
      if (t.short) return t.short;
      return String(t.name || "").split(/\s+/).filter(Boolean).slice(0, 3).map(function (w) { return Array.from(w)[0]; }).join("").toUpperCase();
    }

    // Every match of the knockout, with its teams and winner worked out (see js/bracket.js)
    var MATCHES = Bracket.resolve(window.MATCHES || []);

    // matches with a date come first, in date order; the rest follow in match-number order
    function stamp(m) { return (m.date || "9999-99-99") + "T" + (m.time || "99:99") + "#" + String(100 + m.no); }
    function byDateAsc(a, b) { return stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0; }

    var played = MATCHES.filter(function (m) { return m.played; }).sort(byDateAsc).reverse();   // newest first
    var upcoming = MATCHES.filter(function (m) { return !m.played; }).sort(byDateAsc);

    // "2026-10-17" -> "Sat, 17 Oct 2026"
    function justDate(m) {
      if (!m.date) return "";
      var p = m.date.split("-");
      var d = new Date(+p[0], +p[1] - 1, +p[2]);
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    }
    // "14:30" -> "2:30 PM"
    function niceTime(t) {
      var p = /^(\d{1,2}):(\d{2})/.exec(t || "");
      if (!p) return t || "";
      var h = +p[1];
      return ((h + 11) % 12 + 1) + ":" + p[2] + (h < 12 ? " AM" : " PM");
    }
    function niceDate(m) {
      return [justDate(m), niceTime(m.time)].filter(Boolean).join(" · ");
    }

    function side(m, slot) {
      var id = slot === 0 ? m.home : m.away;
      var cls = slot === 0 ? "home" : "away";
      if (!id) return '<span class="' + cls + ' tbd">' + esc(Bracket.waitingFor(m, slot)) + "</span>";
      return '<span class="' + cls + (m.winner === id ? " winner" : "") + '">' + esc(teamName(id)) + "</span>";
    }

    function matchCard(m) {
      var mid = m.played
        ? '<span class="score">' + esc(m.homeGoals) + " – " + esc(m.awayGoals) + "</span>"
        : '<span class="score vs">VS</span>';
      var extra = "";
      if (m.played && m.homePens !== null && m.awayPens !== null) {
        extra += '<div class="scorers">Penalties ' + esc(m.homePens) + " – " + esc(m.awayPens) + "</div>";
      }
      if (m.played && m.scorers.length) {
        extra += '<div class="scorers">⚽ ' + m.scorers.map(function (s) {
          return esc(s.player) + " (" + esc(teamName(s.team)) + (s.minute ? ", " + esc(s.minute) + "'" : "") + ")";
        }).join(" · ") + "</div>";
      }
      var when = ["Match " + m.no, niceDate(m), m.venue].filter(Boolean).map(esc).join(" · ");
      return '<div class="card match">' +
        '<div class="info"><span>' + when + "</span>" +
        '<span class="badge' + (m.played ? "" : " alt") + '">' + esc(m.roundName) + "</span></div>" +
        '<div class="row">' + side(m, 0) + mid + side(m, 1) + "</div>" + extra + "</div>";
    }

    function matchList(list, emptyText) {
      return list.length ? list.map(matchCard).join("") : '<div class="card empty">' + emptyText + "</div>";
    }

    function topScorers() {
      var tally = {};
      played.forEach(function (m) {
        m.scorers.forEach(function (s) {
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
      var r = { p: 0, w: 0, l: 0, gf: 0, ga: 0 };
      played.forEach(function (m) {
        if (m.home !== id && m.away !== id) return;
        r.p++;
        r.gf += m.home === id ? m.homeGoals : m.awayGoals;
        r.ga += m.home === id ? m.awayGoals : m.homeGoals;
        if (m.winner === id) r.w++; else if (m.loser === id) r.l++;
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

    // the knockout tree; redrawn when the screen size changes so it always fits
    function drawBracket() {
      var el = $("home-bracket");
      if (!el) return;
      Bracket.render(el, MATCHES, {
        name: teamName,
        boxHeight: 84, boxGap: 52,          // taller than the admin panel's tree
        // trophy.png (in the site's main folder) shown above the final. "crop" is the part of
        // the picture that holds the trophy: [left, top, width, height] as fractions of the picture.
        trophy: { src: "trophy.png", height: 145, crop: [0.3613, 0.1465, 0.2783, 0.707] },
        href: function (id) { return "team.html?id=" + encodeURIComponent(id); }
      });
    }

    /* The layout shared by the Fixtures and Results pages: stage buttons, one block per
       stage, one full-width card per match.
       options: filters / list (element ids), matches (in display order),
                bottom(match) -> html under the two teams, empty (text when there are none),
                tintFinished -> green box for matches that have a score */
    function stageBoard(options) {
      var STAGES = ["r16", "qf", "sf", "final"];
      var all = options.matches;
      var shown = "all";

      function teamSide(m, slot) {
        var id = slot === 0 ? m.home : m.away;
        var name = id
          ? '<a class="fx-name" href="team.html?id=' + encodeURIComponent(id) + '">' + esc(teamName(id)) + "</a>"
          : '<span class="fx-name tbd">' + esc(Bracket.waitingFor(m, slot)) + "</span>";
        var crest = '<span class="fx-crest' + (id ? "" : " tbd") + '">' + (id ? esc(badge(team(id))) : "?") + "</span>";
        return '<div class="fx-team ' + (slot === 0 ? "home" : "away") + '">' + (slot === 0 ? name + crest : crest + name) + "</div>";
      }

      function card(m) {
        var middle = '<span class="fx-vs">VS</span>';
        if (m.played) {
          middle = '<span class="fx-score">' + esc(m.homeGoals) + " – " + esc(m.awayGoals) +
            (m.homePens !== null && m.awayPens !== null ? "<small>Pens " + esc(m.homePens) + " – " + esc(m.awayPens) + "</small>" : "") + "</span>";
        }
        var finished = options.tintFinished && m.played;      // a match with a score is finished
        return '<article class="fx-card' + (finished ? " done" : "") + '">' +
          '<div class="fx-top"><span class="fx-stage">' + esc(m.roundName) + '</span><span class="fx-no">Match ' + m.no +
            "</span></div>" +
          '<div class="fx-teams">' + teamSide(m, 0) + middle + teamSide(m, 1) + "</div>" +
          options.bottom(m) + "</article>";
      }

      function draw() {
        var stages = STAGES.filter(function (st) { return all.some(function (m) { return m.round === st; }); });
        if (stages.indexOf(shown) < 0) shown = "all";

        fill(options.filters, !stages.length ? "" : [["all", "All"]].concat(stages.map(function (st) { return [st, Bracket.ROUND_NAMES[st]]; }))
          .map(function (f) {
            return '<button type="button" class="pill' + (f[0] === shown ? " active" : "") + '" data-stage="' + f[0] +
              '" aria-pressed="' + (f[0] === shown) + '">' + esc(f[1]) + "</button>";
          }).join(""));

        fill(options.list, stages.filter(function (st) { return shown === "all" || shown === st; }).map(function (st) {
          var list = all.filter(function (m) { return m.round === st; });
          return '<section class="fx-stage-block"><div class="fx-head"><h2>' + esc(Bracket.ROUND_NAMES[st]) + "</h2>" +
            '<span class="fx-count">' + list.length + (list.length === 1 ? " match" : " matches") + "</span></div>" +
            '<div class="fx-list">' + list.map(card).join("") + "</div></section>";
        }).join("") || '<div class="card empty">' + esc(options.empty) + "</div>");
      }

      var filters = $(options.filters);
      if (filters) filters.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("[data-stage]") : null;
        if (!b) return;
        shown = b.getAttribute("data-stage");
        draw();
      });
      draw();
    }

    /* ---------- Pages ---------- */
    var pages = {
      home: function () {
        var t = totals();
        fill("hero-title", esc(SITE.title));
        drawBracket();
        var timer;
        window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(drawBracket, 150); });
        fill("home-stats", statCards([[t.teams, "Teams"], [t.matches, "Matches"], [t.played, "Played"], [t.goals, "Goals"]]));
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
        // players may be plain names (older data) or full details
        var players = (t.players || []).map(function (pl) {
          return typeof pl === "string" ? { name: pl } : (pl || {});
        }).filter(function (pl) { return pl.name; });
        var dash = '<span class="muted">–</span>';
        var text = function (v) { return v === undefined || v === null || v === "" ? dash : esc(v); };
        var count = function (v) { return esc(Number(v) || 0); };
        // column heading with a short form for phones (css shows one or the other)
        var head = function (full, brief) {
          return '<th><span class="long">' + full + '</span><abbr class="brief" title="' + full + '">' + brief + "</abbr></th>";
        };
        // a section only appears when the team has something to show in it
        var section = function (title, list) {
          return list.length
            ? '<h2 class="section-title">' + title + '</h2><div class="grid two">' + list.map(matchCard).join("") + "</div>"
            : "";
        };

        fill("team-detail",
          '<a class="back" href="teams.html">← Teams</a>' +
          '<div class="team-head"><div class="crest">' + esc(badge(t)) + "</div><div>" +
            '<h1 class="page-title">' + esc(t.name) + "</h1>" +
          "</div></div>" +
          '<div class="grid stats record">' +
            statCards([[r.p, "Played"], [r.w, "Won"], [r.l, "Lost"], [r.gf, "Goals for"], [r.ga, "Goals against"]]) +
          "</div>" +

          '<h2 class="section-title">Team Details</h2>' +
          '<div class="table-wrap"><table class="details"><tbody>' +
            "<tr><th>Team Name</th><td>" + text(t.name) + "</td></tr>" +
            "<tr><th>Manager</th><td>" + text(t.manager) + "</td></tr>" +
            "<tr><th>Address</th><td>" + text(t.address || t.area) + "</td></tr>" +
          "</tbody></table></div>" +

          '<h2 class="section-title">Players</h2>' +
          (players.length
            ? '<div class="table-wrap"><table class="players"><thead><tr><th>Name</th>' + head("Jersey No.", "No.") + "<th>Position</th>" +
              "<th>Goals</th>" + head("Yellow Card", "YC") + head("Red Card", "RC") + "</tr></thead><tbody>" +
              players.map(function (pl) {
                return "<tr><td>" + esc(pl.name) + "</td><td>" + text(pl.jersey) + "</td><td>" + text(pl.position) +
                  '</td><td class="pts">' + count(pl.goals) + "</td><td>" + count(pl.yellow) + "</td><td>" + count(pl.red) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : '<div class="card empty">No players added yet.</div>') +

          section("Fixtures", upcoming.filter(mine)) +
          section("Results", played.filter(mine)));
      },

      // Finished matches, in the same layout as Fixtures, with the scorers of each side under the teams
      results: function () {
        stageBoard({
          filters: "result-filters", list: "results-list",
          matches: played.slice().reverse(),
          empty: "No results yet. Check back after the first match.",
          bottom: function (m) {
            var names = function (id) {
              return m.scorers.filter(function (s) { return s.team === id; }).map(function (s) {
                return "<li>" + esc(s.player) + (s.minute ? " <small>" + esc(s.minute) + "'</small>" : "") + "</li>";
              }).join("");
            };
            var home = names(m.home), away = names(m.away);
            var scorers = home || away
              ? '<div class="fx-scorers"><ul class="home">' + home + '</ul><span class="ball" aria-hidden="true">⚽</span>' +
                '<ul class="away">' + away + "</ul></div>"
              : (m.homeGoals + m.awayGoals > 0 ? '<div class="fx-meta"><span class="tba">Scorers not recorded</span></div>' : "");
            // cards, if any were recorded: each side under its team, yellow first, then red
            var booked = function (id) {
              var of = function (type) { return m.cards.filter(function (c) { return c.team === id && c.type === type; }); };
              return of("yellow").concat(of("red")).map(function (c) {
                var label = c.type === "yellow" ? "Yellow card" : "Red card";
                return '<li><span class="card-mark ' + c.type + '" role="img" aria-label="' + label + '" title="' + label + '"></span>' +
                  esc(c.player) + (c.minute ? " <small>" + esc(c.minute) + "'</small>" : "") + "</li>";
              }).join("");
            };
            var homeCards = booked(m.home), awayCards = booked(m.away);
            var cards = homeCards || awayCards
              ? '<div class="fx-scorers fx-cards"><ul class="home">' + homeCards + '</ul><span class="ball" aria-hidden="true"></span>' +
                '<ul class="away">' + awayCards + "</ul></div>"
              : "";
            var best = m.potm
              ? '<div class="fx-potm">Player of the Match : <strong>' + esc(m.potm.player) + "</strong> (" + esc(teamName(m.potm.team)) + ")</div>"
              : '<div class="fx-potm">Player of the Match : <span class="tba">TBA</span></div>';     // not chosen yet
            return scorers + cards + best;
          }
        });
      },

      // Every match, one block per stage, with buttons to show a single stage.
      // A match with a result shows its score and its whole box turns green.
      fixtures: function () {
        stageBoard({
          filters: "fixture-filters", list: "fixtures-list",
          tintFinished: true,                       // finished matches get the green box
          matches: MATCHES.slice().sort(byDateAsc),
          empty: "No matches yet.",
          bottom: function (m) {
            var d = justDate(m), t = niceTime(m.time);
            return '<div class="fx-meta">' + (!d && !t && !m.venue
              ? '<span class="tba">Date, time and venue to be announced</span>'
              : "<span>📅 " + (d ? esc(d) : '<em class="tba">Date to be announced</em>') + "</span>" +
                "<span>🕒 " + (t ? esc(t) : '<em class="tba">Time to be announced</em>') + "</span>" +
                "<span>📍 " + (m.venue ? esc(m.venue) : '<em class="tba">Venue to be announced</em>') + "</span>") + "</div>";
          }
        });
      },

      statistics: function () {
        var t = totals();
        var avg = t.played ? (t.goals / t.played).toFixed(2) : "0";
        fill("stats-summary", statCards([[t.played, "Matches played"], [t.goals, "Goals scored"], [avg, "Goals per match"], [t.teams, "Teams"]]));

        var scorers = topScorers().slice(0, 10);
        fill("stats-scorers", scorers.length
          ? '<div class="table-wrap"><table><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Goals</th></tr></thead><tbody>' +
            scorers.map(function (s, i) {
              return "<tr><td>" + (i + 1) + "</td><td>" + esc(s.player) + "</td><td>" + esc(teamName(s.team)) +
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

  /* ---------- Page views ----------
     Adds one to this page's counter. Nothing about the visitor is sent or stored, only
     "this page was opened". Previews on your own computer are not counted. */
  function countView() {
    var views = SITE.views;
    var pages = ["home", "teams", "team", "results", "fixtures", "statistics", "about"];
    if (!views || !views.api || pages.indexOf(page) < 0) return;
    var host = location.hostname;
    if (location.protocol === "file:" || !host || host === "localhost" || host === "127.0.0.1") return;
    try {
      fetch(views.api + "/hit/" + views.namespace + "/" + page, { cache: "no-store", keepalive: true })
        .catch(function () { /* counting must never break the page */ });
    } catch (e) { /* very old browser: no counting */ }
  }

  layout();
  loadData(render);
  countView();
})();
