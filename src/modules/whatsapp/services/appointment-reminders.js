const { Op } = require("sequelize");

const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
const RETRY_LIMIT = 3;
const STALE_SENDING_MS = 10 * 60 * 1000;
const BATCH_LIMIT = 50;
const TIME_ZONE = "America/Bogota";

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function formatAppointmentDate(date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(date);
}

function formatAppointmentTime(date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true
  }).format(date);
}

async function requestWhatsAppAppointmentReminder({ sequelize, models, userId, appointmentId, now = new Date() }) {
  if (!/^[1-9]\d*$/.test(String(appointmentId || ""))) return { status: "invalid" };
  if (!sequelize?.transaction || !models?.Patient?.findOne || !models?.Appointment?.findOne
    || !models?.WhatsAppAppointmentReminder?.findOne) return { status: "unavailable" };

  try {
    return await sequelize.transaction(async (transaction) => {
      const patient = plain(await models.Patient.findOne({
        where: { userId }, transaction, lock: transaction.LOCK.UPDATE
      }));
      if (!patient) return { status: "not_found" };
      if (!patient.whatsappPhone || !patient.whatsappConsentAt || !patient.whatsappVerifiedAt) {
        return { status: "whatsapp_not_verified" };
      }

      const appointment = plain(await models.Appointment.findOne({
        where: { id: appointmentId, patientId: patient.id },
        transaction, lock: transaction.LOCK.UPDATE
      }));
      if (!appointment) return { status: "not_found" };
      if (appointment.status !== "CONFIRMED") return { status: "not_remindable" };

      const startsAt = new Date(appointment.startsAt);
      if (!Number.isFinite(startsAt.getTime())) return { status: "not_remindable" };
      const scheduledAt = new Date(startsAt.getTime() - REMINDER_LEAD_MS);
      if (scheduledAt.getTime() <= now.getTime()) return { status: "too_late" };

      const reminder = await models.WhatsAppAppointmentReminder.findOne({
        where: { appointmentId: appointment.id },
        transaction, lock: transaction.LOCK.UPDATE
      });
      if (reminder) {
        const current = plain(reminder);
        if (current.status === "SENT") return { status: "already_sent" };
        if (current.status === "PENDING" || current.status === "SENDING") {
          if (current.status === "PENDING") await reminder.update({ scheduledAt, updatedAt: now }, { transaction });
          return { status: "already_scheduled" };
        }
        await reminder.update({
          scheduledAt,
          status: "PENDING",
          sentAt: null,
          attemptCount: 0,
          lastAttemptAt: null,
          providerMessageId: null,
          updatedAt: now
        }, { transaction });
        return { status: "scheduled" };
      }

      await models.WhatsAppAppointmentReminder.create({
        appointmentId: appointment.id,
        scheduledAt,
        status: "PENDING",
        sentAt: null,
        attemptCount: 0,
        lastAttemptAt: null,
        providerMessageId: null,
        createdAt: now,
        updatedAt: now
      }, { transaction });
      return { status: "scheduled" };
    });
  } catch {
    return { status: "error" };
  }
}

async function processDueWhatsAppAppointmentReminders({ models, sender, now = new Date() }) {
  const Reminder = models?.WhatsAppAppointmentReminder;
  const Appointment = models?.Appointment;
  const Patient = models?.Patient;
  const User = models?.User;
  if (!Reminder?.findAll || !Reminder?.update || !Appointment || !Patient || !User
    || typeof sender?.sendAppointmentTemplate !== "function") {
    return { status: "unavailable", processed: 0 };
  }

  const staleBefore = new Date(now.getTime() - STALE_SENDING_MS);
  await Reminder.update(
    { status: "PENDING", updatedAt: now },
    { where: { status: "SENDING", lastAttemptAt: { [Op.lte]: staleBefore } } }
  );

  const reminders = await Reminder.findAll({
    where: { status: "PENDING", scheduledAt: { [Op.lte]: now } },
    include: [{
      model: Appointment,
      as: "appointment",
      required: false,
      include: [{
        model: Patient,
        as: "patient",
        required: false,
        include: [{ model: User, as: "user", required: false }]
      }]
    }],
    order: [["scheduledAt", "ASC"]],
    limit: BATCH_LIMIT
  });

  let processed = 0;
  for (const record of reminders) {
    const reminder = plain(record);
    const appointment = plain(reminder.appointment);
    const patient = plain(appointment?.patient);
    const user = plain(patient?.user);
    const startsAt = new Date(appointment?.startsAt);
    const eligible = appointment?.status === "CONFIRMED"
      && Number.isFinite(startsAt.getTime())
      && startsAt.getTime() > now.getTime()
      && patient?.whatsappPhone && patient?.whatsappConsentAt && patient?.whatsappVerifiedAt
      && user?.role === "PATIENT" && user.status === "ACTIVE" && user.emailVerifiedAt;

    if (!eligible) {
      await Reminder.update(
        { status: "CANCELLED", updatedAt: now },
        { where: { id: reminder.id, status: "PENDING" } }
      );
      continue;
    }

    const attemptCount = Number(reminder.attemptCount || 0) + 1;
    const [claimed] = await Reminder.update({
      status: "SENDING",
      attemptCount,
      lastAttemptAt: now,
      updatedAt: now
    }, { where: { id: reminder.id, status: "PENDING" } });
    if (!claimed) continue;

    let result;
    try {
      result = await sender.sendAppointmentTemplate({
        to: patient.whatsappPhone,
        kind: "reminder",
        parameters: [formatAppointmentDate(startsAt), formatAppointmentTime(startsAt)]
      });
    } catch {
      result = { status: "failed" };
    }

    if (result?.status === "sent") {
      await Reminder.update({
        status: "SENT",
        sentAt: now,
        providerMessageId: result.messageId || null,
        updatedAt: now
      }, { where: { id: reminder.id, status: "SENDING" } });
    } else {
      await Reminder.update({
        status: attemptCount >= RETRY_LIMIT ? "FAILED" : "PENDING",
        updatedAt: now
      }, { where: { id: reminder.id, status: "SENDING" } });
    }
    processed += 1;
  }
  return { status: "ready", processed };
}

function createWhatsAppReminderScheduler({ models, sender, intervalMs = 60_000 } = {}) {
  let timer = null;
  let running = false;

  async function runOnce() {
    if (running) return;
    running = true;
    try {
      await processDueWhatsAppAppointmentReminders({ models, sender });
    } catch {
      // The next interval retries any work that remains pending.
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) return;
      void runOnce();
      timer = setInterval(runOnce, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    runOnce
  };
}

module.exports = {
  REMINDER_LEAD_MS,
  createWhatsAppReminderScheduler,
  formatAppointmentDate,
  formatAppointmentTime,
  processDueWhatsAppAppointmentReminders,
  requestWhatsAppAppointmentReminder
};
