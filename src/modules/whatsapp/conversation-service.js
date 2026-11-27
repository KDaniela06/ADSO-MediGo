const { Op } = require("sequelize");
const { getPatientBookingPage, bookPatientAppointment } = require("../patient/services/appointments");
const { getPatientAppointments } = require("../patient/services/my-appointments");
const { cancelPatientAppointment } = require("../patient/services/cancel-appointment");
const { getPatientReschedulePage, reschedulePatientAppointment } = require("../patient/services/reschedule-appointment");
const { requestWhatsAppAppointmentReminder } = require("./services/appointment-reminders");

const SESSION_MS = 15 * 60 * 1000;
const MENU = "Responde con el número de la opción:\n1. Reservar cita\n2. Consultar mis citas\n3. Cancelar una cita\n4. Reprogramar una cita\n\nEscribe *menu* para ver estas opciones.";

function plain(value) { return value && typeof value.get === "function" ? value.get({ plain: true }) : value; }
function formatAppointment(item, index) { return `${index + 1}. ${item.specialtyName} con ${item.doctorName}: ${item.date}, ${item.time}`; }
function selectFrom(text, records) {
  const index = Number(String(text).trim()) - 1;
  return Number.isInteger(index) && index >= 0 && index < records.length ? records[index] : null;
}
function listText(label, records) { return records.map((record, index) => `${index + 1}. ${label(record)}`).join("\n"); }
function getPhone(value) { const digits = String(value || "").replace(/\D/g, ""); return digits ? `+${digits}` : null; }

async function findLinkedPatient(models, phone) {
  if (!models?.Patient?.findOne || !models?.User) return null;
  const patient = plain(await models.Patient.findOne({
    where: { whatsappPhone: phone, whatsappVerifiedAt: { [Op.ne]: null } },
    include: [{ model: models.User, as: "user", attributes: ["id", "firstName", "documentType", "documentNumber", "role", "status", "emailVerifiedAt"], required: true }]
  }));
  const user = plain(patient?.user);
  return user?.role === "PATIENT" && user.status === "ACTIVE" && user.emailVerifiedAt
    ? { patient, user } : null;
}

function menuAppointments(result) {
  if (result.status !== "ready") return "No pude consultar tus citas en este momento. Inténtalo de nuevo más tarde.";
  if (!result.appointments.length) return "No tienes citas próximas.\n\n" + MENU;
  return "Estas son tus citas próximas:\n" + result.appointments.map(formatAppointment).join("\n") + "\n\n" + MENU;
}

async function processMenuChoice({ text, userId, models, sequelize, emailSender, now }) {
  const choice = String(text).trim();
  if (choice === "1") {
    const page = await getPatientBookingPage({ models, userId, now });
    if (page.status !== "ready" || !page.specialties?.length) return { state: "MENU", contextJson: null, reply: "No hay especialidades disponibles para reservar ahora.\n\n" + MENU };
    if (page.patientHasUpcoming) return { state: "MENU", contextJson: null, reply: "Ya tienes una cita próxima confirmada. Puedes consultar, cancelar o reprogramar desde este chat.\n\n" + MENU };
    return { state: "BOOK_SPECIALTY", contextJson: { choices: page.specialties.map((item) => String(item.id)) }, reply: "Elige una especialidad:\n" + listText((item) => item.name, page.specialties) };
  }
  if (choice === "2") {
    return { state: "MENU", contextJson: null, reply: menuAppointments(await getPatientAppointments({ models, userId, filter: "proximas", now })) };
  }
  if (choice === "5") {\n    const result = await getPatientAppointments({ models, userId, filter: "proximas", now });\n    if (result.status !== "ready") return { state: "MENU", contextJson: null, reply: "No pude consultar tus citas. Inténtalo más tarde.\\n\\n" + MENU };\n    const upcoming = result.appointments.filter((item) => item.status === "CONFIRMED");\n    if (!upcoming.length) return { state: "MENU", contextJson: null, reply: "No tienes citas confirmadas para recordar.\\n\\n" + MENU };\n    return { state: "REMINDER_SELECT", contextJson: { appointmentIds: upcoming.map((item) => String(item.id)) }, reply: "¿De cuál cita quieres recibir un recordatorio 24 horas antes?\\n" + upcoming.map(formatAppointment).join("\\n") };\n  }\n  if (choice === "3" || choice === "4") {
    const result = await getPatientAppointments({ models, userId, filter: "proximas", now });
    if (result.status !== "ready") return { state: "MENU", contextJson: null, reply: "No pude consultar tus citas en este momento.\n\n" + MENU };
    const selectable = result.appointments.filter((item) => choice === "3" ? item.canCancel : item.canReschedule);
    if (!selectable.length) return { state: "MENU", contextJson: null, reply: "No tienes citas que se puedan " + (choice === "3" ? "cancelar" : "reprogramar") + " ahora.\n\n" + MENU };
    return {
      state: choice === "3" ? "CANCEL_SELECT" : "RESCHEDULE_SELECT",
      contextJson: { appointmentIds: selectable.map((item) => String(item.id)) },
      reply: "Elige la cita:\n" + selectable.map(formatAppointment).join("\n")
    };
  }
  return { state: "MENU", contextJson: null, reply: "No reconocí esa opción.\n\n" + MENU };
}

