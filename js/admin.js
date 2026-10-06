/*
  Admin panel.

  How it works (there is no server):
  - Login: the two passwords are checked against the one-way hashes in admin-config.js.
    There are several password pairs; any one complete pair logs in.
  - Saving: changes are written into the GitHub repository through the GitHub API,
    using an access token. GitHub Pages then republishes the site (about a minute).
  - The token is stored only in this browser, encrypted (AES-256) with a key made
    from the two passwords. Without both passwords it cannot be read.
*/
(function () {
  "use strict";

  var TOKEN_KEY = "hasuk-admin-token";
  var SESSION_KEY = "hasuk-admin-session";
  var API = "https://api.github.com/repos/" + ADMIN_REPO.owner + "/" + ADMIN_REPO.repo;

  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder(), dec = new TextDecoder();

  // The login lasts for this browser tab: it survives a page refresh and ends
  // when you log out or close the tab.
  var session = { key: null, token: null, slot: TOKEN_KEY };

  /* ---------- small helpers ---------- */
  function b64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str.replace(/\s/g, "")), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function show(view) {
    ["view-login", "view-connect", "view-dash"].forEach(function (v) { $(v).hidden = v !== view; });
    $("admin-bar").hidden = view === "view-login";
  }
  function msg(id, text, kind) {
    var el = $(id);
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
    if (id === "dash-msg") {          // the same message also shows beside the bottom Save buttons
      Array.prototype.forEach.call(document.querySelectorAll(".dash-msg-copy"), function (copy) {
        copy.textContent = el.textContent;
        copy.className = el.className + " dash-msg-copy";
      });
    }
  }

  /* ---------- passwords ---------- */
  // Both passwords together -> 64 bytes. First half is compared with the stored
  // check value; second half becomes the key that locks the GitHub token.
  async function derive(p1, p2) {
    var material = await crypto.subtle.importKey("raw", enc.encode(p1 + "\u0000" + p2), "PBKDF2", false, ["deriveBits"]);
    var bits = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: unb64(ADMIN_AUTH.salt), iterations: ADMIN_AUTH.iterations },
      material, 512));
    return { check: b64(bits.slice(0, 32)), raw: bits.slice(32), key: await importKey(bits.slice(32)) };
  }
  function importKey(raw) {
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  /* ---------- staying logged in across a refresh ---------- */
  function rememberLogin(raw) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ key: b64(raw), slot: session.slot })); } catch (e) { /* login lasts until refresh */ }
  }
  function forgetLogin() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* nothing stored */ }
  }
  async function restoreLogin() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (!saved) return false;
      session.key = await importKey(unb64(saved.key));
      session.slot = saved.slot;
      return true;
    } catch (e) { forgetLogin(); return false; }
  }

  // after a successful login (or a restored one): dashboard if this browser has the token, else ask for it
  async function enter() {
    session.token = await readToken();
    if (session.token) { show("view-dash"); loadAll(); }
    else { $("repo-name").textContent = ADMIN_REPO.owner + "/" + ADMIN_REPO.repo; show("view-connect"); $("token").focus(); }
  }

  async function saveToken(token) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, session.key, enc.encode(token)));
    try { localStorage.setItem(session.slot, JSON.stringify({ iv: b64(iv), ct: b64(ct) })); } catch (e) { /* private window: token lasts for this visit only */ }
  }
  async function readToken() {
    // session.slot first; TOKEN_KEY is where the first version of the panel kept it
    var slots = [session.slot, TOKEN_KEY];
    for (var i = 0; i < slots.length; i++) {
      try {
        var blob = JSON.parse(localStorage.getItem(slots[i]));
        if (!blob) continue;
        var token = dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, session.key, unb64(blob.ct)));
        if (slots[i] !== session.slot) { await saveToken(token); localStorage.removeItem(TOKEN_KEY); }
        return token;
      } catch (e) { /* not stored, or locked with a different password pair */ }
    }
    return null;
  }
  function forgetToken() {
    session.token = null;
    try { localStorage.removeItem(session.slot); } catch (e) { /* nothing stored */ }
  }

  /* ---------- GitHub ---------- */
  async function github(path, options) {
    options = options || {};
    var res = await fetch(API + path, {
      method: options.method || "GET",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + (options.token || session.token)
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { status: res.status, ok: res.ok, data: data };
  }

  function explain(status, doc) {
    if (status === 401) return "GitHub did not accept the access token (it may have expired). Please connect again.";
    if (status === 403) return "The access token is not allowed to change this repository. It needs Contents: Read and write.";
    if (status === 404) return "GitHub could not find " + doc.path + " in " + ADMIN_REPO.owner + "/" + ADMIN_REPO.repo + ". Check the token can access this repository.";
    if (status === 409 || status === 422) return "The " + doc.label + " were changed somewhere else since you opened this page. Reload the page and try again.";
    return "GitHub returned an error (" + status + "). Please try again.";
  }

  /* ---------- data files ----------
     Each one is a small file in the repository:  window.NAME = [ ...JSON... ];  */
  function makeDoc(path, varName, label) {
    return { path: path, varName: varName, label: label, data: [], saved: "[]", sha: null, header: "window." + varName + " = ", loaded: false };
  }
  var docs = {
    teams: makeDoc("data/teams.js", "TEAMS", "teams"),
    results: makeDoc("data/matches.js", "MATCHES", "results")
  };
  var active = "teams";            // which section is open
  var picked = { team: -1, match: "m1" };

  function isDirty(doc) { return doc.loaded && JSON.stringify(doc.data) !== doc.saved; }
  function anyDirty() { return isDirty(docs.teams) || isDirty(docs.results); }

  function parseDoc(doc, text) {
    var at = text.lastIndexOf("window." + doc.varName);
    var start = text.indexOf("[", at), end = text.lastIndexOf("]");
    if (at < 0 || start < 0 || end < start) throw new Error("format");
    return { header: text.slice(0, start), data: JSON.parse(text.slice(start, end + 1)) };
  }

  // returns "" when loaded, or the problem as text
  async function loadDoc(doc) {
    var res;
    try { res = await github("/contents/" + doc.path + "?ref=" + encodeURIComponent(ADMIN_REPO.branch)); }
    catch (e) { return "Could not reach GitHub. Check your internet connection and reload."; }
    if (res.status === 401) return "401";
    if (res.status === 404 && doc === docs.results) {
      return doc.path + " is not on GitHub yet. Push the site from your computer once, then reload this page.";
    }
    if (!res.ok) return explain(res.status, doc);
    try {
      var parsed = parseDoc(doc, dec.decode(unb64(res.data.content)));
      doc.data = parsed.data; doc.header = parsed.header;
    } catch (e) {
      return "Could not read " + doc.path + ". It may have been edited by hand in a way that is not valid JSON.";
    }
    doc.sha = res.data.sha;
    return "";
  }

  async function loadAll() {
    msg("dash-msg", "Loading…");
    var problems = await Promise.all([loadDoc(docs.teams), loadDoc(docs.results)]);
    if (problems.indexOf("401") >= 0) { forgetToken(); show("view-connect"); return msg("connect-msg", explain(401), "error"); }
    var problem = problems.filter(Boolean)[0];
    if (problem) return msg("dash-msg", problem, "error");

    docs.teams.data = docs.teams.data.map(function (t) {
      var team = Object.assign({}, t, {
        name: t.name || "", short: t.short || "", manager: t.manager || "",
        address: t.address || t.area || "",             // "area" was the old name of this field
        players: (t.players || []).map(cleanPlayer)
      });
      delete team.area;
      return team;
    });
    docs.teams.saved = JSON.stringify(docs.teams.data);
    docs.teams.loaded = true;

    // always the full set of 15 matches, in bracket order
    var stored = {}, fresh = Bracket.blank(docs.teams.data);
    docs.results.data.forEach(function (m) { if (m && m.id) stored[m.id] = m; });
    docs.results.data = fresh.map(function (b) {
      var m = Object.assign(b, stored[b.id] || {});
      m.scorers = m.scorers || []; m.cards = m.cards || [];
      return m;
    });
    docs.results.saved = JSON.stringify(docs.results.data);
    docs.results.loaded = true;

    picked.team = -1; picked.match = "m1";
    $("editor").hidden = true;
    msg("dash-msg", "");
    draw();
  }

  /* ---------- drawing ---------- */
  var PANELS = { teams: "Teams", results: "Results", views: "Page views" };

  // the Save button at the top and the ones at the bottom of each section always match
  function setSaveDisabled(off) {
    $("save").disabled = off;
    Array.prototype.forEach.call(document.querySelectorAll(".save-btn"), function (button) { button.disabled = off; });
  }

  function draw() {
    Object.keys(PANELS).forEach(function (key) {
      $("panel-" + key).hidden = key !== active;
      var button = document.querySelector('.dash-menu [data-panel="' + key + '"]');
      button.classList.toggle("active", key === active);
      button.classList.toggle("unsaved", !!docs[key] && isDirty(docs[key]));
    });
    $("dash-title").textContent = PANELS[active];
    var doc = docs[active];                       // "Page views" has nothing to save
    $("dash-actions").hidden = !doc;
    var dirty = !!doc && isDirty(doc);
    setSaveDisabled(!dirty);
    $("discard").disabled = !dirty;
    if (!doc || !doc.loaded) return;
    if (active === "teams") drawTeams(); else drawResults();
  }

  /* ---------- Page views ----------
     Every page of the website adds one to its own counter when it is opened (see countView
     in main.js). Here the counters are read back from the counting service. */
  var VIEW_PAGES = [
    ["home", "Home"], ["teams", "Teams"], ["team", "Team pages (all teams)"], ["results", "Results"],
    ["fixtures", "Fixtures"], ["statistics", "Statistics"], ["about", "About"]
  ];

  async function loadViews() {
    var views = typeof SITE !== "undefined" ? SITE.views : null;
    if (!views || !views.api) return msg("dash-msg", "Page-view counting is switched off (see \"views\" in js/data.js).", "error");

    $("views-refresh").disabled = true;
    msg("dash-msg", "Loading page views…");
    var counts;
    try {
      counts = await Promise.all(VIEW_PAGES.map(function (p) {
        return fetch(views.api + "/get/" + views.namespace + "/" + p[0], { cache: "no-store" }).then(function (res) {
          if (res.status === 404) return 0;                       // nobody has opened that page yet
          if (!res.ok) throw new Error("status " + res.status);
          return res.json().then(function (data) { return Number(data.value) || 0; });
        });
      }));
    } catch (e) {
      $("views-refresh").disabled = false;
      return msg("dash-msg", "Could not load the page views. The counting service may be busy – press Refresh in a moment.", "error");
    }

    var body = $("views-body"), total = 0;
    body.textContent = "";
    VIEW_PAGES.forEach(function (p, i) {
      var tr = body.insertRow();
      tr.insertCell().textContent = p[1];
      tr.insertCell().textContent = counts[i].toLocaleString("en-GB");
      total += counts[i];
    });
    $("views-total").textContent = total.toLocaleString("en-GB");
    $("views-refresh").disabled = false;
    if (active === "views") msg("dash-msg", "");
  }

  /* ---------- Teams ---------- */
  function drawTeams() {
    var before = JSON.parse(docs.teams.saved);
    var grid = $("admin-teams");
    grid.textContent = "";
    docs.teams.data.forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "team-tile" + (i === picked.team ? " selected" : "") +
        (JSON.stringify(t) !== JSON.stringify(before[i]) ? " changed" : "");
      var span = document.createElement("span");
      span.textContent = t.name || "(no name)";
      b.appendChild(span);
      b.addEventListener("click", function () { pickTeam(i); });
      grid.appendChild(b);
    });
  }

  // a player is { name, jersey, position, goals, yellow, red }; older data had just the name
  function cleanPlayer(p) {
    if (typeof p === "string") p = { name: p };
    p = p || {};
    var count = function (v) { v = Math.floor(Number(v)); return isFinite(v) && v > 0 ? v : 0; };
    return {
      name: String(p.name || "").trim(), jersey: String(p.jersey === undefined || p.jersey === null ? "" : p.jersey).trim(),
      position: String(p.position || "").trim(), goals: count(p.goals), yellow: count(p.yellow), red: count(p.red)
    };
  }

  var PLAYER_FIELDS = [
    ["name", "text", "Player name"], ["jersey", "text", "Jersey number"], ["position", "text", "Position"],
    ["goals", "number", "Goals"], ["yellow", "number", "Yellow cards"], ["red", "number", "Red cards"]
  ];

  // one row of inputs per player
  function drawPlayerRows() {
    var t = docs.teams.data[picked.team], body = $("f-players");
    body.textContent = "";
    if (!t.players.length) {
      var empty = body.insertRow().insertCell();
      empty.colSpan = PLAYER_FIELDS.length + 1;
      empty.className = "none";
      empty.textContent = "No players yet.";
      return;
    }
    t.players.forEach(function (p, row) {
      var tr = body.insertRow();
      PLAYER_FIELDS.forEach(function (f) {
        var input = document.createElement("input");
        input.type = f[1];
        input.setAttribute("data-field", f[0]);
        input.setAttribute("aria-label", f[2]);
        if (f[1] === "number") { input.min = 0; input.max = 99; input.step = 1; input.inputMode = "numeric"; }
        if (f[0] === "jersey") { input.inputMode = "numeric"; input.maxLength = 3; }
        if (f[0] === "name") input.maxLength = 60;
        if (f[0] === "position") { input.setAttribute("list", "positions"); input.maxLength = 30; }
        input.value = f[1] === "number" && !p[f[0]] ? "" : p[f[0]];
        if (f[1] === "number") input.placeholder = "0";
        tr.insertCell().appendChild(input);
      });
      var remove = document.createElement("button");
      remove.type = "button"; remove.className = "remove"; remove.textContent = "✕";
      remove.setAttribute("aria-label", "Remove player");
      remove.addEventListener("click", function () {
        t.players.splice(row, 1);
        drawPlayerRows();
        msg("dash-msg", "");
        draw();
      });
      tr.insertCell().appendChild(remove);
    });
  }

  function pickTeam(i) {
    picked.team = i;
    var t = docs.teams.data[i];
    $("f-name").value = t.name;
    $("f-short").value = t.short;
    $("f-manager").value = t.manager;
    $("f-address").value = t.address;
    drawPlayerRows();
    $("editor").hidden = false;
    draw();
    $("f-name").focus();
  }

  function readTeamEditor() {
    var t = docs.teams.data[picked.team];
    if (!t) return;
    t.name = $("f-name").value.trim();
    t.short = $("f-short").value.trim();
    t.manager = $("f-manager").value.trim();
    t.address = $("f-address").value.trim();
    t.players = Array.prototype.map.call($("f-players").querySelectorAll("tr"), function (tr) {
      var p = {};
      Array.prototype.forEach.call(tr.querySelectorAll("input"), function (input) { p[input.getAttribute("data-field")] = input.value; });
      return p;
    }).filter(function (p) { return "name" in p; }).map(cleanPlayer);
    msg("dash-msg", "");
    draw();
  }

  function addPlayer() {
    var t = docs.teams.data[picked.team];
    if (!t) return;
    t.players.push(cleanPlayer({}));
    drawPlayerRows();
    draw();
    var names = $("f-players").querySelectorAll('input[data-field="name"]');
    names[names.length - 1].focus();
  }

  /* ---------- Results ---------- */
  function teamName(id) {
    var t = docs.teams.data.filter(function (x) { return x.id === id; })[0];
    return t ? (t.name || "(no name)") : id;
  }
  function resolved() { return Bracket.resolve(docs.results.data); }
  function storedMatch(id) { return docs.results.data.filter(function (m) { return m.id === id; })[0]; }
  function sideName(m, slot) {
    var id = slot === 0 ? m.home : m.away;
    return id ? teamName(id) : Bracket.waitingFor(m, slot);
  }

  function hasResult(s) {
    return s.homeGoals !== null || s.awayGoals !== null || s.homePens !== null || s.awayPens !== null ||
      (s.scorers || []).length > 0 || (s.cards || []).length > 0 || !!s.potm;
  }
  function wipeResult(s) {
    s.homeGoals = s.awayGoals = s.homePens = s.awayPens = null;
    s.scorers = [];
    s.cards = [];
    delete s["for"];
    delete s.done;
    delete s.potm;
  }

  function drawResults() {
    var list = resolved();
    Bracket.render($("admin-bracket"), list, { name: teamName, onPick: pickMatch, selected: picked.match });

    var select = $("m-pick");
    select.textContent = "";
    list.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = "Match " + m.no + " · " + m.roundName + " · " + sideName(m, 0) + " v " + sideName(m, 1);
      select.appendChild(o);
    });
    select.value = picked.match;
  }

  function numberText(v) { return v === null || v === undefined ? "" : String(v); }
  function scorerLines(m, teamId) {
    return (m.scorers || []).filter(function (s) { return s.team === teamId; }).map(function (s) {
      return s.player + (s.minute ? " " + s.minute : "");
    }).join("\n");
  }

  function cardLines(m, teamId, type) {
    return (m.cards || []).filter(function (c) { return c.team === teamId && c.type === type; }).map(function (c) {
      return c.player + (c.minute ? " " + c.minute : "");
    }).join("\n");
  }
  // the four card boxes: [box id, label id, "home"/"away", card type]
  var CARD_BOXES = [["m-hy", "l-hy", "home", "yellow"], ["m-ay", "l-ay", "away", "yellow"], ["m-hr", "l-hr", "home", "red"], ["m-ar", "l-ar", "away", "red"]];

  // puts the picked match into the form
  function fillMatchEditor() {
    var m = resolved().filter(function (x) { return x.id === picked.match; })[0];
    var stored = storedMatch(m.id);
    var s = m.stale ? {} : stored;         // a result typed for other teams is not shown

    [["m-home", 0, m.home], ["m-away", 1, m.away]].forEach(function (f) {
      var select = $(f[0]);
      select.textContent = "";
      if (m.from) {                                  // decided by earlier matches
        var only = document.createElement("option");
        only.textContent = sideName(m, f[1]);
        select.appendChild(only);
        select.disabled = true;
      } else {
        docs.teams.data.forEach(function (t) {
          var o = document.createElement("option");
          o.value = t.id; o.textContent = t.name || "(no name)";
          select.appendChild(o);
        });
        select.value = f[2] || "";
        select.disabled = false;
      }
    });

    $("m-date").value = stored.date || "";
    $("m-time").value = stored.time || "";
    $("m-venue").value = stored.venue || "";
    $("m-hg").value = numberText(s.homeGoals);
    $("m-ag").value = numberText(s.awayGoals);
    $("m-hp").value = numberText(s.homePens);
    $("m-ap").value = numberText(s.awayPens);
    $("m-hs").value = m.home ? scorerLines(s, m.home) : "";
    $("m-as").value = m.away ? scorerLines(s, m.away) : "";
    CARD_BOXES.forEach(function (b) { $(b[0]).value = m[b[2]] ? cardLines(s, m[b[2]], b[3]) : ""; });

    // player of the match: name (with the two squads as suggestions) + which of the two teams
    $("m-potm").value = s.potm ? s.potm.player : "";
    var teamPick = $("m-potm-team"), suggestions = $("m-potm-names");
    teamPick.textContent = ""; suggestions.textContent = "";
    [m.home, m.away].forEach(function (id, slot) {
      var o = document.createElement("option");
      o.value = id || ""; o.textContent = sideName(m, slot);
      teamPick.appendChild(o);
      var squad = docs.teams.data.filter(function (t) { return t.id === id; })[0];
      (squad ? squad.players : []).forEach(function (p) {
        if (!p.name) return;
        var name = document.createElement("option");
        name.value = p.name; name.label = sideName(m, slot);
        suggestions.appendChild(name);
      });
    });
    teamPick.value = s.potm && s.potm.team === m.away ? m.away : (m.home || "");
    updateMatchForm();
  }

  // labels, and which boxes can be used, for the picked match
  function updateMatchForm() {
    var m = resolved().filter(function (x) { return x.id === picked.match; })[0];
    var s = m.stale ? {} : storedMatch(m.id);
    $("m-title").textContent = "Match " + m.no + " · " + m.roundName;
    $("l-hg").textContent = "Goals – " + sideName(m, 0);
    $("l-ag").textContent = "Goals – " + sideName(m, 1);
    $("l-hp").textContent = "Penalties – " + sideName(m, 0);
    $("l-ap").textContent = "Penalties – " + sideName(m, 1);
    $("l-hs").textContent = "Scorers – " + sideName(m, 0);
    $("l-as").textContent = "Scorers – " + sideName(m, 1);
    CARD_BOXES.forEach(function (b) {
      $(b[1]).textContent = (b[3] === "yellow" ? "Yellow cards – " : "Red cards – ") + sideName(m, b[2] === "home" ? 0 : 1);
      $(b[0]).disabled = !m.ready;
    });
    ["m-hg", "m-ag", "m-hs", "m-as", "m-potm", "m-potm-team"].forEach(function (id) { $(id).disabled = !m.ready; });

    var level = m.ready && typeof s.homeGoals === "number" && s.homeGoals === s.awayGoals;
    $("pens").hidden = !level;
    $("m-note").textContent = !m.ready
      ? "The result can be entered once both teams are known."
      : level ? "Level score: enter the penalty shoot-out result to decide the winner." : "";
    $("m-clear").disabled = !(typeof s.homeGoals === "number" || typeof s.awayGoals === "number" || (s.scorers || []).length || (s.cards || []).length || s.potm);
  }

  function pickMatch(id) {
    picked.match = id;
    fillMatchEditor();
    draw();
  }

  function toNumber(text) {
    text = String(text).trim();
    if (text === "") return null;
    var n = Math.floor(Number(text));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function parseScorers(text, teamId) {
    return text.split("\n").map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
      var m = line.match(/^(.*?)[\s,]+(\d{1,3})'?$/);      // "Name 23"  ->  player + minute
      return m && m[1].trim() ? { player: m[1].trim(), team: teamId, minute: Number(m[2]) }
                              : { player: line, team: teamId, minute: null };
    });
  }

  function readMatchEditor(e) {
    var s = storedMatch(picked.match);
    var m = resolved().filter(function (x) { return x.id === picked.match; })[0];
    var field = e && e.target ? e.target.id : "";

    if (field === "m-pick") return pickMatch($("m-pick").value);

    // changing a 1st Round team: the two teams swap places, so nobody is left out or listed twice
    if ((field === "m-home" || field === "m-away") && !m.from) {
      var slot = field === "m-home" ? "home" : "away";
      var incoming = $(field).value, outgoing = s[slot];
      docs.results.data.forEach(function (other) {
        ["home", "away"].forEach(function (k) {
          if (other[k] === incoming && !(other === s && k === slot)) other[k] = outgoing;
        });
      });
      s[slot] = incoming;
      fillMatchEditor();
      msg("dash-msg", "");
      return draw();
    }

    s.date = $("m-date").value;
    s.time = $("m-time").value;
    s.venue = $("m-venue").value.trim();
    if (m.ready) {
      s.homeGoals = toNumber($("m-hg").value);
      s.awayGoals = toNumber($("m-ag").value);
      var level = s.homeGoals !== null && s.homeGoals === s.awayGoals;
      s.homePens = level ? toNumber($("m-hp").value) : null;
      s.awayPens = level ? toNumber($("m-ap").value) : null;
      s.scorers = parseScorers($("m-hs").value, m.home).concat(parseScorers($("m-as").value, m.away));
      s.cards = [];
      CARD_BOXES.forEach(function (b) {                    // same "Name 40" lines as the scorers
        parseScorers($(b[0]).value, m[b[2]]).forEach(function (c) { c.type = b[3]; s.cards.push(c); });
      });
      var best = $("m-potm").value.trim();
      if (best) {
        // picking a name from one squad's suggestions also sets that team
        if (field === "m-potm") {
          var owner = [m.home, m.away].filter(function (id) {
            var squad = docs.teams.data.filter(function (t) { return t.id === id; })[0];
            return squad && squad.players.some(function (p) { return p.name === best; });
          });
          if (owner.length === 1) $("m-potm-team").value = owner[0];
        }
        s.potm = { player: best, team: $("m-potm-team").value === m.away ? m.away : m.home };
      } else delete s.potm;
      // remember which two teams this result belongs to (see Bracket.resolve)
      if (hasResult(s)) s["for"] = Bracket.pairKey(m); else delete s["for"];
      delete s.done;       // the old "mark as done" tick box: a match now counts as finished once it has a score
    }

    updateMatchForm();
    msg("dash-msg", "");
    draw();
  }

  function clearResult() {
    wipeResult(storedMatch(picked.match));
    fillMatchEditor();
    msg("dash-msg", "Result cleared.");
    draw();
  }

  // before saving: drop results that no longer belong to the teams in the match
  function tidyResults() {
    resolved().forEach(function (m) {
      var s = storedMatch(m.id);
      if ((m.stale || !m.ready) && hasResult(s)) wipeResult(s);
    });
  }

  /* ---------- saving ---------- */
  function problemsBeforeSave(doc) {
    if (doc === docs.teams) {
      if (doc.data.some(function (t) { return !t.name; })) return "Every team needs a name before saving.";
      for (var k = 0; k < doc.data.length; k++) {
        var unnamed = doc.data[k].players.filter(function (p) { return !p.name; });
        if (unnamed.some(function (p) { return p.jersey || p.position || p.goals || p.yellow || p.red; })) {
          return doc.data[k].name + ": a player has details but no name.";
        }
      }
      return "";
    }
    var list = resolved();
    for (var i = 0; i < list.length; i++) {
      var m = list[i], s = storedMatch(m.id);
      if ((s.homeGoals === null) !== (s.awayGoals === null)) return "Match " + m.no + ": enter the goals for both teams.";
      if (m.played && !m.winner) return "Match " + m.no + " ended level: enter the penalty shoot-out result (it cannot be a draw).";
      if ((s.cards || []).length && !m.played) return "Match " + m.no + ": enter the score before the cards.";
      if (s.potm && !m.played) return "Match " + m.no + ": enter the score before the player of the match.";
      if (m.played) {
        var listed = function (id) { return m.scorers.filter(function (x) { return x.team === id; }).length; };
        if (listed(m.home) > m.homeGoals || listed(m.away) > m.awayGoals) return "Match " + m.no + ": more scorers are listed than goals scored.";
      }
    }
    return "";
  }

  async function save() {
    var doc = docs[active];
    if (doc === docs.results) tidyResults();
    var problem = problemsBeforeSave(doc);
    if (problem) return msg("dash-msg", problem, "error");
    if (doc === docs.teams) {                       // empty player rows are not saved
      doc.data.forEach(function (t) { t.players = t.players.filter(function (p) { return p.name; }); });
      if (picked.team >= 0) drawPlayerRows();
    }

    setSaveDisabled(true);
    msg("dash-msg", "Saving…");
    var body = {
      message: "Update " + doc.label + " (admin panel)",
      content: b64(enc.encode(doc.header + JSON.stringify(doc.data, null, 2) + ";\n")),
      branch: ADMIN_REPO.branch
    };
    if (doc.sha) body.sha = doc.sha;

    var res;
    try { res = await github("/contents/" + doc.path, { method: "PUT", body: body }); }
    catch (e) {
      draw();
      return msg("dash-msg", "Could not reach GitHub. Your changes are still here – try Save again.", "error");
    }
    if (res.status === 401) { forgetToken(); show("view-connect"); return msg("connect-msg", explain(401), "error"); }
    if (!res.ok) { draw(); return msg("dash-msg", explain(res.status, doc), "error"); }

    doc.sha = res.data.content.sha;
    doc.saved = JSON.stringify(doc.data);
    if (doc === docs.results) fillMatchEditor();
    draw();
    msg("dash-msg", "Saved. The website will show the changes in about a minute.", "ok");
  }

  function discard() {
    var doc = docs[active];
    doc.data = JSON.parse(doc.saved);
    if (doc === docs.results) fillMatchEditor();
    else if (picked.team >= 0) pickTeam(picked.team);
    draw();
    msg("dash-msg", "Changes discarded.");
  }

  /* ---------- screens ---------- */
  var failures = 0;

  $("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!window.crypto || !crypto.subtle) return msg("login-msg", "This browser cannot run the admin panel. Open it over https in a current browser.", "error");
    var btn = $("login-btn");
    btn.disabled = true;
    msg("login-msg", "Checking…");
    var result = await derive($("pw1").value.trim(), $("pw2").value.trim());
    $("pw1").value = ""; $("pw2").value = "";

    var pair = ADMIN_AUTH.checks.indexOf(result.check);   // which password pair was typed (-1 = none)
    if (pair < 0) {
      failures++;
      msg("login-msg", "Wrong passwords.", "error");
      setTimeout(function () { btn.disabled = false; }, Math.min(failures, 10) * 1500);   // slow down guessing
      $("pw1").focus();
      return;
    }
    failures = 0;
    btn.disabled = false;
    msg("login-msg", "");
    session.key = result.key;
    // each pair has its own key, so each keeps its own locked copy of the token
    session.slot = TOKEN_KEY + "-" + result.check.slice(0, 8);
    rememberLogin(result.raw);
    enter();
  });

  $("connect-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var token = $("token").value.trim(), btn = $("connect-btn");
    btn.disabled = true;
    msg("connect-msg", "Checking the token…");
    var res;
    try { res = await github("", { token: token }); }
    catch (err) { btn.disabled = false; return msg("connect-msg", "Could not reach GitHub. Check your internet connection.", "error"); }
    btn.disabled = false;
    if (!res.ok) {
      return msg("connect-msg", res.status === 404
        ? "This token cannot see " + ADMIN_REPO.owner + "/" + ADMIN_REPO.repo + ". Check the repository access in step 2."
        : explain(res.status, docs.teams), "error");
    }
    $("token").value = "";
    msg("connect-msg", "");
    session.token = token;
    await saveToken(token);
    show("view-dash");
    loadAll();
  });

  $("logout").addEventListener("click", function () {
    if (anyDirty() && !confirm("You have changes that are not saved. Log out anyway?")) return;
    session.key = null; session.token = null;
    forgetLogin();
    docs.teams = makeDoc(docs.teams.path, "TEAMS", "teams");
    docs.results = makeDoc(docs.results.path, "MATCHES", "results");
    active = "teams";
    $("admin-teams").textContent = "";
    $("admin-bracket").textContent = "";
    $("editor").hidden = true;
    msg("dash-msg", "");
    show("view-login");
    $("pw1").focus();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".dash-menu [data-panel]"), function (button) {
    button.addEventListener("click", function () {
      active = button.getAttribute("data-panel");
      msg("dash-msg", "");
      draw();                                   // the panel must be visible before the tree is measured
      if (active === "results" && docs.results.loaded) { fillMatchEditor(); draw(); }
      if (active === "views") loadViews();
    });
  });

  $("editor").addEventListener("input", readTeamEditor);
  $("editor").addEventListener("submit", function (e) { e.preventDefault(); });
  $("m-editor").addEventListener("input", readMatchEditor);
  $("m-editor").addEventListener("submit", function (e) { e.preventDefault(); });
  $("f-add").addEventListener("click", addPlayer);
  $("m-clear").addEventListener("click", clearResult);
  $("views-refresh").addEventListener("click", loadViews);
  $("save").addEventListener("click", save);
  Array.prototype.forEach.call(document.querySelectorAll(".save-btn"), function (button) {
    button.addEventListener("click", save);         // the Save buttons at the bottom of Teams and Results
  });
  $("discard").addEventListener("click", discard);

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (active === "results" && docs.results.loaded && !$("view-dash").hidden) drawResults(); }, 150);
  });

  window.addEventListener("beforeunload", function (e) {
    if (session.token && anyDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  restoreLogin().then(function (ok) {
    if (ok) return enter();
    show("view-login");
    $("pw1").focus();
  });
})();
