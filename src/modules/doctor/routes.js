const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { validatePasswordChange } = require("../auth/validators/change-password");
const { changeDoctorPassword } = require("./services/change-password");

function createDoctorRouter({ sequelize = null, models = null } = {}) {
  const router = Router();

  router.get(
    "/medico/cambiar-contrasena",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    (request, response) => {
      response.set("Cache-Control", "no-store");
      return response.status(200).render("doctor/views/change-password", {
        title: "Cambiar contraseña", errors: {}, message: null
      });
    }
  );

  router.post(
    "/medico/cambiar-contrasena",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const { errors, isValid } = validatePasswordChange(request.body || {});
      if (!isValid) return response.status(422).render("doctor/views/change-password", {
        title: "Cambiar contraseña", errors, message: null
      });
      if (!sequelize || !models) return response.status(503).render("doctor/views/change-password", {
        title: "Cambiar contraseña", errors: {},
        message: "No fue posible cambiar la contraseña en este momento. Inténtalo más tarde."
      });

      try {
        const result = await changeDoctorPassword({
          sequelize, models, userId: request.currentUser.id,
          currentPassword: request.body.currentPassword,
          newPassword: request.body.newPassword
        });
        if (result.status === "changed") return response.status(200).render("doctor/views/change-password", {
          title: "Contraseña actualizada", errors: {},
          message: "Tu contraseña se actualizó correctamente."
        });
        return response.status(400).render("doctor/views/change-password", {
          title: "Cambiar contraseña", errors: {},
          message: "No pudimos cambiar la contraseña. Revisa los datos e inténtalo de nuevo."
        });
      } catch {
        return response.status(503).render("doctor/views/change-password", {
          title: "Cambiar contraseña", errors: {},
          message: "No fue posible cambiar la contraseña en este momento. Inténtalo más tarde."
        });
      }
    }
  );

  return router;
}

module.exports = { createDoctorRouter };