async function advanceConversation({ text, conversation, linked, models, sequelize, emailSender, now }) {
  const value = String(text || "").trim();
  const state = conversation?.state || "VERIFY_DOCUMENT";
  const context = conversation?.contextJson && typeof conversation.contextJson === "object" ? conversation.contextJson : {};
  if (/^(menu|inicio|hola)$/i.test(value) && state === "MENU") return { state: "MENU", contextJson: null, reply: MENU };
  if (state === "VERIFY_DOCUMENT") {
    const supplied = value.replace(/[\s.-]/g, "").toUpperCase();
    const expected = String(linked.user.documentNumber || "").replace(/[\s.-]/g, "").toUpperCase();
    if (!supplied || supplied !== expected) return { state, contextJson: null, reply: "No pude validar el documento. Inténtalo de nuevo. No guardamos el documento enviado por el chat." };
    return { state: "MENU", contextJson: null, reply: `Identidad verificada, ${linked.user.firstName || ""}.\n\n${MENU}` };
  }
  if (state === "MENU") return processMenuChoice({ text: value, userId: linked.user.id, models, sequelize, emailSender, now });
  if (state === "BOOK_SPECIALTY") {
    const id = selectFrom(value, context.choices || []);
    if (!id) return { state, contextJson: context, reply: "Elige un número de la lista de especialidades." };
    const page = await getPatientBookingPage({ models, userId: linked.user.id, query: { specialtyId: id }, now });
    if (page.status !== "ready" || !page.doctors?.length) return { state: "MENU", contextJson: null, reply: "No hay médicos disponibles para esa especialidad.\n\n" + MENU };
    return { state: "BOOK_DOCTOR", contextJson: { specialtyId: id, choices: page.doctors.map((doctor) => String(doctor.id)) }, reply: "Elige un médico:\n" + listText((doctor) => doctor.name, page.doctors) };
  }
  if (state === "BOOK_DOCTOR") {
    const doctorId = selectFrom(value, context.choices || []);
    if (!doctorId) return { state, contextJson: context, reply: "Elige un número de la lista de médicos." };
    return { state: "BOOK_DATE", contextJson: { specialtyId: context.specialtyId, doctorId }, reply: "Escribe la fecha que prefieres en formato AAAA-MM-DD (hora de Colombia)." };
  }
  if (state === "BOOK_DATE") {
    const page = await getPatientBookingPage({ models, userId: linked.user.id, query: { specialtyId: context.specialtyId, doctorId: context.doctorId, date: value }, now });
    if (page.status !== "ready") return { state, contextJson: context, reply: "Esa fecha no tiene horarios válidos. Escribe otra fecha en formato AAAA-MM-DD." };
    if (!page.slots?.length) return { state, contextJson: context, reply: "No hay horarios disponibles ese día. Escribe otra fecha en formato AAAA-MM-DD." };
    return { state: "BOOK_SLOT", contextJson: { ...context, date: value, choices: page.slots.map((slot) => slot.time) }, reply: "Elige un horario:\n" + listText((slot) => slot.label, page.slots) };
  }
  if (state === "BOOK_SLOT") {
    const time = selectFrom(value, context.choices || []);
    if (!time) return { state, contextJson: context, reply: "Elige un número de la lista de horarios." };
    const booked = await bookPatientAppointment({ sequelize, models, userId: linked.user.id, specialtyId: context.specialtyId, doctorId: context.doctorId, date: context.date, time, emailSender, now });
    if (booked.status !== "booked") return { state: "MENU", contextJson: null, reply: "Ese horario ya no está disponible o no se pudo confirmar.\n\n" + MENU };
    return { state: "MENU", contextJson: null, reply: `Tu cita quedó confirmada con ${booked.doctor.name}, el ${booked.appointment.date} a las ${booked.appointment.time}.\n\n${MENU}` };
  }
  if (state === "REMINDER_SELECT") {\n    const appointmentId = selectFrom(value, context.appointmentIds || []);\n    if (!appointmentId) return { state, contextJson: context, reply: "Elige un número de la lista de citas." };\n    const result = await requestWhatsAppAppointmentReminder({ sequelize, models, userId: linked.user.id, appointmentId, now });\n    const replies = {\n      scheduled: "Listo. Te enviaré por WhatsApp un recordatorio 24 horas antes de la cita.\\n\\n" + MENU,\n      already_scheduled: "Esa cita ya tiene un recordatorio programado.\\n\\n" + MENU,\n      already_sent: "El recordatorio de esa cita ya fue enviado.\\n\\n" + MENU,\n      too_late: "La cita es dentro de menos de 24 horas, así que ya no alcanza a programarse el recordatorio.\\n\\n" + MENU,\n      whatsapp_not_verified: "Primero vincula y verifica tu número de WhatsApp en MediGo para recibir recordatorios.\\n\\n" + MENU\n    };\n    return { state: "MENU", contextJson: null, reply: replies[result.status] || "No pude programar el recordatorio. Inténtalo más tarde.\\n\\n" + MENU };\n  }\n  if (state === "CANCEL_SELECT" || state === "RESCHEDULE_SELECT") {
    const appointmentId = selectFrom(value, context.appointmentIds || []);
    if (!appointmentId) return { state, contextJson: context, reply: "Elige un número de la lista de citas." };
    if (state === "CANCEL_SELECT") return { state: "CANCEL_CONFIRM", contextJson: { appointmentId }, reply: "¿Confirmas la cancelación? Responde *SI* para confirmar o *NO* para volver al menú." };
    const page = await getPatientReschedulePage({ models, userId: linked.user.id, appointmentId, now });
    if (page.status !== "ready") return { state: "MENU", contextJson: null, reply: "No se puede reprogramar esa cita.\n\n" + MENU };
    return { state: "RESCHEDULE_DATE", contextJson: { appointmentId }, reply: "Escribe la nueva fecha en formato AAAA-MM-DD (hora de Colombia)." };
  }
  if (state === "CANCEL_CONFIRM") {
    if (/^no$/i.test(value)) return { state: "MENU", contextJson: null, reply: MENU };
    if (!/^si$/i.test(value)) return { state, contextJson: context, reply: "Responde *SI* para cancelar o *NO* para volver al menú." };
    const result = await cancelPatientAppointment({ sequelize, models, userId: linked.user.id, appointmentId: context.appointmentId, emailSender, now });
    return { state: "MENU", contextJson: null, reply: result.status === "cancelled" ? "Cancelé la cita.\n\n" + MENU : "No fue posible cancelar la cita. Revisa las reglas de cancelación en MediGo.\n\n" + MENU };
  }
  if (state === "RESCHEDULE_DATE") {
    const page = await getPatientReschedulePage({ models, userId: linked.user.id, appointmentId: context.appointmentId, query: { date: value }, now });
    if (page.status !== "ready") return { state, contextJson: context, reply: "Esa fecha no es válida o no tiene horarios. Escribe otra fecha como AAAA-MM-DD." };
    if (!page.slots?.length) return { state, contextJson: context, reply: "No hay horarios disponibles ese día. Escribe otra fecha como AAAA-MM-DD." };
    return { state: "RESCHEDULE_SLOT", contextJson: { ...context, date: value, choices: page.slots.map((slot) => slot.time) }, reply: "Elige un horario:\n" + listText((slot) => slot.label, page.slots) };
  }
  if (state === "RESCHEDULE_SLOT") {
    const time = selectFrom(value, context.choices || []);
    if (!time) return { state, contextJson: context, reply: "Elige un número de la lista de horarios." };
    const result = await reschedulePatientAppointment({ sequelize, models, userId: linked.user.id, appointmentId: context.appointmentId, date: context.date, time, emailSender, now });
    return { state: "MENU", contextJson: null, reply: result.status === "rescheduled" ? `Reprogramé tu cita para el ${result.appointment.date} a las ${result.appointment.time}.\n\n${MENU}` : "El horario cambió o no se pudo reprogramar.\n\n" + MENU };
  }
  return { state: "MENU", contextJson: null, reply: MENU };
}

