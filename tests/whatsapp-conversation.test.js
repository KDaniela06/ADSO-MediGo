jest.mock("../src/modules/patient/services/appointments", () => ({ getPatientBookingPage: jest.fn(), bookPatientAppointment: jest.fn() }));
jest.mock("../src/modules/patient/services/my-appointments", () => ({ getPatientAppointments: jest.fn() }));
jest.mock("../src/modules/patient/services/cancel-appointment", () => ({ cancelPatientAppointment: jest.fn() }));
jest.mock("../src/modules/patient/services/reschedule-appointment", () => ({ getPatientReschedulePage: jest.fn(), reschedulePatientAppointment: jest.fn() }));
jest.mock("../src/modules/whatsapp/services/appointment-reminders", () => ({ requestWhatsAppAppointmentReminder: jest.fn() }));

const { advanceConversation, handleIncomingWhatsAppMessage } = require("../src/modules/whatsapp/conversation-service");
const { getPatientBookingPage } = require("../src/modules/patient/services/appointments");
const { getPatientAppointments } = require("../src/modules/patient/services/my-appointments");
const { requestWhatsAppAppointmentReminder } = require("../src/modules/whatsapp/services/appointment-reminders");

function setup(existing = null) {
  const patient = { id: 12, whatsappPhone: "+573001234567", whatsappVerifiedAt: new Date() };
  const user = { id: 7, firstName: "Ana", documentNumber: "12345678", role: "PATIENT", status: "ACTIVE", emailVerifiedAt: new Date() };
  const conversation = existing || {
    patientId: patient.id, state: "VERIFY_DOCUMENT", contextJson: null,
    expiresAt: new Date("2026-11-25T00:00:00.000Z"), lastMessageId: null,
    update: jest.fn(async (values) => Object.assign(conversation, values))
  };
  let saved = existing;
  const models = {
    Patient: { findOne: jest.fn().mockResolvedValue({ ...patient, user }) },
    User: {},
    WhatsAppConversation: {
      findOne: jest.fn(async () => saved),
      create: jest.fn(async () => { saved = conversation; return conversation; })
    }
  };
  return { models, patient, user, conversation };
}

describe("WhatsApp conversation flow", () => {
  const now = new Date("2026-11-24T15:00:00.000Z");

  test("asks for identity first and does not store the submitted document", async () => {
    const { models, conversation } = setup();
    const first = await handleIncomingWhatsAppMessage({ models, sender: "573001234567", text: "Hola", messageId: "wamid-1", now });
    expect(first.reply).toMatch(/número de documento/i);
    const verified = await handleIncomingWhatsAppMessage({ models, sender: "573001234567", text: "12.345.678", messageId: "wamid-2", now });
    expect(verified.reply).toMatch(/Identidad verificada/);
    expect(conversation.state).toBe("MENU");
    expect(JSON.stringify(conversation.contextJson)).not.toContain("12345678");
  });

  test("requests identity again when the inactivity window has expired", async () => {
    const old = {
      patientId: 12, state: "MENU", contextJson: { appointmentId: "999" },
      expiresAt: new Date("2026-11-24T14:44:59.000Z"), lastMessageId: null,
      update: jest.fn(async (values) => Object.assign(old, values))
    };
    const { models } = setup(old);
    const response = await handleIncomingWhatsAppMessage({ models, sender: "573001234567", text: "2", messageId: "wamid-new", now });
    expect(response.reply).toMatch(/número de documento/i);
    expect(old.state).toBe("VERIFY_DOCUMENT");
    expect(old.contextJson).toBeNull();
  });

  test("ignores a webhook message already processed", async () => {
    const old = { patientId: 12, state: "MENU", contextJson: null, expiresAt: new Date("2026-11-25T00:00:00Z"), lastMessageId: "wamid-dup", update: jest.fn() };
    const { models } = setup(old);
    await expect(handleIncomingWhatsAppMessage({ models, sender: "573001234567", text: "2", messageId: "wamid-dup", now })).resolves.toEqual({ status: "duplicate" });
    expect(old.update).not.toHaveBeenCalled();
  });

  test("lets the patient choose an appointment for a WhatsApp reminder", async () => {
    getPatientAppointments.mockResolvedValue({
      status: "ready",
      appointments: [{ id: 31, status: "Confirmada", canReschedule: true, specialtyName: "Medicina general", doctorName: "Dra. Ruiz", date: "lunes 30 de noviembre", time: "9:00 a. m." }]
    });
    requestWhatsAppAppointmentReminder.mockResolvedValue({ status: "scheduled" });
    const linked = { user: { id: 7 } };
    const first = await advanceConversation({
      text: "5", conversation: { state: "MENU", contextJson: null }, linked, models: {}, sequelize: {}, now
    });
    expect(first.state).toBe("REMINDER_SELECT");
    const selected = await advanceConversation({
      text: "1",
      conversation: { state: first.state, contextJson: first.contextJson },
      linked, models: {}, sequelize: {}, now
    });
    expect(selected.reply).toMatch(/24 horas antes/i);
    expect(requestWhatsAppAppointmentReminder).toHaveBeenCalledWith({
      sequelize: {}, models: {}, userId: 7, appointmentId: "31", now
    });
  });

  test("shows human-readable appointment times and keeps the matching choices", async () => {
    getPatientBookingPage.mockResolvedValue({ status: "ready", slots: [
      { time: "09:00", label: "9:00 a. m." }, { time: "10:00", label: "10:00 a. m." }
    ] });
    const result = await advanceConversation({
      text: "2026-11-30", conversation: { state: "BOOK_DATE", contextJson: { specialtyId: "2", doctorId: "4" } },
      linked: { user: { id: 7 } }, models: {}, sequelize: {}, now
    });
    expect(result.reply).toContain("1. 9:00 a. m.");
    expect(result.contextJson.choices).toEqual(["09:00", "10:00"]);
  });
});
