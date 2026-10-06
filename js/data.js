/*
  Site details (title, address, contact) live in this file.
  Teams and match results live in the data/ folder and are edited from the
  admin panel (admin.html).
*/

const SITE = {
  title: "মঙ্গল সরকার স্মৃতি জাতীয় হাজং ফুটবল টুর্নামেন্ট ২০২৬",
  tagline: "National Hajong Football Tournament in memory of Mangal Sarkar",
  year: 2026,
  // shown in the footer and on the About page
  address: "হাজং স্টুডেন্ট কাউন্সিল (হাসুক)",
  email: "",   // optional, e.g. "info@example.com"
  phone: "",   // optional

  // Page-view counting (shown in the admin panel under "Page views").
  // Each page tells this free public counting service "one more view" when it is opened.
  // Set api to "" to switch counting off.
  views: { api: "https://abacus.jasoncameron.dev", namespace: "hasuk-football-2026" }
};

// Teams and matches are not in this file: they live in data/teams.js and
// data/matches.js, which the admin panel (admin.html) updates for you.