async function handleIncomingWhatsAppMessage({ models, sequelize, emailSender, sender, text, messageId, now = new Date() }) {
  if (!models?.Patient || !models?.WhatsAppConversation) return { status: "unavailable" };
  const phone = getPhone(sender);
  if (!phone || !messageId || typeof text !== "string" || !text.trim()) return { status: "ignored" };
  const linked = await findLinkedPatient(models, phone);
  if (!linked) return { status: "unlinked" };
  let conversation = await models.WhatsAppConversation.findOne({ where: { patientId: linked.patient.id } });
  if (conversation?.lastMessageId === messageId) return { status: "duplicate" };
  if (!conversation || new Date(conversation.expiresAt).getTime() <= now.getTime()) {
    conversation = conversation || await models.WhatsAppConversation.create({
      patientId: linked.patient.id, state: "VERIFY_DOCUMENT", contextJson: null,
      lastActivityAt: now, expiresAt: new Date(now.getTime() + SESSION_MS), lastMessageId: null
    });
    conversation.state = "VERIFY_DOCUMENT";
    conversation.contextJson = null;
    const reply = "Para proteger tu cuenta, escribe tu número de documento para continuar. No lo guardaremos en el chat.";
    await conversation.update({ state: "VERIFY_DOCUMENT", contextJson: null, lastActivityAt: now, expiresAt: new Date(now.getTime() + SESSION_MS), lastMessageId: messageId });
    return { status: "ready", to: phone, reply };
  }
  const next = await advanceConversation({ text, conversation, linked, models, sequelize, emailSender, now });
  await conversation.update({
    state: next.state, contextJson: next.contextJson,
    lastActivityAt: now, expiresAt: new Date(now.getTime() + SESSION_MS), lastMessageId: messageId
  });
  return { status: "ready", to: phone, reply: next.reply };
}

module.exports = { MENU, SESSION_MS, advanceConversation, handleIncomingWhatsAppMessage };
