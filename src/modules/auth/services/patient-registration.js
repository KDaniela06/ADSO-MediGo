const { randomBytes, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

function normalizeRegistration(values) {
  return {
    ...values,
    documentType: values.documentType.trim().toUpperCase(),
    documentNumber: values.documentNumber.trim().replace(/\s+/g, "").toUpperCase(),
    email: values.email.trim().toLowerCase()
  };
}

async function registerPatient({ sequelize, models, input, now = new Date(), termsVersion = "v1", privacyVersion = "v1" }) {
  const { User, Patient } = models;
  const data = normalizeRegistration(input);
  const passwordHash = await hashPassword(data.password);

  return sequelize.transaction(async (transaction) => {
    const existingEmail = await User.findOne({ where: { email: data.email }, transaction });
    if (existingEmail) return { ok: false, reason: "email" };

    const existingDocument = await User.findOne({
      where: { documentType: data.documentType, documentNumber: data.documentNumber },
      transaction
    });
    if (existingDocument) return { ok: false, reason: "document" };

    const user = await User.create({
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: "PATIENT",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null
    }, { transaction });

    await Patient.create({
      userId: user.id,
      dateOfBirth: data.dateOfBirth,
      termsAcceptedAt: now,
      termsVersion,
      privacyAcceptedAt: now,
      privacyVersion
    }, { transaction });
    return { ok: true };
  });
}

module.exports = { hashPassword, normalizeRegistration, registerPatient };

