const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { validatePasswordChange } = require("../auth/validators/change-password");
const { changeDoctorPassword } = require("./services/change-password");
const { getDoctorDashboard } = require("./services/dashboard");
const { getDoctorAppointment, getDoctorAppointments, APPOINTMENT_STATUSES } = require("./services/appointments");
const { validateAppointmentFilters } = require("./validators/appointments");
const { getDoctorPatient, getDoctorPatients } = require("./services/patients");

function createDoctorRouter({ sequelize = null, models = null } = {}) {
  const router = Router();

  router.get(
    "/medico",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const dashboard = await getDoctorDashboard({ models, userId: request.currentUser.id });
      const statusCode = dashboard.status === "error" ? 503 : 200;
      return response.status(statusCode).render("doctor/views/dashboard", {
        title: "Panel médico",
        dashboard
      });
    }
  );

  router.get(
    "/medico/citas",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const { values, errors, isValid } = validateAppointmentFilters(request.query || {});
      if (!isValid) return response.status(422).render("doctor/views/appointments", {
        title: "Mis citas", status: "invalid", appointments: [], filters: values, errors, appointmentStatuses: APPOINTMENT_STATUSES
      });
      const result = await getDoctorAppointments({
        models, userId: request.currentUser.id, filters: values
      });
      const statusCode = result.status === "error" ? 503 : 200;
      return response.status(statusCode).render("doctor/views/appointments", {
        title: "Mis citas",
        status: result.status,
        appointments: result.appointments,
        filters: result.filters,
        errors: {},
        appointmentStatuses: APPOINTMENT_STATUSES
      });
    }
  );

  router.get(
    "/medico/pacientes",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const search = String(request.query?.q || "").trim().slice(0, 80);
      const result = await getDoctorPatients({ models, userId: request.currentUser.id, search });
      const statusCode = result.status === "error" ? 503 : 200;
      return response.status(statusCode).render("doctor/views/patients", {
        title: "Mis pacientes",
        status: result.status,
        search: result.search,
        patients: result.patients
      });
    }
  );

  router.get(
    "/medico/pacientes/:patientId",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      const result = await getDoctorPatient({
        models, userId: request.currentUser.id, patientId: request.params.patientId
      });
      const statusCode = result.status === "ready" ? 200
        : result.status === "not_found" ? 404 : 503;
      const message = result.status === "not_found"
        ? "No encontramos un paciente asociado a tus citas."
        : result.status === "unavailable" || result.status === "error"
          ? "No fue posible cargar la información en este momento."
          : null;
      return response.status(statusCode).render("doctor/views/patient-detail", {
        title: result.status === "ready" ? "Detalle del paciente" : "Paciente no disponible",
        patient: result.patient || null,
        message
      });
    }
  );

  router.get(
    "/medico/citas/:appointmentId",
    requireAuthenticatedUser({ models }),
    requireRole("DOCTOR"),
    async (request, response) => {
      response.set("Cache-Control", "no-store");
      if (!/^\d+$/.test(String(request.params.appointmentId))) {
        return response.status(404).render("doctor/views/appointment-detail", {
          title: "Cita no encontrada", appointment: null, message: "No encontramos esta cita asignada."
        });
      }
      const result = await getDoctorAppointment({
        models, userId: request.currentUser.id, appointmentId: request.params.appointmentId
      });
      const statusCode = result.status === "ready" ? 200
        : result.status === "not_found" ? 404 : 503;
      const message = result.status === "not_found"
        ? "No encontramos esta cita asignada."
        : result.status === "unavailable" || result.status === "error"
          ? "No fue posible cargar la cita en este momento."
          : null;
      return response.status(statusCode).render("doctor/views/appointment-detail", {
        title: result.status === "ready" ? "Detalle de cita" : "Cita no disponible",
        appointment: result.appointment || null,
        message
      });
    }
  );

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
