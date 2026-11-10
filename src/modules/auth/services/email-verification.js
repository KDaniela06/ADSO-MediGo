const { createHash, randomBytes } = require("node:crypto");
const { Op } = require("sequelize");

const PURPOSE = "EMAIL_VERIFICATION";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const HOURLY_REQUEST_LIMIT = 5;
const MAX_DELIVERY_ATTEMPTS = 3;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function verificationUrl(token, baseUrl) {
  return new URL(`/verificar-correo/${encodeURIComponent(token)}`, baseUrl).toString();
}

async function requestEmailVerification({ sequelize, models, email, emailSender, baseUrl, now = new Date() }) {
  const { User, AccountToken, NotificationOutbox } = models;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const request = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email: normalizedEmail },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user || user.emailVerifiedAt || user.status !== "PENDING_VERIFICATION") {
      return { status: "accepted" };
    }

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
    await NotificationOutbox.update({ status: "FAILED", lastError: "SMTP_NOT_CONFIGURED" }, { where: { id: request.notificationId } });
    return { status: "delivery_failed" };
  }

  let attempts = 0;
  let delivered = false;
  while (attempts < MAX_DELIVERY_ATTEMPTS) {
    attempts += 1;
    try {
      await emailSender.sendVerificationEmail({
        to: request.recipient,
        firstName: request.firstName,
        url: verificationUrl(request.token, baseUrl),
        expiresInHours: 24
      });
      delivered = true;
      break;
    } catch {
      // Retry the same outbox item and token; do not log message or transport details.
    }
  }

  if (delivered) {
    await NotificationOutbox.update({ status: "SENT", attempts, sentAt: new Date(), lastError: null }, {
      where: { id: request.notificationId }
    });
    return { status: "sent" };
  }

  await NotificationOutbox.update({ status: "FAILED", attempts, lastError: "SMTP_DELIVERY_FAILED" }, {
    where: { id: request.notificationId }
  });
  // The token row remains so failed delivery still consumes the resend quota.
  return { status: "delivery_failed" };
}

async function verifyEmailToken({ sequelize, models, token, now = new Date() }) {
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
    if (!user) return { status: "invalid" };

    accountToken.usedAt = now;
    await accountToken.save({ transaction });

    if (user.emailVerifiedAt) return { status: "already_verified" };
    if (user.status !== "PENDING_VERIFICATION") return { status: "inactive" };

    user.emailVerifiedAt = now;
    user.status = "ACTIVE";
    await user.save({ transaction });
    return { status: "verified" };
  });
}

module.exports = {
  HOURLY_REQUEST_LIMIT,
  MAX_DELIVERY_ATTEMPTS,
  PURPOSE,
  RESEND_WAIT_MS,
  TOKEN_TTL_MS,
  hashToken,
  requestEmailVerification,
  verificationUrl,
  verifyEmailToken
};

