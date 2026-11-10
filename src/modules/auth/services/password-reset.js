const { createHash, randomBytes } = require("node:crypto");
const { Op } = require("sequelize");
const { hashPassword } = require("./patient-registration");

const PURPOSE = "PASSWORD_RESET";
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const HOURLY_REQUEST_LIMIT = 5;
const MAX_DELIVERY_ATTEMPTS = 3;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function resetUrl(token, baseUrl) {
  return new URL(`/restablecer-contrasena/${encodeURIComponent(token)}`, baseUrl).toString();
}

async function requestPasswordReset({ sequelize, models, email, emailSender, baseUrl, now = new Date() }) {
  const { User, AccountToken, NotificationOutbox } = models;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const request = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email: normalizedEmail, role: "PATIENT", status: "ACTIVE" },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user || !user.emailVerifiedAt) return { status: "accepted" };

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const requestCount = await AccountToken.count({
      where: { userId: user.id, purpose: PURPOSE, createdAt: { [Op.gte]: hourAgo } },
      transaction
    });
    if (requestCount >= HOURLY_REQUEST_LIMIT) return { status: "accepted" };

    const latestToken = await AccountToken.findOne({
      where: { userId: user.id, purpose: PURPOSE },
      order: [["createdAt", "DESC"]],
      transaction
    });
    if (latestToken && now.getTime() - new Date(latestToken.createdAt).getTime() < RESEND_WAIT_MS) {
      return { status: "accepted" };
    }

    await AccountToken.update({ usedAt: now }, {
      where: { userId: user.id, purpose: PURPOSE, usedAt: null },
      transaction
    });

    const token = randomBytes(32).toString("base64url");
    const accountToken = await AccountToken.create({
      userId: user.id,
      purpose: PURPOSE,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      usedAt: null
    }, { transaction });
    const notification = await NotificationOutbox.create({
      accountTokenId: accountToken.id,
      recipient: user.email,
      notificationType: PURPOSE,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0
    }, { transaction });

    return {
      status: "issued",
      notificationId: notification.id,
      token,
      recipient: user.email,
      firstName: user.firstName
    };
  });

  if (request.status !== "issued") return { status: "accepted" };
  if (!emailSender) {
    await NotificationOutbox.update({ status: "FAILED", lastError: "SMTP_NOT_CONFIGURED" }, {
      where: { id: request.notificationId }
    });
    return { status: "accepted" };
  }

  let attempts = 0;
  let delivered = false;
  while (attempts < MAX_DELIVERY_ATTEMPTS) {
    attempts += 1;
    try {
      await emailSender.sendPasswordResetEmail({
        to: request.recipient,
        firstName: request.firstName,
        url: resetUrl(request.token, baseUrl),
        expiresInMinutes: 30
      });
      delivered = true;
      break;
    } catch {
      // Keep delivery details out of user-facing responses and logs.
    }
  }

  await NotificationOutbox.update(delivered
    ? { status: "SENT", attempts, sentAt: new Date(), lastError: null }
    : { status: "FAILED", attempts, lastError: "SMTP_DELIVERY_FAILED" }, {
    where: { id: request.notificationId }
  });
  return { status: "accepted" };
}

async function resetPatientPassword({ sequelize, models, token, password, now = new Date() }) {
  const { User, AccountToken } = models;
  const tokenHash = hashToken(String(token || ""));

  return sequelize.transaction(async (transaction) => {
    const accountToken = await AccountToken.findOne({
      where: { tokenHash, purpose: PURPOSE },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!accountToken) return { status: "invalid" };
    if (accountToken.usedAt) return { status: "used" };
    if (new Date(accountToken.expiresAt).getTime() <= now.getTime()) return { status: "expired" };

    const user = await User.findByPk(accountToken.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "PATIENT" || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      return { status: "invalid" };
    }

    user.passwordHash = await hashPassword(password);
    await user.save({ transaction });
    await AccountToken.update({ usedAt: now }, {
      where: { userId: user.id, purpose: PURPOSE, usedAt: null },
      transaction
    });
    return { status: "reset" };
  });
}

module.exports = {
  HOURLY_REQUEST_LIMIT,
  PURPOSE,
  RESEND_WAIT_MS,
  TOKEN_TTL_MS,
  hashToken,
  requestPasswordReset,
  resetPatientPassword,
  resetUrl
};
