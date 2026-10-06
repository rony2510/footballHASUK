/* Admin panel settings */

// Where the website's files live on GitHub
var ADMIN_REPO = {
  owner: "rony2510",
  repo: "footballHASUK",
  branch: "main"
};

// The admin passwords are NOT stored here. Each line in "checks" is a salted,
// one-way PBKDF2-SHA256 hash of one password pair (password 1 + password 2),
// so the passwords cannot be read back from this file.
// Any one pair logs in. Delete a line to switch that pair off.
var ADMIN_AUTH = {
  salt: "Nid+mOJBhIjAdTcxBHojUQ==",
  iterations: 600000,
  checks: [
    "ZWOhJPpZPu0Ie84ulzKWV8KGLm7wd+pM02Ml7ohoCFU=", // pair 1
    "03jUQRSQ0m9tWL//S65f5nQUeemoMxTnWmWjjBqt1K0=", // pair 2
    "Ci5S4cd/fGqiq8JFi6bGrCQ750cc1BIpxSyWWtD9YbY=", // pair 3
    "bs4/07AEddMz8z3otAxpf/0GtxTHXudgdbu67Hy8D9M=", // pair 4
    "NysYiFWSY/3gtVB030VEUDoZGPZnQeilZU0KsVi13bA=", // pair 5
    "VNwsQkQEqBjztj0srZSzTCjM6UDTpIAnN6LCdm963TA="  // pair 6
  ]
};
