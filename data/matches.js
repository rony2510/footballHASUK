/* Knockout matches (16 teams, 15 matches). Edited from the admin panel (admin.html).
   If you edit it by hand, keep it strict JSON (double quotes, no trailing commas).
     m1-m8  Round of 16: "home" and "away" are team ids from data/teams.js
     q1-q4  Quarter-finals, s1-s2 Semi-finals, f Final: teams are filled in
            automatically from the winners, so they have no "home"/"away"
     homeGoals/awayGoals  null until the match is played
     homePens/awayPens    only when the match ended level
     scorers              [{ "player": "...", "team": "<team id>", "minute": 23 }] */
window.MATCHES = [
  {
    "id": "m1",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": [],
    "home": "a",
    "away": "p"
  },
  {
    "id": "m2",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": [],
    "home": "c",
    "away": "b"
  },
  {
    "id": "m3",
    "date": "2026-10-17",
    "time": "11:30",
    "venue": "",
    "homeGoals": 1,
    "awayGoals": 0,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": [],
    "home": "e",
    "away": "f",
    "for": "e|f"
  },
  {
    "id": "m4",
    "date": "2026-10-17",
    "time": "09:30",
    "venue": "Fulbari, Kalmakanda, Netrakona",
    "homeGoals": 3,
    "awayGoals": 5,
    "homePens": null,
    "awayPens": null,
    "scorers": [
      {
        "player": "Messi",
        "team": "g",
        "minute": 10
      },
      {
        "player": "Messi",
        "team": "g",
        "minute": 10
      },
      {
        "player": "Messi",
        "team": "g",
        "minute": 10
      },
      {
        "player": "Ronaldo",
        "team": "h",
        "minute": 7
      },
      {
        "player": "Ronaldo",
        "team": "h",
        "minute": 7
      },
      {
        "player": "Ronaldo",
        "team": "h",
        "minute": 7
      },
      {
        "player": "Ronaldo",
        "team": "h",
        "minute": 7
      },
      {
        "player": "Ronaldo",
        "team": "h",
        "minute": 7
      }
    ],
    "cards": [
      {
        "player": "A",
        "team": "g",
        "minute": null,
        "type": "yellow"
      },
      {
        "player": "B",
        "team": "h",
        "minute": null,
        "type": "yellow"
      }
    ],
    "home": "g",
    "away": "h",
    "for": "g|h"
  },
  {
    "id": "m5",
    "date": "2026-10-17",
    "time": "12:30",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": [],
    "home": "i",
    "away": "j"
  },
  {
    "id": "m6",
    "date": "2026-10-17",
    "time": "10:20",
    "venue": "KMMMM",
    "homeGoals": 3,
    "awayGoals": 5,
    "homePens": null,
    "awayPens": null,
    "scorers": [
      {
        "player": "A",
        "team": "k",
        "minute": 11
      },
      {
        "player": "B",
        "team": "l",
        "minute": null
      }
    ],
    "cards": [
      {
        "player": "C",
        "team": "k",
        "minute": null,
        "type": "yellow"
      },
      {
        "player": "D",
        "team": "l",
        "minute": null,
        "type": "red"
      }
    ],
    "home": "k",
    "away": "l",
    "for": "k|l",
    "potm": {
      "player": "G",
      "team": "l"
    }
  },
  {
    "id": "m7",
    "date": "",
    "time": "",
    "venue": "Fulbari, Kalmakanda, Netrakona",
    "homeGoals": 1,
    "awayGoals": 1,
    "homePens": 3,
    "awayPens": 4,
    "scorers": [],
    "cards": [
      {
        "player": "Nunu",
        "team": "m",
        "minute": null,
        "type": "red"
      },
      {
        "player": "Haaland",
        "team": "m",
        "minute": null,
        "type": "red"
      },
      {
        "player": "Rodri",
        "team": "m",
        "minute": null,
        "type": "red"
      },
      {
        "player": "Cr",
        "team": "n",
        "minute": 7,
        "type": "red"
      },
      {
        "player": "Backham",
        "team": "n",
        "minute": 10,
        "type": "red"
      }
    ],
    "home": "m",
    "away": "n",
    "for": "m|n"
  },
  {
    "id": "m8",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": [],
    "home": "o",
    "away": "d"
  },
  {
    "id": "q1",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": []
  },
  {
    "id": "q2",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": 3,
    "awayGoals": 2,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": [],
    "for": "e|h"
  },
  {
    "id": "q3",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": []
  },
  {
    "id": "q4",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": []
  },
  {
    "id": "s1",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": []
  },
  {
    "id": "s2",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": []
  },
  {
    "id": "f",
    "date": "",
    "time": "",
    "venue": "",
    "homeGoals": null,
    "awayGoals": null,
    "homePens": null,
    "awayPens": null,
    "scorers": [],
    "cards": []
  }
];
