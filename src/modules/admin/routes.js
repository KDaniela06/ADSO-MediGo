const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { changeAccountPassword } = require("../auth/services/change-account-password");
const { confirmAccountEmailChange } = require("../auth/services/account-email-change");
const { validatePasswordChange } = require("../auth/validators/change-password");
const { getAdminAccount, updateAdminAccount } = require("./services/account");
const { validateAdminAccount } = require("./validators/account");
const { getAdminDashboard } = require("./services/dashboard");
const { getAdminPatient, getAdminPatients, updateAdminPatient } = require("./services/patients");
const { changeAdminAccountStatus, getAccountStatusPreview } = require("./services/account-status");
const { validateAdminPatient } = require("./validators/patient");
const { createDoctorInvitation, getActiveSpecialties } = require("./services/doctors");
const { validateDoctorRegistration } = require("./validators/doctor");
const { getAdminDoctor, getAdminDoctors, getDoctorSpecialties, updateAdminDoctor } = require("./services/manage-doctors");
const { validateAdminDoctor } = require("./validators/manage-doctor");
const {
  changeAdminSpecialtyStatus, createAdminSpecialty, getAdminSpecialties,
  getAdminSpecialty, updateAdminSpecialty
} = require("./services/specialties");
const { validateSpecialty } = require("./validators/specialty");
const { getAdminSchedulePage, previewDoctorScheduleChanges, saveDoctorWeeklySchedule } = require("./services/weekly-schedules");
const { WEEKDAY_NAMES, validateWeeklySchedule } = require("./validators/weekly-schedule");
const WEEKDAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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
      title: "Gestionar pacientes", patientsResult, message: request.query.mensaje || null,
      notificacionesFallidas: Number(request.query["notificaciones-fallidas"]) || 0
    });
  });

  router.get("/administrador/pacientes/:patientId/estado", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const newStatus = String(request.query.nuevo || "");
    if (!["ACTIVE", "INACTIVE"].includes(newStatus)) return response.status(400).send("El estado solicitado no es válido.");
    const result = await getAccountStatusPreview({ models, role: "PATIENT", accountId: request.params.patientId });
    if (result.status !== "ready") return response.status(result.status === "not_found" ? 404 : 503).send("No encontramos la cuenta solicitada.");
    return response.render("admin/views/account-status-confirmation", {
      title: "Confirmar cambio de estado", ...result, newStatus,
      action: "/administrador/pacientes/" + result.account.id + "/estado"
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
      const result = await changeAdminAccountStatus({
        sequelize, models, role: "PATIENT", accountId: request.params.patientId,
        actorUserId: request.currentUser.id, newStatus: request.body?.newStatus,
        confirmed: request.body?.confirmed, emailSender
      });
      if (result.status === "changed" || result.status === "unchanged") {
        const delivery = result.notificationFailures ? "&notificaciones-fallidas=" + result.notificationFailures : "";
        return response.redirect(303, "/administrador/pacientes?mensaje=status-updated" + delivery);
      }
      if (result.status === "confirmation_required") return response.status(422).send("Confirma el cambio de estado para continuar.");
      if (result.status === "invalid_status") return response.status(400).send("El estado solicitado no es válido.");
      return response.status(result.status === "unavailable" ? 503 : 404).send("No fue posible cambiar el estado de la cuenta.");
    } catch {
      return response.status(503).send("No fue posible cambiar el estado de la cuenta.");
    }
  });

  router.get("/administrador/medicos/:doctorId/estado", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const newStatus = String(request.query.nuevo || "");
    if (!["ACTIVE", "INACTIVE"].includes(newStatus)) return response.status(400).send("El estado solicitado no es válido.");
    const result = await getAccountStatusPreview({ models, role: "DOCTOR", accountId: request.params.doctorId });
    if (result.status !== "ready") return response.status(result.status === "error" ? 503 : 404).send("No encontramos la cuenta solicitada.");
    return response.render("admin/views/account-status-confirmation", {
      title: "Confirmar cambio de estado", ...result, newStatus,
      action: "/administrador/medicos/" + result.account.id + "/estado"
    });
  });

  router.post("/administrador/medicos/:doctorId/estado", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      const result = await changeAdminAccountStatus({
        sequelize, models, role: "DOCTOR", accountId: request.params.doctorId,
        actorUserId: request.currentUser.id, newStatus: request.body?.newStatus,
        confirmed: request.body?.confirmed, emailSender
      });
      if (result.status === "changed" || result.status === "unchanged") {
        const delivery = result.notificationFailures ? "&notificaciones-fallidas=" + result.notificationFailures : "";
        return response.redirect(303, "/administrador/medicos?mensaje=status-updated" + delivery);
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
      message: request.query.mensaje || null,
      notificacionesFallidas: Number(request.query["notificaciones-fallidas"]) || 0
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


  router.get("/administrador/especialidades", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const result = await getAdminSpecialties({
      models, search: request.query.q, status: request.query.estado, page: request.query.pagina
    });
    return response.status(result.status === "error" ? 503 : 200).render("admin/views/specialties", {
      title: "Gestionar especialidades", result, message: request.query.mensaje || null
    });
  });

  router.get("/administrador/especialidades/nueva", ...requireAdmin, (request, response) => {
    response.set("Cache-Control", "no-store");
    return response.render("admin/views/specialty-form", {
      title: "Agregar especialidad", specialty: null, values: {}, errors: {}, message: null
    });
  });

  router.post("/administrador/especialidades/nueva", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const { values, errors, isValid } = validateSpecialty(request.body || {});
    const renderForm = (statusCode, formErrors = errors, message = null) => response.status(statusCode).render("admin/views/specialty-form", {
      title: "Agregar especialidad", specialty: null, values, errors: formErrors, message
    });
    if (!isValid) return renderForm(422);
    if (!sequelize || !models) return renderForm(503, {}, "No pudimos crear la especialidad en este momento.");
    try {
      const result = await createAdminSpecialty({
        sequelize, models, actorUserId: request.currentUser.id, input: values
      });
      if (result.status === "name_in_use") return renderForm(409, { name: "Ya existe una especialidad con este nombre." }, "Revisa el nombre ingresado.");
      if (result.status === "unavailable") return renderForm(503, {}, "La gestión de especialidades no está disponible.");
      return response.redirect(303, "/administrador/especialidades?mensaje=created");
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return renderForm(409, { name: "Ya existe una especialidad con este nombre." }, "Revisa el nombre ingresado.");
      return renderForm(503, {}, "No fue posible crear la especialidad. Inténtalo de nuevo.");
    }
  });

  router.get("/administrador/especialidades/:specialtyId/editar", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const result = await getAdminSpecialty({ models, specialtyId: request.params.specialtyId });
    if (result.status !== "ready") return response.status(result.status === "error" ? 503 : 404).send("No encontramos la especialidad solicitada.");
    return response.render("admin/views/specialty-form", {
      title: "Editar especialidad", specialty: result.specialty, values: result.specialty, errors: {}, message: null
    });
  });

  router.post("/administrador/especialidades/:specialtyId/editar", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const { values, errors, isValid } = validateSpecialty(request.body || {});
    const specialtyResult = await getAdminSpecialty({ models, specialtyId: request.params.specialtyId });
    if (specialtyResult.status !== "ready") return response.status(specialtyResult.status === "error" ? 503 : 404).send("No encontramos la especialidad solicitada.");
    const specialty = specialtyResult.specialty;
    const renderForm = (statusCode, formErrors = errors, message = null) => response.status(statusCode).render("admin/views/specialty-form", {
      title: "Editar especialidad", specialty, values, errors: formErrors, message
    });
    if (!isValid) return renderForm(422);
    if (!sequelize || !models) return renderForm(503, {}, "No pudimos actualizar la especialidad en este momento.");
    try {
      const result = await updateAdminSpecialty({
        sequelize, models, specialtyId: request.params.specialtyId,
        actorUserId: request.currentUser.id, input: values
      });
      if (result.status === "name_in_use") return renderForm(409, { name: "Ya existe una especialidad con este nombre." }, "Revisa el nombre ingresado.");
      if (result.status === "unavailable") return renderForm(503, {}, "La gestión de especialidades no está disponible.");
      if (result.status === "not_found") return response.status(404).send("No encontramos la especialidad solicitada.");
      return response.redirect(303, "/administrador/especialidades?mensaje=updated");
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") return renderForm(409, { name: "Ya existe una especialidad con este nombre." }, "Revisa el nombre ingresado.");
      return renderForm(503, {}, "No fue posible actualizar la especialidad. Inténtalo de nuevo.");
    }
  });

  router.post("/administrador/especialidades/:specialtyId/estado", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (!sequelize || !models) return response.status(503).send("La gestión de especialidades no está disponible.");
    try {
      const result = await changeAdminSpecialtyStatus({
        sequelize, models, specialtyId: request.params.specialtyId,
        actorUserId: request.currentUser.id, status: String(request.body?.status || "")
      });
      if (result.status === "not_found") return response.status(404).send("No encontramos la especialidad solicitada.");
      if (result.status === "invalid_status") return response.status(400).send("El estado solicitado no es válido.");
      if (result.status === "unavailable") return response.status(503).send("La gestión de especialidades no está disponible.");
      return response.redirect(303, "/administrador/especialidades?mensaje=status-updated");
    } catch {
      return response.status(503).send("No fue posible actualizar el estado de la especialidad.");
    }
  });


  router.get("/administrador/horarios", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const page = await getAdminSchedulePage({ models, doctorId: request.query.doctorId });
    const statusCode = ["error", "unavailable"].includes(page.status) ? 503 : 200;
    return response.status(statusCode).render("admin/views/weekly-schedules", {
      title: "Configurar horarios médicos", page,
      values: { blocks: page.blocks.length ? page.blocks : [{ weekday: "", startsAt: "", endsAt: "" }] },
      errors: {}, weekdayNames: WEEKDAYS,
      message: request.query.mensaje || null,
      cancelled: Number(request.query.canceladas) || 0,
      failedNotifications: Number(request.query["notificaciones-fallidas"]) || 0
    });
  });

  router.post("/administrador/horarios/:doctorId/vista-previa", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const page = await getAdminSchedulePage({ models, doctorId: request.params.doctorId });
    if (!page.selectedDoctor) return response.status(page.status === "error" ? 503 : 404).send("No encontramos el médico solicitado.");
    const { values, errors, isValid } = validateWeeklySchedule(request.body || {});
    if (!isValid) return response.status(422).render("admin/views/weekly-schedules", {
      title: "Configurar horarios médicos", page, values, errors, weekdayNames: WEEKDAYS,
      message: null, cancelled: 0, failedNotifications: 0
    });
    const preview = await previewDoctorScheduleChanges({
      models, doctorId: request.params.doctorId, blocks: values.blocks
    });
    if (preview.status !== "ready") return response.status(preview.status === "error" ? 503 : 404).send("No pudimos revisar las citas del médico.");
    return response.render("admin/views/weekly-schedule-confirmation", {
      title: "Confirmar cambio de horario", doctor: page.selectedDoctor,
      blocks: values.blocks, appointments: preview.appointments,
      previewChanged: false, weekdayNames: WEEKDAYS
    });
  });

  router.post("/administrador/horarios/:doctorId/guardar", ...requireAdmin, async (request, response) => {
    response.set("Cache-Control", "no-store");
    const page = await getAdminSchedulePage({ models, doctorId: request.params.doctorId });
    if (!page.selectedDoctor) return response.status(page.status === "error" ? 503 : 404).send("No encontramos el médico solicitado.");
    const { values, errors, isValid } = validateWeeklySchedule(request.body || {});
    if (!isValid) return response.status(422).render("admin/views/weekly-schedules", {
      title: "Configurar horarios médicos", page, values, errors, weekdayNames: WEEKDAYS,
      message: null, cancelled: 0, failedNotifications: 0
    });
    if (!sequelize || !models) return response.status(503).send("La gestión de horarios no está disponible.");
    try {
      const result = await saveDoctorWeeklySchedule({
        sequelize, models, doctorId: request.params.doctorId,
        actorUserId: request.currentUser.id, blocks: values.blocks,
        confirmed: request.body?.confirmed,
        confirmedAppointmentIds: request.body?.confirmedAppointmentIds,
        emailSender
      });
      if (result.status === "not_found") return response.status(404).send("No encontramos el médico solicitado.");
      if (result.status === "unavailable") return response.status(503).send("La gestión de horarios no está disponible.");
      if (result.status === "confirmation_required" || result.status === "preview_changed") {
        return response.status(200).render("admin/views/weekly-schedule-confirmation", {
          title: "Confirmar cambio de horario", doctor: page.selectedDoctor,
          blocks: values.blocks, appointments: result.appointments,
          previewChanged: result.status === "preview_changed", weekdayNames: WEEKDAYS
        });
      }
      return response.redirect(303, "/administrador/horarios?doctorId=" + encodeURIComponent(request.params.doctorId)
        + "&mensaje=saved&canceladas=" + Number(result.cancelled || 0)
        + "&notificaciones-fallidas=" + Number(result.failedNotifications || 0));
    } catch {
      return response.status(503).send("No fue posible guardar el horario en este momento.");
    }
  });

  return router;
}

module.exports = { createAdminRouter };
