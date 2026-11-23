const { Router } = require("express");
const { createMetaWhatsAppCloudApi } = require("../whatsapp/meta-cloud-api");
const {
  getPatientWhatsAppLink,
  requestPatientWhatsAppVerification,
  unlinkPatientWhatsApp,
  verifyPatientWhatsAppCode
} = require("./services/whatsapp-link");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { validatePatientProfile } = require("./validators/profile");
const { validatePatientPasswordChange } = require("./validators/change-password");
const { changePatientPassword } = require("./services/change-password");
const { confirmPatientEmailChange, getPatientProfile, updatePatientProfile } = require("./services/profile");
const { getPatientDashboard } = require("./services/dashboard");
const { getPatientBookingPage, bookPatientAppointment } = require("./services/appointments");
const { getPatientAppointments } = require("./services/my-appointments");
const { cancelPatientAppointment, getPatientAppointmentCancellation } = require("./services/cancel-appointment");
const { getPatientReschedulePage, reschedulePatientAppointment } = require("./services/reschedule-appointment");

function createPatientRouter({ sequelize = null, models, emailSender = null, whatsappSender = null } = {}) {
  const router = Router();
  const metaWhatsAppSender = whatsappSender || createMetaWhatsAppCloudApi();


  router.get(
    "/whatsapp/vincular",
    requireAuthenticatedUser({ models }), requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const link = await getPatientWhatsAppLink({ models, userId: request.currentUser.id });
      const messages = {
        "codigo-enviado": "Envié un código de seis dígitos al número indicado. Vence en cinco minutos.",
        "whatsapp-vinculado": "Tu número de WhatsApp quedó verificado y vinculado.",
        "codigo-invalido": "El código no coincide. Revisa el mensaje e inténtalo de nuevo.",
        "codigo-vencido": "El código venció. Solicita uno nuevo para continuar.",
        "intentos-agotados": "Agotaste los cinco intentos. Solicita un código nuevo.",
        "numero-en-uso": "Ese número ya está vinculado a otra cuenta.",
        "desvinculado": "Desvinculé tu número de WhatsApp.",
        "consentimiento-requerido": "Acepta el consentimiento e ingresa un número válido con indicativo internacional.",
        "whatsapp-no-configurado": "La verificación por WhatsApp no está configurada en este momento.",
        "envio-fallido": "No pudimos enviar el código. Revisa la configuración e inténtalo más tarde.",
        "desvincular-primero": "Desvincula el número actual antes de registrar otro.",
        "no-encontrado": "No encontramos tu perfil de paciente."
      };
      const statusCode = ["error", "unavailable"].includes(link.status) ? 503
        : link.status === "not_found" ? 404 : 200;
      return response.status(statusCode).render("patient/views/whatsapp-link", {
        title: "Vincular WhatsApp", link: link.status === "ready" ? link : null,
        message: messages[request.query.mensaje] || (link.status === "error" || link.status === "unavailable"
          ? "No fue posible cargar la vinculación de WhatsApp."
          : link.status === "not_found" ? "No encontramos tu perfil de paciente." : null),
        confirmUnlink: false
      });
    }
  );

  router.post(
    "/whatsapp/vincular/codigo",
    requireAuthenticatedUser({ models }), requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await requestPatientWhatsAppVerification({
        sequelize, models, userId: request.currentUser.id,
        phone: request.body?.phone, consent: request.body?.consent === "yes",
        sender: metaWhatsAppSender
      });
      const messages = {
        code_sent: "codigo-enviado", already_linked: "whatsapp-vinculado",
        already_used: "numero-en-uso", unlink_first: "desvincular-primero",
        invalid: "consentimiento-requerido", unavailable: "whatsapp-no-configurado",
        delivery_failed: "envio-fallido", error: "envio-fallido", not_found: "whatsapp-no-configurado"
      };
      return response.redirect(303, "/whatsapp/vincular?mensaje=" + (messages[result.status] || "envio-fallido"));
    }
  );

  router.post(
    "/whatsapp/vincular/confirmar",
    requireAuthenticatedUser({ models }), requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await verifyPatientWhatsAppCode({
        sequelize, models, userId: request.currentUser.id, code: request.body?.code
      });
      const messages = {
        verified: "whatsapp-vinculado", invalid_format: "codigo-invalido",
        invalid_code: "codigo-invalido", expired: "codigo-vencido",
        attempts_exhausted: "intentos-agotados", not_found: "codigo-vencido",
        unavailable: "whatsapp-no-configurado", error: "codigo-invalido"
      };
      return response.redirect(303, "/whatsapp/vincular?mensaje=" + (messages[result.status] || "codigo-invalido"));
    }
  );

  router.get(
    "/whatsapp/vincular/desvincular",
    requireAuthenticatedUser({ models }), requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const link = await getPatientWhatsAppLink({ models, userId: request.currentUser.id });
      return response.status(link.status === "ready" ? 200 : 503).render("patient/views/whatsapp-link", {
        title: "Desvincular WhatsApp", link: link.status === "ready" ? link : null,
        message: link.status === "ready" && !link.linked ? "No tienes un número vinculado." : null,
        confirmUnlink: link.status === "ready" && link.linked
      });
    }
  );

  router.post(
    "/whatsapp/vincular/desvincular",
    requireAuthenticatedUser({ models }), requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await unlinkPatientWhatsApp({ sequelize, models, userId: request.currentUser.id });
      const message = result.status === "unlinked" ? "desvinculado"
        : result.status === "not_linked" ? "codigo-vencido"
          : result.status === "unavailable" || result.status === "error" ? "whatsapp-no-configurado"
            : "whatsapp-no-configurado";
      return response.redirect(303, "/whatsapp/vincular?mensaje=" + message);
    }
  );

  router.get(
    "/citas/reservar",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const page = await getPatientBookingPage({ models, userId: request.currentUser.id, query: request.query || {} });
      const statusCode = ["error", "unavailable"].includes(page.status) ? 503 : 200;
      return response.status(statusCode).render("patient/views/appointment-booking", {
        title: "Reservar cita", page, booking: null, message: request.query.mensaje || (page.status === "slot_unavailable" ? "Ese horario ya no está disponible. Elige uno de los horarios actuales." : null)
      });
    }
  );

  router.post(
    "/citas/reservar/confirmar",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      if (!sequelize || !models) return response.status(503).send("La reserva de citas no está disponible.");
      const query = request.body || {};
      const page = await getPatientBookingPage({ models, userId: request.currentUser.id, query });
      if (!page.selectedSlot) return response.status(409).render("patient/views/appointment-booking", {
        title: "Horario no disponible", page, booking: null,
        message: "El horario cambió o ya no está disponible. Revisa las opciones actuales."
      });
      try {
        const result = await bookPatientAppointment({
          sequelize, models, userId: request.currentUser.id,
          specialtyId: query.specialtyId, doctorId: query.doctorId,
          date: query.date, time: query.time, emailSender
        });
        if (result.status === "booked") return response.status(200).render("patient/views/appointment-booking", {
          title: "Cita confirmada", page, booking: result,
          message: result.notificationStatus === "sent"
            ? "Tu cita quedó confirmada y enviamos el detalle a tu correo."
            : "Tu cita quedó confirmada, pero no pudimos enviar el correo. Puedes consultar los datos aquí."
        });
        const message = result.status === "patient_has_upcoming"
          ? "Ya tienes una cita futura confirmada. Solo puedes reservar una a la vez."
          : result.status === "slot_unavailable"
            ? "Ese horario acaba de ocuparse. Revisa las opciones disponibles."
            : "No pudimos confirmar ese horario. Selecciona nuevamente una opción disponible.";
        const refreshed = await getPatientBookingPage({ models, userId: request.currentUser.id, query });
        return response.status(409).render("patient/views/appointment-booking", {
          title: "No se pudo completar la reserva", page: refreshed, booking: null, message
        });
      } catch {
        return response.status(503).render("patient/views/appointment-booking", {
          title: "Reserva no disponible", page, booking: null,
          message: "No fue posible confirmar la cita en este momento. Inténtalo de nuevo."
        });
      }
    }
  );

  router.get(
    "/citas/:appointmentId/reprogramar",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const page = await getPatientReschedulePage({
        models, userId: request.currentUser.id,
        appointmentId: request.params.appointmentId, query: request.query || {}
      });
      const statusCode = ["invalid", "invalid_date"].includes(page.status) ? 422
        : page.status === "not_found" ? 404
          : ["error", "unavailable"].includes(page.status) ? 503
            : page.status === "slot_unavailable" ? 409 : 200;
      return response.status(statusCode).render("patient/views/appointment-reschedule", {
        title: "Reprogramar cita", page, result: null, message: null
      });
    }
  );

  router.post(
    "/citas/:appointmentId/reprogramar",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await reschedulePatientAppointment({
        sequelize, models, userId: request.currentUser.id,
        appointmentId: request.params.appointmentId,
        date: request.body?.date, time: request.body?.time, emailSender
      });
      if (result.status === "rescheduled") {
        return response.status(200).render("patient/views/appointment-reschedule", {
          title: "Cita reprogramada", page: null, result, message: null
        });
      }
      const page = await getPatientReschedulePage({
        models, userId: request.currentUser.id,
        appointmentId: request.params.appointmentId,
        query: { date: request.body?.date || "" }
      });
      const statusCode = ["invalid", "invalid_date"].includes(result.status) ? 422
        : result.status === "not_found" ? 404
          : result.status === "not_reschedulable" || result.status === "no_change" ? 409
            : ["slot_unavailable", "not_found"].includes(result.status) ? 409 : 503;
      const message = result.status === "slot_unavailable"
        ? "Ese horario acaba de ocuparse. Elige uno de los horarios disponibles."
        : result.status === "no_change"
          ? "Elige un horario distinto al de tu cita actual."
          : result.status === "not_reschedulable"
            ? "La cita cambió o ya está dentro del plazo de 24 horas. No hicimos cambios."
            : "No fue posible reprogramar la cita. Revisa los datos e inténtalo de nuevo.";
      return response.status(statusCode).render("patient/views/appointment-reschedule", {
        title: "Reprogramar cita", page, result, message
      });
    }
  );

  router.get(
    "/citas/:appointmentId/cancelar",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await getPatientAppointmentCancellation({
        models, userId: request.currentUser.id, appointmentId: request.params.appointmentId
      });
      const statusCode = result.status === "invalid" ? 422
        : result.status === "not_found" ? 404
          : ["error", "unavailable"].includes(result.status) ? 503 : 200;
      return response.status(statusCode).render("patient/views/appointment-cancellation", {
        title: "Cancelar cita", result
      });
    }
  );

  router.post(
    "/citas/:appointmentId/cancelar",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await cancelPatientAppointment({
        sequelize, models, userId: request.currentUser.id,
        appointmentId: request.params.appointmentId, emailSender
      });
      const statusCode = result.status === "cancelled" ? 200
        : result.status === "not_cancellable" ? 409
          : result.status === "not_found" ? 404
            : result.status === "invalid" ? 422 : 503;
      return response.status(statusCode).render("patient/views/appointment-cancellation", {
        title: result.status === "cancelled" ? "Cita cancelada" : "Cancelar cita",
        result
      });
    }
  );

  router.get(
    "/historial",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    (request, response) => {
      response.set("Cache-Control", "no-store");
      return response.redirect(303, "/mis-citas?filtro=anteriores");
    }
  );

  router.get(
    "/mis-citas",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await getPatientAppointments({
        models,
        userId: request.currentUser.id,
        filter: request.query.filtro || "proximas"
      });
      const statusCode = result.status === "invalid" ? 422
        : result.status === "not_found" ? 404
          : ["error", "unavailable"].includes(result.status) ? 503 : 200;
      return response.status(statusCode).render("patient/views/my-appointments", {
        title: result.filter === "anteriores" ? "Historial de citas" : "Mis citas",
        result
      });
    }
  );

  router.get(
    "/paciente",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const dashboard = await getPatientDashboard({ models, userId: request.currentUser.id });
      const statusCode = dashboard.status === "error" ? 503 : 200;
      return response.status(statusCode).render("patient/views/dashboard", {
        title: "Mi espacio MediGo",
        dashboard
      });
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

  router.get(
    "/cambiar-contrasena",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    (request, response) => {
      response.set("Cache-Control", "no-store");
      return response.status(200).render("patient/views/change-password", {
        title: "Cambiar contraseña", errors: {}, message: null
      });
    }
  );

  router.post(
    "/cambiar-contrasena",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const { errors, isValid } = validatePatientPasswordChange(request.body || {});
      if (!isValid) return response.status(422).render("patient/views/change-password", {
        title: "Cambiar contraseña", errors, message: null
      });
      if (!sequelize || !models) return response.status(503).render("patient/views/change-password", {
        title: "Cambiar contraseña", errors: {},
        message: "No fue posible cambiar la contraseña en este momento. Inténtalo más tarde."
      });

      try {
        const result = await changePatientPassword({
          sequelize, models, userId: request.currentUser.id,
          currentPassword: request.body.currentPassword,
          newPassword: request.body.newPassword
        });
        if (result.status === "changed") return response.status(200).render("patient/views/change-password", {
          title: "Contraseña actualizada", errors: {},
          message: "Tu contraseña se actualizó correctamente."
        });
        return response.status(400).render("patient/views/change-password", {
          title: "Cambiar contraseña", errors: {},
          message: "No pudimos cambiar la contraseña. Revisa los datos e inténtalo de nuevo."
        });
      } catch {
        return response.status(503).render("patient/views/change-password", {
          title: "Cambiar contraseña", errors: {},
          message: "No fue posible cambiar la contraseña en este momento. Inténtalo más tarde."
        });
      }
    }
  );

  return router;
}

module.exports = { createPatientRouter };
