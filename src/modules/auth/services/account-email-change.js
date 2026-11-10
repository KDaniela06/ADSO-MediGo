const { createHash, randomBytes } = require("node:crypto");
const { Op } = require("sequelize");

const EMAIL_CHANGE_PURPOSE = "EMAIL_CHANGE";
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 3;

function hashEmailChangeToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function emailChangeUrl(token, baseUrl) {
  return new URL(`/administrador/confirmar-cambio-correo/${encodeURIComponent(token)}`, baseUrl).toString();
}

async function requestAccountEmailChange({ sequelize, models, userId, role, email, updates = {}, emailSender, baseUrl, now = new Date() }) {
  const { User, AccountToken, NotificationOutbox } = models;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const request = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== role || user.status !== "ACTIVE") return { status: "unavailable" };

    if (normalizedEmail === String(user.email || "").trim().toLowerCase()) {
      Object.assign(user, updates);
      if (user.pendingEmail) {
        await AccountToken.update({ usedAt: now }, {
          where: { userId: user.id, purpose: EMAIL_CHANGE_PURPOSE, usedAt: null },
          transaction
        });
        user.pendingEmail = null;
      }
      await user.save({ transaction });
      return { status: "saved" };
    }

    const existing = await User.findOne({
      where: { [Op.or]: [{ email: normalizedEmail }, { pendingEmail: normalizedEmail }] },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (existing && Number(existing.id) !== Number(user.id)) return { status: "email_in_use" };

    Object.assign(user, updates);
    await AccountToken.update({ usedAt: now }, {
      where: { userId: user.id, purpose: EMAIL_CHANGE_PURPOSE, usedAt: null },
      transaction
    });
    user.pendingEmail = normalizedEmail;
    await user.save({ transaction });

    const token = randomBytes(32).toString("base64url");
    const accountToken = await AccountToken.create({
      userId: user.id,
      purpose: EMAIL_CHANGE_PURPOSE,
      tokenHash: hashEmailChangeToken(token),
      expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS),
      usedAt: null
    }, { transaction });
    const notification = await NotificationOutbox.create({
      accountTokenId: accountToken.id,
      recipient: normalizedEmail,
      notificationType: EMAIL_CHANGE_PURPOSE,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0
    }, { transaction });

    return {
      status: "verification_pending",
      token,
      notificationId: notification.id,
      recipient: normalizedEmail,
      firstName: user.firstName
    };
  });

  if (request.status !== "verification_pending") return request;
  let attempts = 0;
  let delivered = false;
  if (emailSender) {
    while (attempts < MAX_DELIVERY_ATTEMPTS) {
      attempts += 1;
      try {
        await emailSender.sendEmailChangeVerification({
          to: request.recipient,
          firstName: request.firstName,
          url: emailChangeUrl(request.token, baseUrl),
          expiresInHours: 24
        });
        delivered = true;
        break;
      } catch {
        // Keep SMTP details out of the account page.
      }
    }
  }

  await NotificationOutbox.update(delivered
    ? { status: "SENT", attempts, sentAt: new Date(), lastError: null }
    : { status: "FAILED", attempts, lastError: emailSender ? "SMTP_DELIVERY_FAILED" : "SMTP_NOT_CONFIGURED" }, {
    where: { id: request.notificationId }
  });
  return { status: "verification_pending", deliveryFailed: !delivered };
}

async function confirmAccountEmailChange({ sequelize, models, token, requiredRole, now = new Date() }) {
  const { User, AccountToken } = models;
  return sequelize.transaction(async (transaction) => {
    const record = await AccountToken.findOne({
      where: { tokenHash: hashEmailChangeToken(String(token || "")), purpose: EMAIL_CHANGE_PURPOSE },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!record) return { status: "invalid" };
    if (record.usedAt) return { status: "used" };
    if (new Date(record.expiresAt).getTime() <= now.getTime()) return { status: "expired" };

    const user = await User.findByPk(record.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.status !== "ACTIVE" || !user.pendingEmail || (requiredRole && user.role !== requiredRole)) {
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
  EMAIL_CHANGE_TTL_MS,
  confirmAccountEmailChange,
  emailChangeUrl,
  hashEmailChangeToken,
  requestAccountEmailChange
};
