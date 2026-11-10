const { createHash, randomBytes } = require("node:crypto");
const { Op } = require("sequelize");

const EMAIL_CHANGE_PURPOSE = "EMAIL_CHANGE";
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 3;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function emailChangeUrl(token, baseUrl) {
  return new URL(`/confirmar-cambio-correo/${encodeURIComponent(token)}`, baseUrl).toString();
}

async function getPatientProfile({ models, userId }) {
  const user = await models.User.findOne({
    where: { id: userId, role: "PATIENT", status: "ACTIVE" },
    attributes: ["id", "documentType", "documentNumber", "firstName", "lastName", "email", "pendingEmail", "phone"]
  });
  if (!user) return null;
  const patient = await models.Patient.findOne({
    where: { userId },
    attributes: ["dateOfBirth"]
  });
  const profile = typeof user.get === "function" ? user.get({ plain: true }) : user;
  return { ...profile, dateOfBirth: patient?.dateOfBirth || null };
}

async function updatePatientProfile({ sequelize, models, userId, input, emailSender, baseUrl, now = new Date() }) {
  const { User, AccountToken, NotificationOutbox } = models;
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const phone = String(input.phone || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "PATIENT" || user.status !== "ACTIVE") return { status: "not_found" };
    const emailChanged = email !== String(user.email || "").trim().toLowerCase();
    if (emailChanged) {
      const existing = await User.findOne({
        where: { [Op.or]: [{ email }, { pendingEmail: email }] },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (existing && Number(existing.id) !== Number(user.id)) return { status: "email_in_use" };
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.phone = phone;

    if (!emailChanged) {
      await user.save({ transaction });
      return { status: "saved" };
    }

    await AccountToken.update({ usedAt: now }, {
      where: { userId: user.id, purpose: EMAIL_CHANGE_PURPOSE, usedAt: null },
      transaction
    });
    user.pendingEmail = email;
    await user.save({ transaction });

    const token = randomBytes(32).toString("base64url");
    const accountToken = await AccountToken.create({
      userId: user.id,
      purpose: EMAIL_CHANGE_PURPOSE,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS),
      usedAt: null
    }, { transaction });
    const notification = await NotificationOutbox.create({
      accountTokenId: accountToken.id,
      recipient: email,
      notificationType: EMAIL_CHANGE_PURPOSE,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0
    }, { transaction });

    return {
      status: "verification_pending",
      token,
      notificationId: notification.id,
      recipient: email,
      firstName: user.firstName
    };
  });

  if (result.status !== "verification_pending") return result;
  let delivered = false;
  let attempts = 0;
  if (emailSender) {
    while (attempts < MAX_DELIVERY_ATTEMPTS) {
      attempts += 1;
      try {
        await emailSender.sendEmailChangeVerification({
          to: result.recipient,
          firstName: result.firstName,
          url: emailChangeUrl(result.token, baseUrl),
          expiresInHours: 24
        });
        delivered = true;
        break;
      } catch {
        // Do not expose transport details in the profile flow.
      }
    }
  }

  await NotificationOutbox.update(delivered
    ? { status: "SENT", attempts, sentAt: new Date(), lastError: null }
    : { status: "FAILED", attempts, lastError: emailSender ? "SMTP_DELIVERY_FAILED" : "SMTP_NOT_CONFIGURED" }, {
    where: { id: result.notificationId }
  });

  return { status: "verification_pending", deliveryFailed: !delivered };
}

async function confirmPatientEmailChange({ sequelize, models, token, now = new Date() }) {
  const { User, AccountToken } = models;
  return sequelize.transaction(async (transaction) => {
    const accountToken = await AccountToken.findOne({
      where: { tokenHash: hashToken(String(token || "")), purpose: EMAIL_CHANGE_PURPOSE },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!accountToken) return { status: "invalid" };
    if (accountToken.usedAt) return { status: "used" };
    if (new Date(accountToken.expiresAt).getTime() <= now.getTime()) return { status: "expired" };

    const user = await User.findByPk(accountToken.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "PATIENT" || user.status !== "ACTIVE" || !user.pendingEmail) {
      return { status: "invalid" };
    }
    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailVerifiedAt = now;
    await user.save({ transaction });
    await AccountToken.update({ usedAt: now }, {
      where: { userId: user.id, purpose: EMAIL_CHANGE_PURPOSE, usedAt: null },
      transaction
    });
    return { status: "confirmed" };
  });
}

module.exports = {
  EMAIL_CHANGE_PURPOSE,
  EMAIL_CHANGE_TTL_MS,
  confirmPatientEmailChange,
  emailChangeUrl,
  getPatientProfile,
  hashToken,
  updatePatientProfile
};
