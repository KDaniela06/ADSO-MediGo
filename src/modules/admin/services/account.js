const { requestAccountEmailChange } = require("../../auth/services/account-email-change");

async function getAdminAccount({ models, userId }) {
  const user = await models.User.findOne({
    where: { id: userId, role: "ADMIN", status: "ACTIVE" },
    attributes: ["id", "documentType", "documentNumber", "firstName", "lastName", "email", "pendingEmail", "phone", "role", "status"]
  });
  if (!user) return null;
  return typeof user.get === "function" ? user.get({ plain: true }) : user;
}

function updateAdminAccount({ sequelize, models, userId, input, emailSender, baseUrl, now = new Date() }) {
  return requestAccountEmailChange({
    sequelize,
    models,
    userId,
    role: "ADMIN",
    email: input.email,
    updates: {
      firstName: String(input.firstName || "").trim(),
      lastName: String(input.lastName || "").trim(),
      phone: String(input.phone || "").trim()
    },
    emailSender,
    baseUrl,
    now
  });
}

module.exports = { getAdminAccount, updateAdminAccount };
