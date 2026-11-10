const { scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;
const ALLOWED_ROLES = new Set(["PATIENT", "DOCTOR", "ADMIN"]);

async function verifyPassword(password, passwordHash) {
  const [algorithm, saltText, keyText] = String(passwordHash || "").split("$");
  const salt = Buffer.from(saltText || "", "base64url");
  const expectedKey = Buffer.from(keyText || "", "base64url");

  if (algorithm !== "scrypt" || salt.length !== 16 || expectedKey.length !== 64) {
    await scrypt(String(password || ""), Buffer.alloc(16), 64);
    return false;
  }

  const derivedKey = await scrypt(String(password || ""), salt, expectedKey.length);
  return timingSafeEqual(derivedKey, expectedKey);
}

async function authenticateUser({ models, email, password }) {
  if (!models?.User) return null;

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await models.User.findOne({
    where: { email: normalizedEmail },
    attributes: ["id", "firstName", "lastName", "email", "passwordHash", "role", "status", "emailVerifiedAt"]
  });

  const passwordMatches = await verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (
    !user
    || !passwordMatches
    || !ALLOWED_ROLES.has(user.role)
    || user.status !== "ACTIVE"
    || !user.emailVerifiedAt
  ) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  };
}

async function authenticatePatient(credentials) {
  const account = await authenticateUser(credentials);
  return account?.role === "PATIENT" ? account : null;
}

module.exports = { authenticatePatient, authenticateUser, verifyPassword };
