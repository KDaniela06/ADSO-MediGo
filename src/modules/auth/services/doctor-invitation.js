const { createHash } = require("node:crypto");
const { hashPassword } = require("./patient-registration");

const PURPOSE = "DOCTOR_INVITATION";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function getDoctorInvitationStatus({ models, token, now = new Date() }) {
  if (!models?.AccountToken) return { status: "unavailable" };
  const accountToken = await models.AccountToken.findOne({
    where: { tokenHash: hashToken(String(token || "")), purpose: PURPOSE }
  });
  if (!accountToken) return { status: "invalid" };
  if (accountToken.usedAt) return { status: "used" };
  if (new Date(accountToken.expiresAt).getTime() <= now.getTime()) return { status: "expired" };
  const user = await models.User.findByPk(accountToken.userId, { attributes: ["id", "firstName", "status", "role"] });
  if (!user || user.role !== "DOCTOR" || user.status !== "PENDING_VERIFICATION") return { status: "invalid" };
  return { status: "ready", firstName: user.firstName };
}

async function configureDoctorAccount({ sequelize, models, token, password, now = new Date() }) {
  if (!sequelize || !models?.AccountToken || !models?.User) return { status: "unavailable" };
  const tokenHash = hashToken(String(token || ""));
  const passwordHash = await hashPassword(password);
  return sequelize.transaction(async (transaction) => {
    const accountToken = await models.AccountToken.findOne({
      where: { tokenHash, purpose: PURPOSE },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!accountToken) return { status: "invalid" };
    if (accountToken.usedAt) return { status: "used" };
    if (new Date(accountToken.expiresAt).getTime() <= now.getTime()) return { status: "expired" };

    const user = await models.User.findByPk(accountToken.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "DOCTOR" || user.status !== "PENDING_VERIFICATION" || user.passwordHash) return { status: "invalid" };

    accountToken.usedAt = now;
    await accountToken.save({ transaction });
    user.passwordHash = passwordHash;
    user.passwordConfiguredAt = now;
    user.emailVerifiedAt = now;
    user.status = "ACTIVE";
    await user.save({ transaction });
    return { status: "configured" };
  });
}

module.exports = { PURPOSE, configureDoctorAccount, getDoctorInvitationStatus, hashToken };
