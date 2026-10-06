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

  var TEAMS_PATH = "data/teams.js";
  var TOKEN_KEY = "hasuk-admin-token";
  var SESSION_KEY = "hasuk-admin-session";
  var GROUPS = ["A", "B", "C", "D"];
  var API = "https://api.github.com/repos/" + ADMIN_REPO.owner + "/" + ADMIN_REPO.repo;

  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder(), dec = new TextDecoder();

  // The login lasts for this browser tab: it survives a page refresh and ends
  // when you log out or close the tab.
  var session = { key: null, token: null, slot: TOKEN_KEY };
  var state = { teams: [], saved: "", sha: null, header: "", selected: -1 };

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
    if (session.token) { show("view-dash"); loadTeams(); }
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

  function explain(status) {
    if (status === 401) return "GitHub did not accept the access token (it may have expired). Please connect again.";
    if (status === 403) return "The access token is not allowed to change this repository. It needs Contents: Read and write.";
    if (status === 404) return "GitHub could not find " + TEAMS_PATH + " in " + ADMIN_REPO.owner + "/" + ADMIN_REPO.repo + ". Push the site once so the file exists, and check the token can access this repository.";
    if (status === 409 || status === 422) return "The team data was changed somewhere else since you opened this page. Reload the page and try again.";
    return "GitHub returned an error (" + status + "). Please try again.";
  }

  /* ---------- teams data ---------- */
  function parseTeams(text) {
    var at = text.lastIndexOf("window.TEAMS");
    var start = text.indexOf("[", at), end = text.lastIndexOf("]");
    if (at < 0 || start < 0 || end < start) throw new Error("format");
    return { header: text.slice(0, start), teams: JSON.parse(text.slice(start, end + 1)) };
  }
  function serialize() {
    return state.header + JSON.stringify(state.teams, null, 2) + ";\n";
  }
  function isDirty() { return JSON.stringify(state.teams) !== state.saved; }

  async function loadTeams() {
    msg("dash-msg", "Loading teams…");
    var res;
    try { res = await github("/contents/" + TEAMS_PATH + "?ref=" + encodeURIComponent(ADMIN_REPO.branch)); }
    catch (e) { return msg("dash-msg", "Could not reach GitHub. Check your internet connection and reload.", "error"); }

    if (res.status === 401) { forgetToken(); show("view-connect"); return msg("connect-msg", explain(401), "error"); }
    if (!res.ok) return msg("dash-msg", explain(res.status), "error");

    try {
      var parsed = parseTeams(dec.decode(unb64(res.data.content)));
      state.teams = parsed.teams.map(function (t) {
        return { id: t.id, name: t.name || "", short: t.short || "", group: t.group || "", area: t.area || "", players: t.players || [] };
      });
      state.header = parsed.header;
    } catch (e) {
      return msg("dash-msg", "Could not read " + TEAMS_PATH + ". It may have been edited by hand in a way that is not valid JSON.", "error");
    }
    state.saved = JSON.stringify(state.teams);
    state.sha = res.data.sha;
    state.selected = -1;
    $("editor").hidden = true;
    msg("dash-msg", "");
    drawTeams();
  }

  function drawTeams() {
    var before = JSON.parse(state.saved || "[]");
    var grid = $("admin-teams");
    grid.textContent = "";
    state.teams.forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "team-tile" + (i === state.selected ? " selected" : "") +
        (JSON.stringify(t) !== JSON.stringify(before[i]) ? " changed" : "");
      var span = document.createElement("span");
      span.textContent = t.name || "(no name)";
      b.appendChild(span);
      b.addEventListener("click", function () { select(i); });
      grid.appendChild(b);
    });
    var dirty = isDirty();
    $("save").disabled = !dirty;
    $("discard").disabled = !dirty;
  }

  function select(i) {
    state.selected = i;
    var t = state.teams[i];
    $("editor-title").textContent = "Edit team";
    $("f-name").value = t.name;
    $("f-short").value = t.short;
    $("f-area").value = t.area;
    $("f-players").value = t.players.join("\n");

    var groups = GROUPS.indexOf(t.group) < 0 && t.group ? GROUPS.concat(t.group) : GROUPS;
    var sel = $("f-group");
    sel.textContent = "";
    groups.forEach(function (g) {
      var o = document.createElement("option");
      o.value = g; o.textContent = "Group " + g;
      sel.appendChild(o);
    });
    sel.value = t.group;

    $("editor").hidden = false;
    drawTeams();
    $("f-name").focus();
  }

  function readEditor() {
    var t = state.teams[state.selected];
    if (!t) return;
    t.name = $("f-name").value.trim();
    t.short = $("f-short").value.trim();
    t.group = $("f-group").value;
    t.area = $("f-area").value.trim();
    t.players = $("f-players").value.split("\n").map(function (p) { return p.trim(); }).filter(Boolean);
    msg("dash-msg", "");
    drawTeams();
  }

  async function save() {
    var nameless = state.teams.filter(function (t) { return !t.name; });
    if (nameless.length) return msg("dash-msg", "Every team needs a name before saving.", "error");

    $("save").disabled = true;
    msg("dash-msg", "Saving…");
    var res;
    try {
      res = await github("/contents/" + TEAMS_PATH, {
        method: "PUT",
        body: {
          message: "Update teams (admin panel)",
          content: b64(enc.encode(serialize())),
          sha: state.sha,
          branch: ADMIN_REPO.branch
        }
      });
    } catch (e) {
      drawTeams();
      return msg("dash-msg", "Could not reach GitHub. Your changes are still here – try Save again.", "error");
    }
    if (res.status === 401) { forgetToken(); show("view-connect"); return msg("connect-msg", explain(401), "error"); }
    if (!res.ok) { drawTeams(); return msg("dash-msg", explain(res.status), "error"); }

    state.sha = res.data.content.sha;
    state.saved = JSON.stringify(state.teams);
    drawTeams();
    msg("dash-msg", "Saved. The website will show the changes in about a minute.", "ok");
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
        : explain(res.status), "error");
    }
    $("token").value = "";
    msg("connect-msg", "");
    session.token = token;
    await saveToken(token);
    show("view-dash");
    loadTeams();
  });

  $("logout").addEventListener("click", function () {
    if (isDirty() && !confirm("You have changes that are not saved. Log out anyway?")) return;
    session.key = null; session.token = null;
    forgetLogin();
    state.teams = []; state.saved = ""; state.sha = null; state.selected = -1;
    $("admin-teams").textContent = "";
    $("editor").hidden = true;
    msg("dash-msg", "");
    show("view-login");
    $("pw1").focus();
  });

  $("editor").addEventListener("input", readEditor);
  $("editor").addEventListener("submit", function (e) { e.preventDefault(); });
  $("save").addEventListener("click", save);
  $("discard").addEventListener("click", function () {
    state.teams = JSON.parse(state.saved);
    if (state.selected >= 0) select(state.selected); else drawTeams();
    msg("dash-msg", "Changes discarded.");
  });

  window.addEventListener("beforeunload", function (e) {
    if (session.token && isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  restoreLogin().then(function (ok) {
    if (ok) return enter();
    show("view-login");
    $("pw1").focus();
  });
})();
