/*
  Knockout bracket: 16 teams, 15 matches. Used by the website and the admin panel.

  Match numbers:
     1–8   1st Round    (1–4 left side of the tree, 5–8 right side)
     9–12  Quarter-finals (winners of 1+2, 3+4, 5+6, 7+8)
    13–14  Semi-finals    (winners of 9+10, 11+12)
    15     Final          (winners of 13+14)

  Only the 1st Round stores which teams play. Every later match gets its teams
  automatically from the winners of the two matches before it.
  A level match needs a penalty shoot-out result to have a winner.
*/
var Bracket = (function () {
  "use strict";

  var PLAN = [
    { id: "m1", round: "r16", side: "L" }, { id: "m2", round: "r16", side: "L" },
    { id: "m3", round: "r16", side: "L" }, { id: "m4", round: "r16", side: "L" },
    { id: "m5", round: "r16", side: "R" }, { id: "m6", round: "r16", side: "R" },
    { id: "m7", round: "r16", side: "R" }, { id: "m8", round: "r16", side: "R" },
    { id: "q1", round: "qf", side: "L", from: ["m1", "m2"] }, { id: "q2", round: "qf", side: "L", from: ["m3", "m4"] },
    { id: "q3", round: "qf", side: "R", from: ["m5", "m6"] }, { id: "q4", round: "qf", side: "R", from: ["m7", "m8"] },
    { id: "s1", round: "sf", side: "L", from: ["q1", "q2"] }, { id: "s2", round: "sf", side: "R", from: ["q3", "q4"] },
    { id: "f", round: "final", side: "C", from: ["s1", "s2"] }
  ];
  var ROUND_NAMES = { r16: "1st Round", qf: "Quarter-final", sf: "Semi-final", final: "Final" };
  var SHORT_NAMES = { r16: "1st Round", qf: "Quarter", sf: "Semi", final: "Final" };
  var NUMBER = {};
  PLAN.forEach(function (p, i) { NUMBER[p.id] = i + 1; });

  function num(v) { return typeof v === "number" && isFinite(v) && v >= 0 ? v : null; }

  // An empty tournament: teams paired in the order they are listed (1 v 2, 3 v 4, ...).
  function blank(teams) {
    teams = teams || [];
    return PLAN.map(function (p, i) {
      var m = { id: p.id, date: "", time: "", venue: "", homeGoals: null, awayGoals: null, homePens: null, awayPens: null, scorers: [], cards: [] };
      if (!p.from) {
        m.home = teams[i * 2] ? teams[i * 2].id : null;
        m.away = teams[i * 2 + 1] ? teams[i * 2 + 1].id : null;
      }
      return m;
    });
  }

  // Stored matches -> the full picture: who plays in every match, and who won.
  function resolve(matches) {
    var stored = {}, done = {};
    (matches || []).forEach(function (m) { if (m && m.id) stored[m.id] = m; });

    return PLAN.map(function (p) {
      var m = stored[p.id] || {};
      var r = {
        id: p.id, no: NUMBER[p.id], round: p.round, roundName: ROUND_NAMES[p.round], side: p.side,
        from: p.from || null,
        date: m.date || "", time: m.time || "", venue: m.venue || "",
        home: p.from ? done[p.from[0]].winner : (m.home || null),
        away: p.from ? done[p.from[1]].winner : (m.away || null),
        homeGoals: null, awayGoals: null, homePens: null, awayPens: null,
        scorers: [], cards: [], potm: null, played: false, done: false, winner: null, loser: null
      };
      r.ready = !!(r.home && r.away);
      // A result is saved together with the two teams it was typed for ("for").
      // If different teams are in the match now (an earlier result was corrected),
      // that old result no longer counts.
      r.stale = !!m["for"] && m["for"] !== pairKey(r);

      var hg = num(m.homeGoals), ag = num(m.awayGoals);
      if (r.ready && !r.stale && hg !== null && ag !== null) {
        r.played = true;
        r.homeGoals = hg; r.awayGoals = ag;
        r.scorers = m.scorers || [];
        // cards shown in this match: { player, team: "<team id>", type: "yellow" | "red", minute }
        r.cards = (m.cards || []).filter(function (c) { return c && c.player && (c.type === "yellow" || c.type === "red"); });
        if (hg === ag) {                       // level after normal time: penalties decide
          r.homePens = num(m.homePens); r.awayPens = num(m.awayPens);
          if (r.homePens !== null && r.awayPens !== null && r.homePens !== r.awayPens) {
            r.winner = r.homePens > r.awayPens ? r.home : r.away;
          }
        } else {
          r.winner = hg > ag ? r.home : r.away;
        }
        if (r.winner) r.loser = r.winner === r.home ? r.away : r.home;
        r.done = m.done === true;              // ticked "Mark as done" in the admin panel
        // player of the match: { player: "name", team: "<team id>" }
        if (m.potm && m.potm.player) r.potm = { player: m.potm.player, team: m.potm.team === r.away ? r.away : r.home };
      }
      done[p.id] = r;
      return r;
    });
  }

  function pairKey(match) { return (match.home || "") + "|" + (match.away || ""); }

  // Text for a place in a later match whose team is not known yet.
  function waitingFor(match, slot) {
    return match.from ? "Winner of Match " + NUMBER[match.from[slot]] : "To be decided";
  }

  /* ---------- drawing the tree ----------
     options: name(teamId) -> text, href(teamId) -> link (optional),
              onPick(matchId) (optional, makes the boxes clickable), selected (match id),
              boxHeight / boxGap (optional sizes), trophy (optional picture above the final) */
  function render(container, list, options) {
    options = options || {};
    var byId = {};
    list.forEach(function (m) { byId[m.id] = m; });

    var style = window.getComputedStyle(container);
    var avail = (container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) || 1000;
    var gap = avail < 700 ? 12 : 20;
    // Boxes share the width when there is room. On narrow screens the tree scrolls sideways
    // anyway, so the boxes are simply made wide enough for names to be read.
    var fit = Math.floor((avail - 6 * gap) / 7);
    var W = fit >= 104 ? Math.min(200, fit) : 136;
    var H = options.boxHeight || 68, vgap = options.boxGap || 34, head = 30;   // the home page asks for a taller tree
    var width = 7 * W + 6 * gap;
    var height = head + 4 * H + 3 * vgap;
    var column = { L: { r16: 0, qf: 1, sf: 2 }, C: { final: 3 }, R: { sf: 4, qf: 5, r16: 6 } };

    // where each box goes
    var pos = {}, seen = { L: 0, R: 0 };
    list.forEach(function (m) {
      var y;
      if (!m.from) y = head + (seen[m.side]++) * (H + vgap);
      else y = (pos[m.from[0]].y + pos[m.from[1]].y) / 2;
      pos[m.id] = { x: column[m.side][m.round] * (W + gap), y: y };
    });

    var box = document.createElement("div");
    box.className = "bracket";
    box.style.width = width + "px";
    box.style.height = height + "px";

    // round names above the columns
    var names = W >= 128 ? ROUND_NAMES : SHORT_NAMES;
    ["r16", "qf", "sf", "final", "sf", "qf", "r16"].forEach(function (round, c) {
      var label = document.createElement("div");
      label.className = "bk-round";
      label.style.left = c * (W + gap) + "px";
      label.style.width = W + "px";
      label.textContent = names[round];
      box.appendChild(label);
    });

    // connecting lines
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", width); svg.setAttribute("height", height);
    svg.setAttribute("class", "bk-lines"); svg.setAttribute("aria-hidden", "true");
    list.forEach(function (m) {
      (m.from || []).forEach(function (fid) {
        var a = pos[fid], b = pos[m.id];
        var leftToRight = a.x < b.x;
        var x1 = leftToRight ? a.x + W : a.x, x2 = leftToRight ? b.x : b.x + W;
        var mid = (x1 + x2) / 2, y1 = a.y + H / 2, y2 = b.y + H / 2;
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", "M" + x1 + " " + y1 + "H" + mid + "V" + y2 + "H" + x2);
        path.setAttribute("class", byId[fid].winner ? "done" : "");
        svg.appendChild(path);
      });
    });
    box.appendChild(svg);

    // match boxes
    list.forEach(function (m) {
      var el = document.createElement("div");
      el.className = "bk-match" + (m.round === "final" ? " final" : "") + (m.id === options.selected ? " selected" : "");
      el.style.left = pos[m.id].x + "px"; el.style.top = pos[m.id].y + "px";
      el.style.width = W + "px"; el.style.height = H + "px";

      [["home", "homeGoals", "homePens"], ["away", "awayGoals", "awayPens"]].forEach(function (k) {
        var teamId = m[k[0]];
        var link = teamId && options.href && !options.onPick;
        var row = document.createElement(link ? "a" : "div");
        if (link) row.href = options.href(teamId);
        row.className = "bk-row" + (m.winner ? (m.winner === teamId ? " win" : " lose") : "");

        var name = document.createElement("span");
        name.className = "bk-name";
        name.textContent = teamId && options.name ? options.name(teamId) : "";
        if (teamId) name.title = name.textContent;
        row.appendChild(name);

        if (m.played) {
          var score = document.createElement("span");
          score.className = "bk-score";
          score.textContent = m[k[1]];
          if (m[k[2]] !== null) {
            var pens = document.createElement("small");
            pens.textContent = " (" + m[k[2]] + ")";
            score.appendChild(pens);
          }
          row.appendChild(score);
        }
        el.appendChild(row);
      });

      if (options.onPick) {
        el.setAttribute("role", "button"); el.tabIndex = 0;
        el.setAttribute("aria-label", "Match " + m.no + ", " + m.roundName);
        el.addEventListener("click", function () { options.onPick(m.id); });
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); options.onPick(m.id); }
        });
      }
      box.appendChild(el);
    });

    // a trophy picture above the final box (home page)
    //   options.trophy = { src, height, crop: [left, top, width, height] }
    //   crop says which part of the picture holds the trophy, as fractions of the picture,
    //   so empty space around it is not shown. Use [0, 0, 1, 1] for a picture with no empty border.
    if (options.trophy && byId.f) {
      var crop = options.trophy.crop || [0, 0, 1, 1];
      var room = pos.f.y - head - 16;                          // space between the round names and the final box
      var shown = Math.min(options.trophy.height || 170, room);
      if (shown >= 40) {
        var full = shown / crop[3];                            // size of the whole (square) picture on screen
        var frame = document.createElement("div");
        frame.className = "bk-trophy";
        frame.style.width = crop[2] * full + "px"; frame.style.height = shown + "px";
        frame.style.left = pos.f.x + W / 2 - crop[2] * full / 2 + "px";
        frame.style.top = pos.f.y - 12 - shown + "px";
        var picture = document.createElement("img");
        picture.src = options.trophy.src; picture.alt = "";
        picture.style.width = picture.style.height = full + "px";
        picture.style.left = -crop[0] * full + "px"; picture.style.top = -crop[1] * full + "px";
        frame.appendChild(picture);
        box.appendChild(frame);
      }
    }

    // champion under the final
    var final = byId.f;
    if (final && final.winner) {
      var champ = document.createElement("div");
      champ.className = "bk-champion";
      champ.style.left = pos.f.x - gap / 2 + "px"; champ.style.width = W + gap + "px";
      champ.style.top = pos.f.y + H + 10 + "px";
      champ.textContent = "🏆 " + (options.name ? options.name(final.winner) : "");
      box.appendChild(champ);
    }

    container.textContent = "";
    container.appendChild(box);
  }

  return { PLAN: PLAN, ROUND_NAMES: ROUND_NAMES, NUMBER: NUMBER, blank: blank, resolve: resolve, pairKey: pairKey, waitingFor: waitingFor, render: render };
})();
