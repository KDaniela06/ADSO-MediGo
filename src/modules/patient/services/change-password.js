const { Op } = require("sequelize");
const { verifyPassword } = require("../../auth/services/authentication");
const { hashPassword } = require("../../auth/services/patient-registration");

async function changePatientPassword({ sequelize, models, userId, currentPassword, newPassword }) {
  return sequelize.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user || user.role !== "PATIENT" || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      return { status: "unavailable" };
    }

    const currentPasswordMatches = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentPasswordMatches) return { status: "current_password_invalid" };

    user.passwordHash = await hashPassword(newPassword);
    await user.save({ transaction });

    if (models.AccountToken) {
      await models.AccountToken.update({ usedAt: new Date() }, {
        where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null },
        transaction
      });
    }
    return { status: "changed" };
  });
}

module.exports = { changePatientPassword };
