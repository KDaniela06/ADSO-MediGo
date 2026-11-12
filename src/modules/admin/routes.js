const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { changeAccountPassword } = require("../auth/services/change-account-password");
const { confirmAccountEmailChange } = require("../auth/services/account-email-change");
const { validatePasswordChange } = require("../auth/validators/change-password");
const { getAdminAccount, updateAdminAccount } = require("./services/account");
const { validateAdminAccount } = require("./validators/account");
const { getAdminDashboard } = require("./services/dashboard");
const { changeAdminPatientStatus, getAdminPatient, getAdminPatients, updateAdminPatient } = require("./services/patients");
const { validateAdminPatient } = require("./validators/patient");
const { createDoctorInvitation, getActiveSpecialties } = require("./services/doctors");
const { validateDoctorRegistration } = require("./validators/doctor");
const { getAdminDoctor, getAdminDoctors, getDoctorSpecialties, updateAdminDoctor } = require("./services/manage-doctors");
const { validateAdminDoctor } = require("./validators/manage-doctor");

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


  router.get("/administrador/pacientes", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const patientsResult = await getAdminPatients({
      models, search: request.query.q, status: request.query.estado, page: request.query.pagina
    });
    return response.status(patientsResult.status === "error" ? 503 : 200).render("admin/views/patients", {
      title: "Gestionar pacientes", patientsResult, message: request.query.mensaje || null
    });
  });

  router.get("/administrador/pacientes/:patientId/estado", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const result = await getAdminPatient({ models, patientId: request.params.patientId });
    if (result.status !== "ready") return response.status(result.status === "error" ? 503 : 404).send("No encontramos el paciente solicitado.");
    const newStatus = String(request.query.nuevo || "");
    if (!["ACTIVE", "INACTIVE"].includes(newStatus)) return response.status(400).send("El estado solicitado no es válido.");
    return response.render("admin/views/patient-status-confirmation", {
      title: "Confirmar cambio de estado", patient: result.patient, newStatus, message: null
    });
  });

  router.get("/administrador/pacientes/:patientId", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const result = await getAdminPatient({ models, patientId: request.params.patientId });
    if (result.status !== "ready") return response.status(result.status === "error" ? 503 : 404).send("No encontramos el paciente solicitado.");
    return response.render("admin/views/patient-edit", {
      title: "Datos administrativos del paciente", patient: result.patient,
      values: result.patient, errors: {}, message: null
    });
  });

  router.post("/administrador/pacientes/:patientId", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const patientResult = await getAdminPatient({ models, patientId: request.params.patientId });
    if (patientResult.status !== "ready") return response.status(patientResult.status === "error" ? 503 : 404).send("No encontramos el paciente solicitado.");
    const { values, errors, isValid } = validateAdminPatient(request.body || {});
    if (!isValid) return response.status(422).render("admin/views/patient-edit", {
      title: "Datos administrativos del paciente", patient: patientResult.patient,
      values, errors, message: "Revisa los campos señalados."
    });
    try {
      const result = await updateAdminPatient({ sequelize, models, patientId: request.params.patientId, input: values });
      if (result.status === "saved") return response.redirect(303, "/administrador/pacientes?mensaje=updated");
      return response.status(result.status === "unavailable" ? 503 : 404).send("No fue posible guardar los datos del paciente.");
    } catch {
      return response.status(503).render("admin/views/patient-edit", {
        title: "Datos administrativos del paciente", patient: patientResult.patient,
        values, errors: {}, message: "No fue posible guardar los cambios en este momento."
      });
    }
  });

  router.post("/administrador/pacientes/:patientId/estado", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      const result = await changeAdminPatientStatus({
        sequelize, models, patientId: request.params.patientId, actorUserId: request.currentUser.id,
        newStatus: request.body?.newStatus, confirmed: request.body?.confirmed
      });
      if (result.status === "changed" || result.status === "unchanged") {
        return response.redirect(303, "/administrador/pacientes?mensaje=status-updated");
      }
      if (result.status === "confirmation_required") return response.status(422).send("Confirma el cambio de estado para continuar.");
      if (result.status === "invalid_status") return response.status(400).send("El estado solicitado no es válido.");
      return response.status(result.status === "unavailable" ? 503 : 404).send("No fue posible cambiar el estado de la cuenta.");
    } catch {
      return response.status(503).send("No fue posible cambiar el estado de la cuenta.");
    }
  });

  router.get("/administrador/medicos", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const [result, specialties] = await Promise.all([
      getAdminDoctors({ models, search: request.query.q, status: request.query.estado, specialtyId: request.query.especialidad, page: request.query.pagina }),
      getDoctorSpecialties({ models })
    ]);
    return response.status([result.status, specialties.status].some((status) => ["error", "unavailable"].includes(status)) ? 503 : 200).render("admin/views/doctors", {
      title: "Gestionar médicos", result, specialties: specialties.specialties,
      message: request.query.mensaje || null
    });
  });

  router.get("/administrador/medicos/nuevo", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const result = await getActiveSpecialties({ models });
    return response.status(result.status === "ready" ? 200 : 503).render("admin/views/doctor-registration", {
      title: "Registrar médico", specialties: result.specialties, values: {}, errors: {},
      message: result.status === "ready" ? null : "No pudimos cargar las especialidades activas."
    });
  });

  router.post("/administrador/medicos/nuevo", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const { values, errors, isValid } = validateDoctorRegistration(request.body || {});
    const specialtyResult = await getActiveSpecialties({ models });
    const renderForm = (statusCode, formErrors = errors, message = null) => response.status(statusCode).render("admin/views/doctor-registration", {
      title: "Registrar médico", specialties: specialtyResult.specialties, values, errors: formErrors, message
    });
    if (!isValid) return renderForm(422);
    if (!sequelize || !models) return renderForm(503, {}, "El registro de médicos no está disponible en este momento.");
    try {
      const result = await createDoctorInvitation({
        sequelize, models, input: values, actorUserId: request.currentUser.id, emailSender,
        baseUrl: process.env.APP_BASE_URL || "http://localhost:3000"
      });
      const duplicateMessages = {
        email_in_use: { email: "Ya existe una cuenta con este correo." },
        document_in_use: { documentNumber: "Ya existe una cuenta con este documento." },
        registration_in_use: { professionalRegistration: "Este registro profesional ya está asociado a un médico." },
        specialty_unavailable: { specialtyId: "Selecciona una especialidad activa." }
      };
      if (duplicateMessages[result.status]) return renderForm(409, duplicateMessages[result.status], "No se pudo crear la cuenta con esos datos.");
      if (result.status === "unavailable") return renderForm(503, {}, "El registro de médicos no está disponible en este momento.");
      return response.status(201).render("admin/views/doctor-registration-result", {
        title: "Invitación enviada", deliveryFailed: result.deliveryFailed,
        message: result.deliveryFailed
          ? "Creamos la cuenta, pero no pudimos enviar la invitación. Revisa el correo y solicita un nuevo envío cuando el servicio esté disponible."
          : "Creamos la cuenta y enviamos al médico un enlace para configurar su contraseña. El enlace vence en 24 horas."
      });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        const fields = Object.keys(error.fields || {}).join(" ");
        const field = fields.includes("professional_registration") ? "professionalRegistration" : (fields.includes("document") ? "documentNumber" : "email");
        const message = field === "professionalRegistration"
          ? "Este registro profesional ya está asociado a un médico."
          : field === "documentNumber" ? "Ya existe una cuenta con este documento." : "Ya existe una cuenta con este correo.";
        return renderForm(409, { [field]: message }, "No se pudo crear la cuenta con esos datos.");
      }
      return renderForm(503, {}, "No fue posible crear la cuenta. Inténtalo de nuevo más tarde.");
    }
  });

  router.get("/administrador/medicos/:doctorId/editar", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const [result, specialties] = await Promise.all([
      getAdminDoctor({ models, doctorId: request.params.doctorId }),
      getDoctorSpecialties({ models })
    ]);
    if (result.status !== "ready") return response.status(result.status === "error" ? 503 : 404).send("No encontramos el médico solicitado.");
    return response.status(specialties.status === "ready" ? 200 : 503).render("admin/views/doctor-edit", {
      title: "Actualizar médico", doctor: result.doctor, values: result.doctor, errors: {},
      specialties: specialties.specialties, message: specialties.status === "ready" ? null : "No pudimos cargar las especialidades."
    });
  });

  router.get("/administrador/medicos/:doctorId", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const result = await getAdminDoctor({ models, doctorId: request.params.doctorId });
    if (result.status !== "ready") return response.status(result.status === "error" ? 503 : 404).send("No encontramos el médico solicitado.");
    return response.render("admin/views/doctor-detail", { title: "Detalle del médico", doctor: result.doctor, message: request.query.mensaje || null });
  });

  router.post("/administrador/medicos/:doctorId/editar", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const { values, errors, isValid } = validateAdminDoctor(request.body || {});
    const [doctorResult, specialtyResult] = await Promise.all([
      getAdminDoctor({ models, doctorId: request.params.doctorId }),
      getDoctorSpecialties({ models })
    ]);
    if (doctorResult.status !== "ready") return response.status(doctorResult.status === "error" ? 503 : 404).send("No encontramos el médico solicitado.");
    if (specialtyResult.status !== "ready") return response.status(503).send("No pudimos cargar las especialidades para actualizar el médico.");
    const doctor = doctorResult.doctor;
    const renderForm = (statusCode, formErrors = errors, message = null) => response.status(statusCode).render("admin/views/doctor-edit", {
      title: "Actualizar médico", doctor, values, errors: formErrors,
      specialties: specialtyResult.specialties, message
    });
    if (!isValid) return renderForm(422);
    if (!sequelize || !models) return renderForm(503, {}, "La actualización de médicos no está disponible en este momento.");
    if (request.body?.confirmed !== "YES" && String(values.specialtyId) !== String(doctor.specialtyId)) {
      return response.status(200).render("admin/views/doctor-specialty-confirmation", {
        title: "Confirmar especialidad", doctor, values, specialtyName: specialtyResult.specialties.find((item) => String(item.id) === String(values.specialtyId))?.name || ""
      });
    }
    try {
      const result = await updateAdminDoctor({
        sequelize, models, doctorId: request.params.doctorId, actorUserId: request.currentUser.id,
        input: values, confirmed: request.body?.confirmed === "YES"
      });
      if (result.status === "saved" || result.status === "unchanged") return response.redirect(303, "/administrador/medicos/" + request.params.doctorId + "?mensaje=updated");
      if (result.status === "registration_in_use") return renderForm(409, { professionalRegistration: "Este registro profesional ya está asociado a otro médico." }, "No pudimos guardar los cambios.");
      if (result.status === "specialty_unavailable") return renderForm(409, { specialtyId: "Selecciona una especialidad activa." }, "La especialidad dejó de estar disponible.");
      if (result.status === "confirmation_required") return renderForm(422, {}, "Confirma el cambio de especialidad para continuar.");
      if (result.status === "unavailable") return renderForm(503, {}, "La actualización de médicos no está disponible en este momento.");
      return renderForm(404, {}, "No encontramos el médico solicitado.");
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return renderForm(409, { professionalRegistration: "Este registro profesional ya está asociado a otro médico." }, "No pudimos guardar los cambios.");
      return renderForm(503, {}, "No fue posible guardar los cambios en este momento.");
    }
  });

  return router;
}

module.exports = { createAdminRouter };
