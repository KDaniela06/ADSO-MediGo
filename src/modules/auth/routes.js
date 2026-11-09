const { Router } = require("express");
const { validatePatientRegistration } = require("./validators/patient-registration");
const { registerPatient } = require("./services/patient-registration");

function createAuthRouter({ sequelize = null, models = null } = {}) {
  const router = Router();

  router.get("/registro", (request, response) => {
    response.render("auth/views/patient-registration", {
      title: "Registro de paciente",
      values: {},
      errors: {}
    });
  });

  router.post("/registro", async (request, response) => {
    const { values, errors, isValid } = validatePatientRegistration(request.body);
    if (!isValid) {
      return response.status(422).render("auth/views/patient-registration", {
        title: "Registro de paciente",
        values,
        errors
      });
    }

    if (!sequelize || !models) {
      return response.status(503).render("auth/views/patient-registration", {
        title: "Registro de paciente",
        values: {},
        errors: {},
        formError: "El registro no está disponible en este momento. Inténtalo más tarde."
      });
    }

    try {
      const result = await registerPatient({
        sequelize,
        models,
        input: values,
        termsVersion: process.env.TERMS_VERSION || "v1",
        privacyVersion: process.env.PRIVACY_VERSION || "v1"
      });
      if (!result.ok) {
        const duplicateField = result.reason === "email" ? "email" : "documentNumber";
        const duplicateMessage = result.reason === "email"
          ? "Ya existe una cuenta con este correo electrónico."
          : "Ya existe una cuenta con este tipo y número de documento.";
        return response.status(409).render("auth/views/patient-registration", {
          title: "Registro de paciente",
          values: { ...values, password: "", passwordConfirmation: "" },
          errors: { [duplicateField]: duplicateMessage }
        });
      }
      return response.status(201).render("auth/views/patient-registration", {
        title: "Registro de paciente",
        values: {},
        errors: {},
        successMessage: "Tu cuenta quedó pendiente de verificación. No podrás iniciar sesión hasta verificar el correo."
      });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        const fields = Object.keys(error.fields || {}).join(" ");
        const isEmail = fields.includes("email");
        return response.status(409).render("auth/views/patient-registration", {
          title: "Registro de paciente",
          values: { ...values, password: "", passwordConfirmation: "" },
          errors: {
            [isEmail ? "email" : "documentNumber"]: isEmail
              ? "Ya existe una cuenta con este correo electrónico."
              : "Ya existe una cuenta con este tipo y número de documento."
          }
        });
      }
      return response.status(503).render("auth/views/patient-registration", {
        title: "Registro de paciente",
        values: {},
        errors: {},
        formError: "El registro no está disponible en este momento. Inténtalo más tarde."
      });
    }
  });

  return router;
}

module.exports = { createAuthRouter };

