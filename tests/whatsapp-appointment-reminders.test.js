const {
  processDueWhatsAppAppointmentReminders,
  requestWhatsAppAppointmentReminder
} = require("../src/modules/whatsapp/services/appointment-reminders");

describe("WhatsApp appointment reminders", () => {
  const now = new Date("2026-11-27T15:00:00.000Z");

  test("schedules one reminder 24 hours before an appointment", async () => {
    const appointment = { id: 31, patientId: 12, startsAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), status: "CONFIRMED" };
    const models = {
      Patient: { findOne: jest.fn().mockResolvedValue({ id: 12, whatsappPhone: "+573001234567", whatsappConsentAt: now, whatsappVerifiedAt: now }) },
      Appointment: { findOne: jest.fn().mockResolvedValue(appointment) },
      WhatsAppAppointmentReminder: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({})
      }
    };
    const sequelize = { transaction: jest.fn(async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } })) };

    await expect(requestWhatsAppAppointmentReminder({ sequelize, models, userId: 7, appointmentId: 31, now }))
      .resolves.toEqual({ status: "scheduled" });
    expect(models.WhatsAppAppointmentReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 31,
        status: "PENDING",
        scheduledAt: new Date(appointment.startsAt.getTime() - 24 * 60 * 60 * 1000)
      }),
      expect.any(Object)
    );
  });

  test("sends due reminders and saves the Meta message id", async () => {
    const appointmentStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const dueReminder = {
      id: 4, appointmentId: 31, scheduledAt: new Date(now.getTime() - 60_000),
      status: "PENDING", attemptCount: 0,
      appointment: {
        status: "CONFIRMED", startsAt: appointmentStart,
        patient: {
          whatsappPhone: "+573001234567", whatsappConsentAt: now, whatsappVerifiedAt: now,
          user: { role: "PATIENT", status: "ACTIVE", emailVerifiedAt: now }
        }
      }
    };
    const models = {
      WhatsAppAppointmentReminder: {
        update: jest.fn().mockResolvedValue([1]),
        findAll: jest.fn().mockResolvedValue([dueReminder])
      },
      Appointment: {}, Patient: {}, User: {}
    };
    const sender = { sendAppointmentTemplate: jest.fn().mockResolvedValue({ status: "sent", messageId: "wamid.123" }) };

    await expect(processDueWhatsAppAppointmentReminders({ models, sender, now }))
      .resolves.toEqual({ status: "ready", processed: 1 });
    expect(sender.sendAppointmentTemplate).toHaveBeenCalledWith({
      to: "+573001234567",
      kind: "reminder",
      parameters: expect.any(Array)
    });
    expect(models.WhatsAppAppointmentReminder.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "SENT", providerMessageId: "wamid.123", sentAt: now }),
      expect.objectContaining({ where: { id: 4, status: "SENDING" } })
    );
  });
});
