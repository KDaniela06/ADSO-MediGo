const { Op } = require("sequelize");
const { requestAccountEmailChange } = require("../../auth/services/account-email-change");

async function getAdminAccount({ models, userId }) {
  const user = await models.User.findOne({
    where: { id: userId, role: "ADMIN", status: "ACTIVE" },
    attributes: ["id", "documentType", "documentNumber", "firstName", "lastName", "email", "pendingEmail", "phone", "role", "status"]
  });
  if (!user) return null;
  return typeof user.get === "function" ? user.get({ plain: true }) : user;
}

async function updateAdminAccount({ sequelize, models, userId, input, emailSender, baseUrl, now = new Date() }) {
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const phone = String(input.phone || "").trim();
  const email = String(input.email || "").trim().toLowerCase();

  return sequelize.transaction(async (transaction) => {
    const user = await models.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") return { status: "unavailable" };

    const emailChanged = email !== String(user.email || "").trim().toLowerCase();
    if (emailChanged) {
      const existing = await models.User.findOne({
        where: { [Op.or]: [{ email }, { pendingEmail: email }] },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (existing && Number(existing.id) !== Number(user.id)) return { status: "email_in_use" };
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.phone = phone;
    await user.save({ transaction });

    if (!emailChanged) return { status: "saved" };

    const emailRequest = await requestAccountEmailChange({
      sequelize: { transaction: (callback) => callback(transaction) },
      models,
      userId,
      role: "ADMIN",
      email,
      emailSender,
      baseUrl,
      now
    });
    return emailRequest;
  });
}

module.exports = { getAdminAccount, updateAdminAccount };
