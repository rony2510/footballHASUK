/* Admin panel settings */

// Where the website's files live on GitHub
var ADMIN_REPO = {
  owner: "rony2510",
  repo: "footballHASUK",
  branch: "main"
};

// The two admin passwords are NOT stored here. Only a salted, one-way
// PBKDF2-SHA256 hash of them is, so they cannot be read back from this file.
var ADMIN_AUTH = {
  salt: "Nid+mOJBhIjAdTcxBHojUQ==",
  iterations: 600000,
  check: "ZWOhJPpZPu0Ie84ulzKWV8KGLm7wd+pM02Ml7ohoCFU="
};
