const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { validatePatientProfile } = require("./validators/profile");
const { confirmPatientEmailChange, getPatientProfile, updatePatientProfile } = require("./services/profile");

function createPatientRouter({ sequelize = null, models, emailSender = null } = {}) {
  const router = Router();

  router.get(
    "/paciente",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    (request, response) => {
      response.set("Cache-Control", "no-store");
      return response.render("patient/views/dashboard", { title: "Mi espacio MediGo" });
    }
  );

  router.get(
    "/perfil",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      try {
        const profile = await getPatientProfile({ models, userId: request.currentUser.id });
        if (!profile) return response.status(404).render("patient/views/profile", {
          title: "Mi perfil", profile: {}, values: {}, errors: {}, message: "No encontramos tu perfil de paciente."
        });
        return response.render("patient/views/profile", {
          title: "Mi perfil", profile, values: profile, errors: {}, message: null
        });
      } catch {
        return response.status(503).send("No fue posible cargar el perfil en este momento.");
      }
    }
  );

  router.post(
    "/perfil",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const { values, errors, isValid } = validatePatientProfile(request.body || {});
      let profile;
      try {
        profile = await getPatientProfile({ models, userId: request.currentUser.id });
      } catch {
        return response.status(503).send("No fue posible cargar el perfil en este momento.");
      }
      if (!profile) return response.status(404).render("patient/views/profile", {
        title: "Mi perfil", profile: {}, values, errors: {}, message: "No encontramos tu perfil de paciente."
      });
      if (!isValid) return response.status(422).render("patient/views/profile", {
        title: "Mi perfil", profile, values, errors, message: "Revisa los campos señalados."
      });
      if (!sequelize) return response.status(503).render("patient/views/profile", {
        title: "Mi perfil", profile, values, errors: {},
        message: "No fue posible guardar los cambios en este momento."
      });

      try {
        const result = await updatePatientProfile({
          sequelize, models, userId: request.currentUser.id, input: values, emailSender,
          baseUrl: process.env.APP_BASE_URL || "http://localhost:3000"
        });
        if (result.status === "email_in_use") return response.status(409).render("patient/views/profile", {
          title: "Mi perfil", profile, values,
          errors: { email: "Este correo ya está asociado a otra cuenta." },
          message: "No pudimos guardar el correo indicado."
        });
        if (result.status === "not_found") return response.status(404).render("patient/views/profile", {
          title: "Mi perfil", profile: {}, values, errors: {},
          message: "No encontramos tu perfil de paciente."
        });

        const updatedProfile = await getPatientProfile({ models, userId: request.currentUser.id });
        const message = result.status === "verification_pending"
          ? result.deliveryFailed
            ? "Guardamos tus otros datos. El correo actual seguirá activo; no pudimos enviar la confirmación al nuevo correo."
            : "Guardamos tus datos. Enviamos un enlace al correo nuevo; seguirá activo el correo actual hasta que lo confirmes."
          : "Tus datos se actualizaron correctamente.";
        return response.status(200).render("patient/views/profile", {
          title: "Mi perfil", profile: updatedProfile, values: updatedProfile, errors: {}, message
        });
      } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") return response.status(409).render("patient/views/profile", {
          title: "Mi perfil", profile, values,
          errors: { email: "Este correo ya está asociado a otra cuenta." },
          message: "No pudimos guardar el correo indicado."
        });
        return response.status(503).render("patient/views/profile", {
          title: "Mi perfil", profile, values, errors: {},
          message: "No fue posible guardar los cambios en este momento."
        });
      }
    }
  );

  router.get("/confirmar-cambio-correo/:token", (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    return response.status(200).render("patient/views/email-change-confirm", {
      title: "Confirmar cambio de correo", token: request.params.token, message: null
    });
  });

  router.post("/confirmar-cambio-correo/:token", async (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    if (!sequelize || !models) return response.status(503).render("patient/views/email-change-confirm", {
      title: "Confirmar cambio de correo", token: request.params.token,
      message: "La confirmación no está disponible en este momento."
    });

    try {
      const result = await confirmPatientEmailChange({ sequelize, models, token: request.params.token });
      if (result.status === "confirmed") return response.status(200).render("patient/views/email-change-result", {
        title: "Correo actualizado",
        message: "Confirmamos tu nuevo correo. Ya puedes seguir usando MediGo."
      });
      const message = result.status === "expired"
        ? "El enlace venció. Inicia sesión y vuelve a solicitar el cambio."
        : "El enlace no es válido o ya fue utilizado.";
      return response.status(400).render("patient/views/email-change-confirm", {
        title: "No se pudo confirmar el correo", token: request.params.token, message
      });
    } catch {
      return response.status(503).render("patient/views/email-change-confirm", {
        title: "Confirmar cambio de correo", token: request.params.token,
        message: "No pudimos confirmar el correo en este momento."
      });
    }
  });

  return router;
}

module.exports = { createPatientRouter };
