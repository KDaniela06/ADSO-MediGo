const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { changeAccountPassword } = require("../auth/services/change-account-password");
const { confirmAccountEmailChange } = require("../auth/services/account-email-change");
const { validatePasswordChange } = require("../auth/validators/change-password");
const { getAdminAccount, updateAdminAccount } = require("./services/account");
const { validateAdminAccount } = require("./validators/account");
const { getAdminDashboard } = require("./services/dashboard");

function createAdminRouter({ sequelize = null, models = null, emailSender = null } = {}) {
  const router = Router();
  const requireAdmin = [requireAuthenticatedUser({ models }), requireRole("ADMIN")];

  router.get("/administrador", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const dashboard = await getAdminDashboard({ models });
    const statusCode = dashboard.status === "error" ? 503 : 200;
    return response.status(statusCode).render("admin/views/dashboard", {
      title: "Panel de administración",
      dashboard
    });
  });

  router.get("/administrador/mi-cuenta", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      const account = await getAdminAccount({ models, userId: request.currentUser.id });
      if (!account) return response.status(404).render("admin/views/account", {
        title: "Mi cuenta", account: {}, values: {}, errors: {},
        message: "No encontramos tu cuenta de administrador."
      });
      return response.render("admin/views/account", {
        title: "Mi cuenta", account, values: account, errors: {}, message: null
      });
    } catch {
      return response.status(503).send("No fue posible cargar tu cuenta en este momento.");
    }
  });

  router.post("/administrador/mi-cuenta", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const { values, errors, isValid } = validateAdminAccount(request.body || {});
    let account;
    try {
      account = await getAdminAccount({ models, userId: request.currentUser.id });
    } catch {
      return response.status(503).send("No fue posible cargar tu cuenta en este momento.");
    }
    if (!account) return response.status(404).render("admin/views/account", {
      title: "Mi cuenta", account: {}, values, errors: {},
      message: "No encontramos tu cuenta de administrador."
    });
    if (!isValid) return response.status(422).render("admin/views/account", {
      title: "Mi cuenta", account, values, errors, message: "Revisa los campos señalados."
    });
    if (!sequelize || !models) return response.status(503).render("admin/views/account", {
      title: "Mi cuenta", account, values, errors: {},
      message: "No fue posible guardar los cambios en este momento."
    });

    try {
      const result = await updateAdminAccount({
        sequelize, models, userId: request.currentUser.id, input: values, emailSender,
        baseUrl: process.env.APP_BASE_URL || "http://localhost:3000"
      });
      if (result.status === "email_in_use") return response.status(409).render("admin/views/account", {
        title: "Mi cuenta", account, values,
        errors: { email: "Este correo ya está asociado a otra cuenta." },
        message: "No pudimos guardar el correo indicado."
      });
      if (result.status === "unavailable") return response.status(404).render("admin/views/account", {
        title: "Mi cuenta", account: {}, values, errors: {},
        message: "No encontramos tu cuenta de administrador."
      });

      const updatedAccount = await getAdminAccount({ models, userId: request.currentUser.id });
      const message = result.status === "verification_pending"
        ? result.deliveryFailed
          ? "Guardamos tus otros datos. El correo actual seguirá activo; no pudimos enviar la confirmación al nuevo correo."
          : "Guardamos tus datos. Enviamos un enlace al correo nuevo; tu correo actual seguirá activo hasta que lo confirmes."
        : "Tus datos se actualizaron correctamente.";
      return response.status(200).render("admin/views/account", {
        title: "Mi cuenta", account: updatedAccount, values: updatedAccount, errors: {}, message
      });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return response.status(409).render("admin/views/account", {
        title: "Mi cuenta", account, values,
        errors: { email: "Este correo ya está asociado a otra cuenta." },
        message: "No pudimos guardar el correo indicado."
      });
      return response.status(503).render("admin/views/account", {
        title: "Mi cuenta", account, values, errors: {},
        message: "No fue posible guardar los cambios en este momento."
      });
    }
  });

  router.get("/administrador/cambiar-contrasena", ...requireAdmin, (request, response) => {
    response.set("Cache-Control", "no-store");
    return response.status(200).render("admin/views/change-password", {
      title: "Cambiar contraseña", errors: {}, message: null
    });
  });

  router.post("/administrador/cambiar-contrasena", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const { errors, isValid } = validatePasswordChange(request.body || {});
    if (!isValid) return response.status(422).render("admin/views/change-password", {
      title: "Cambiar contraseña", errors, message: null
    });
    if (!sequelize || !models) return response.status(503).render("admin/views/change-password", {
      title: "Cambiar contraseña", errors: {},
      message: "No fue posible cambiar la contraseña en este momento. Inténtalo más tarde."
    });

    try {
      const result = await changeAccountPassword({
        sequelize, models, userId: request.currentUser.id, role: "ADMIN",
        currentPassword: request.body.currentPassword, newPassword: request.body.newPassword
      });
      if (result.status === "changed") return response.status(200).render("admin/views/change-password", {
        title: "Contraseña actualizada", errors: {},
        message: "Tu contraseña se actualizó correctamente."
      });
      return response.status(400).render("admin/views/change-password", {
        title: "Cambiar contraseña", errors: {},
        message: "No pudimos cambiar la contraseña. Revisa los datos e inténtalo de nuevo."
      });
    } catch {
      return response.status(503).render("admin/views/change-password", {
        title: "Cambiar contraseña", errors: {},
        message: "No fue posible cambiar la contraseña en este momento. Inténtalo más tarde."
      });
    }
  });

  router.get("/administrador/confirmar-cambio-correo/:token", (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    return response.status(200).render("admin/views/email-change-confirm", {
      title: "Confirmar cambio de correo", token: request.params.token, message: null
    });
  });

  router.post("/administrador/confirmar-cambio-correo/:token", async (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    if (!sequelize || !models) return response.status(503).render("admin/views/email-change-confirm", {
      title: "Confirmar cambio de correo", token: request.params.token,
      message: "La confirmación no está disponible en este momento."
    });
    try {
      const result = await confirmAccountEmailChange({
        sequelize, models, token: request.params.token, requiredRole: "ADMIN"
      });
      if (result.status === "confirmed") return response.status(200).render("admin/views/email-change-result", {
        title: "Correo actualizado",
        message: "Confirmamos tu nuevo correo. Ya puedes seguir usando MediGo."
      });
      const message = result.status === "expired"
        ? "El enlace venció. Inicia sesión y vuelve a solicitar el cambio."
        : "El enlace no es válido o ya fue utilizado.";
      return response.status(400).render("admin/views/email-change-confirm", {
        title: "No se pudo confirmar el correo", token: request.params.token, message
      });
    } catch {
      return response.status(503).render("admin/views/email-change-confirm", {
        title: "Confirmar cambio de correo", token: request.params.token,
        message: "No pudimos confirmar el correo en este momento."
      });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
