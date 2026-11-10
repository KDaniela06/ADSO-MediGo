const { Op } = require("sequelize");
const { verifyPassword } = require("./authentication");
const { hashPassword } = require("./patient-registration");

async function changeAccountPassword({ sequelize, models, userId, role, currentPassword, newPassword, now = new Date() }) {
  return sequelize.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user || user.role !== role || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      return { status: "unavailable" };
    }

    if (!await verifyPassword(currentPassword, user.passwordHash)) {
      return { status: "current_password_invalid" };
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save({ transaction });

    if (models.AccountToken) {
      await models.AccountToken.update({ usedAt: now }, {
        where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null },
        transaction
      });
    }
    return { status: "changed" };
  });
}

module.exports = { changeAccountPassword };
