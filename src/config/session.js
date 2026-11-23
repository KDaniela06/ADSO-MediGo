const session = require("express-session");
const { csrfSync } = require("csrf-sync");

const DEVELOPMENT_SESSION_SECRET = "medigo-development-only-secret-change-before-deployment";
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionMiddleware({ environment = process.env, store } = {}) {
  const isProduction = environment.NODE_ENV === "production";
  const secret = environment.SESSION_SECRET;

  if (isProduction && !secret) {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  if (isProduction && !store) {
    throw new Error("A persistent session store must be configured in production.");
  }

  return session({
    name: "medigo.sid",
    secret: secret || DEVELOPMENT_SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax"
    }
  });
}

const {
  generateToken,
  csrfSynchronisedProtection
} = csrfSync({
  getTokenFromRequest: (request) => request.body?._csrf || request.get("x-csrf-token")
});

module.exports = {
  REMEMBER_ME_DURATION_MS,
  createSessionMiddleware,
  csrfSynchronisedProtection,
  generateToken
};
