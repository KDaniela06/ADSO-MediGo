const { Router } = require("express");
const { validatePatientRegistration } = require("./validators/patient-registration");
const { registerPatient } = require("./services/patient-registration");
const { authenticateUser } = require("./services/authentication");
const { requestEmailVerification, verifyEmailToken } = require("./services/email-verification");
const { requestPasswordReset, resetPatientPassword } = require("./services/password-reset");

const VERIFICATION_MESSAGES = {
  verified: "Tu correo fue verificado. Tu cuenta ya está activa.",
  already_verified: "Este correo ya había sido verificado.",
  expired: "El enlace venció. Solicita uno nuevo para verificar tu correo.",
  used: "Este enlace ya fue utilizado. Si aún no puedes acceder, solicita otro enlace.",
  invalid: "El enlace no es válido. Solicita uno nuevo para verificar tu correo.",
  inactive: "No se pudo activar esta cuenta. Contacta al equipo de MediGo."
};

function createAuthRouter({ sequelize = null, models = null, emailSender = null } = {}) {
  const router = Router();

  const roleHome = { PATIENT: "/paciente", DOCTOR: "/medico/cambiar-contrasena", ADMIN: "/administrador/mi-cuenta" };

  router.get("/iniciar-sesion", (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.session?.userId) return response.redirect(303, roleHome[request.session.role] || "/");
    return response.status(200).render("auth/views/login", {
      title: "Iniciar sesión",
      email: "",
      loginError: null
    });
  });

  router.post("/iniciar-sesion", async (request, response) => {
    response.set("Cache-Control", "no-store");
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!validEmail || !password) {
      return response.status(401).render("auth/views/login", {
        title: "Iniciar sesión",
        email,
        loginError: "No pudimos iniciar sesión con esos datos. Revisa tu correo y contraseña."
      });
    }
    if (!models) {
      return response.status(503).render("auth/views/login", {
        title: "Iniciar sesión",
        email,
        loginError: "El inicio de sesión no está disponible en este momento."
      });
    }

    try {
      const account = await authenticateUser({ models, email, password });
      if (!account) {
        return response.status(401).render("auth/views/login", {
          title: "Iniciar sesión",
          email,
          loginError: "No pudimos iniciar sesión con esos datos. Revisa tu correo y contraseña."
        });
      }

      await new Promise((resolve, reject) => {
        request.session.regenerate((error) => (error ? reject(error) : resolve()));
      });
      request.session.userId = account.id;
      request.session.role = account.role;
      if (request.body.rememberMe === "on") {
        request.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      await new Promise((resolve, reject) => {
        request.session.save((error) => (error ? reject(error) : resolve()));
      });
      return response.redirect(303, roleHome[account.role] || "/");
    } catch {
      return response.status(503).render("auth/views/login", {
        title: "Iniciar sesión",
        email,
        loginError: "El inicio de sesión no está disponible en este momento."
      });
    }
  });

  router.post("/cerrar-sesion", (request, response) => {
    response.set("Cache-Control", "no-store");
    if (!request.session) return response.redirect(303, "/");

    return request.session.destroy((error) => {
      if (error) {
        return response.status(503).send("No fue posible cerrar la sesión. Inténtalo de nuevo.");
      }
      response.clearCookie("medigo.sid", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
      return response.redirect(303, "/");
    });
  });


  router.get("/recuperar-contrasena", (request, response) => {
    response.set("Cache-Control", "no-store");
    return response.status(200).render("auth/views/password-reset-request", {
      title: "Recuperar contraseña",
      email: "",
      message: null
    });
  });

  router.post("/recuperar-contrasena", async (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const email = String(request.body?.email || "").trim().toLowerCase();
    if (sequelize && models && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      try {
        await requestPasswordReset({
          sequelize,
          models,
          email,
          emailSender,
          baseUrl: process.env.APP_BASE_URL || "http://localhost:3000"
        });
      } catch {
        // Keep unknown accounts, throttling, and delivery failures indistinguishable.
      }
    }
    return response.status(200).render("auth/views/password-reset-request", {
      title: "Solicitud recibida",
      email: "",
      message: "Si el correo corresponde a una cuenta activa, recibirás instrucciones para cambiar la contraseña."
    });
  });

  router.get("/restablecer-contrasena/:token", (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    return response.status(200).render("auth/views/password-reset-form", {
      title: "Crear nueva contraseña",
      token: request.params.token,
      errors: {},
      message: null
    });
  });

  router.post("/restablecer-contrasena/:token", async (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const token = String(request.params.token || "");
    const password = String(request.body?.password || "");
    const passwordConfirmation = String(request.body?.passwordConfirmation || "");
    const errors = {};
    if (password.length < 8) errors.password = "La contraseña debe tener al menos 8 caracteres.";
    if (passwordConfirmation !== password) errors.passwordConfirmation = "Las contraseñas no coinciden.";

    if (Object.keys(errors).length) {
      return response.status(422).render("auth/views/password-reset-form", {
        title: "Crear nueva contraseña",
        token,
        errors,
        message: null
      });
    }
    if (!sequelize || !models) {
      return response.status(503).render("auth/views/password-reset-form", {
        title: "Crear nueva contraseña",
        token,
        errors: {},
        message: "El cambio de contraseña no está disponible en este momento. Inténtalo más tarde."
      });
    }

    try {
      const result = await resetPatientPassword({ sequelize, models, token, password });
      if (result.status === "reset") {
        return response.status(200).render("auth/views/password-reset-result", {
          title: "Contraseña actualizada",
          message: "Tu contraseña se cambió correctamente. Ya puedes iniciar sesión."
        });
      }
      const message = result.status === "expired"
        ? "El enlace venció. Solicita uno nuevo para recuperar tu contraseña."
        : "El enlace no es válido o ya fue utilizado. Solicita uno nuevo para recuperar tu contraseña.";
      return response.status(400).render("auth/views/password-reset-form", {
        title: "No se pudo cambiar la contraseña",
        token,
        errors: {},
        message
      });
    } catch {
      return response.status(503).render("auth/views/password-reset-form", {
        title: "Crear nueva contraseña",
        token,
        errors: {},
        message: "No pudimos cambiar la contraseña en este momento. Inténtalo más tarde."
      });
    }
  });

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

      let deliveryFailed = false;
      try {
        const delivery = await requestEmailVerification({
          sequelize,
          models,
          email: values.email,
          emailSender,
          baseUrl: process.env.APP_BASE_URL || "http://localhost:3000"
        });
        deliveryFailed = delivery.status === "delivery_failed";
      } catch {
        deliveryFailed = true;
      }

      return response.status(201).render("auth/views/email-verification-status", {
        title: "Registro completado",
        status: "pending",
        email: values.email,
        showResend: true,
        deliveryFailed,
        message: "Tu cuenta quedó pendiente de verificación. No podrás iniciar sesión hasta verificar el correo."
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

  router.get("/verificar-correo/:token", async (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    if (!sequelize || !models) {
      return response.status(503).render("auth/views/email-verification-status", {
        title: "Verificación no disponible",
        status: "invalid",
        message: "No pudimos verificar el correo en este momento. Inténtalo más tarde."
      });
    }

    try {
      const result = await verifyEmailToken({ sequelize, models, token: request.params.token });
      return response.status(200).render("auth/views/email-verification-status", {
        title: ["verified", "already_verified"].includes(result.status) ? "Correo verificado" : "No se pudo verificar el correo",
        status: result.status,
        message: VERIFICATION_MESSAGES[result.status] || VERIFICATION_MESSAGES.invalid,
        showResend: !["verified", "already_verified"].includes(result.status)
      });
    } catch {
      return response.status(503).render("auth/views/email-verification-status", {
        title: "Verificación no disponible",
        status: "invalid",
        message: "No pudimos verificar el correo en este momento. Inténtalo más tarde."
      });
    }
  });

  router.post("/verificar-correo/reenviar", async (request, response) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const email = String(request.body.email || "").trim().toLowerCase();
    if (sequelize && models && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      try {
        await requestEmailVerification({
          sequelize,
          models,
          email,
          emailSender,
          baseUrl: process.env.APP_BASE_URL || "http://localhost:3000"
        });
      } catch {
        // Keep the response neutral for unknown, verified, throttled, and delivery-failure cases.
      }
    }

    return response.status(200).render("auth/views/email-verification-status", {
      title: "Solicitud recibida",
      status: "request",
      email,
      showResend: true,
      message: "Si el correo corresponde a una cuenta pendiente, recibirás un enlace si se puede enviar. Espera al menos 60 segundos entre solicitudes; se permiten hasta cinco solicitudes por hora."
    });
  });

  return router;
}

module.exports = { createAuthRouter };

