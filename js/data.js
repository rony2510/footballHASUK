/*
  Site details and matches live in this file.
  Teams live in data/teams.js and are edited from the admin panel (admin.html).

  NOTE: the matches and scores below are SAMPLE DATA.
  Replace them with the real ones before sharing the site.
*/

const SITE = {
  title: "মঙ্গল সরকার স্মৃতি জাতীয় হাজং ফুটবল টুর্নামেন্ট ২০২৬",
  tagline: "National Hajong Football Tournament in memory of Mangal Sarkar",
  year: 2026,
  // TODO: put the real address / contact here (shown in the footer and About page)
  address: "Your address here, Bangladesh",
  email: "",   // optional, e.g. "info@example.com"
  phone: ""    // optional
};

// TEAMS are not in this file any more: they live in data/teams.js,
// which the admin panel (admin.html) updates for you.

/*
  One entry per match.
  - Not played yet  -> leave homeGoals / awayGoals as null  (shows on Fixtures)
  - Played          -> fill in the goals                     (shows on Results,
                       and the points table + statistics update automatically)
  - stage "Group A" ... "Group D" counts toward the points table;
    anything else (e.g. "Semi-final", "Final") does not.
  - scorers is optional: { player, team (team id), minute }
*/
const MATCHES = [
  { date: "2026-11-20", time: "15:00", venue: "Main Ground", stage: "Group A",
    home: "a", away: "b", homeGoals: 2, awayGoals: 1,
    scorers: [
      { player: "Player 1", team: "a", minute: 12 },
      { player: "Player 2", team: "b", minute: 40 },
      { player: "Player 1", team: "a", minute: 77 }
    ] },
  { date: "2026-11-20", time: "17:00", venue: "Main Ground", stage: "Group A",
    home: "c", away: "d", homeGoals: 0, awayGoals: 0, scorers: [] },
  { date: "2026-11-21", time: "15:00", venue: "Main Ground", stage: "Group B",
    home: "e", away: "f", homeGoals: 1, awayGoals: 3,
    scorers: [
      { player: "Player 3", team: "f", minute: 8 },
      { player: "Player 4", team: "e", minute: 30 },
      { player: "Player 3", team: "f", minute: 55 },
      { player: "Player 5", team: "f", minute: 81 }
    ] },
  { date: "2026-11-21", time: "17:00", venue: "Main Ground", stage: "Group B",
    home: "g", away: "h", homeGoals: 2, awayGoals: 0,
    scorers: [
      { player: "Player 6", team: "g", minute: 23 },
      { player: "Player 7", team: "g", minute: 68 }
    ] },

  { date: "2026-11-22", time: "15:00", venue: "Main Ground", stage: "Group A",
    home: "a", away: "c", homeGoals: null, awayGoals: null },
  { date: "2026-11-22", time: "17:00", venue: "Main Ground", stage: "Group A",
    home: "b", away: "d", homeGoals: null, awayGoals: null },
  { date: "2026-11-23", time: "15:00", venue: "Main Ground", stage: "Group B",
    home: "e", away: "g", homeGoals: null, awayGoals: null },
  { date: "2026-11-23", time: "17:00", venue: "Main Ground", stage: "Group B",
    home: "f", away: "h", homeGoals: null, awayGoals: null }
];
