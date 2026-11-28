const { Op } = require("sequelize");
const { addDays, bogotaLocalToUtc, getAvailableSlots } = require("./appointments");

const RESCHEDULE_WINDOW_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = "America/Bogota";
const SLOT_MINUTES = 30;

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true
  }).format(date);
}

function dateInBogota(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function appointmentIncludes(models) {
  const include = [];
  if (models.Doctor) include.push({
    model: models.Doctor, as: "doctor", required: false,
    include: models.User
      ? [{ model: models.User, as: "user", attributes: ["firstName", "lastName"], required: false }]
      : []
  });
  if (models.Specialty) include.push({
    model: models.Specialty, as: "specialty", attributes: ["name"], required: false
  });
  return include;
}

function presentAppointment(record) {
  const appointment = plain(record);
  const doctor = plain(appointment.doctor) || {};
  const doctorUser = plain(doctor.user) || {};
  const specialty = plain(appointment.specialty) || {};
  const startsAt = new Date(appointment.startsAt);
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    specialtyId: appointment.specialtyId,
    status: appointment.status,
    startsAt,
    endsAt: new Date(appointment.endsAt),
    date: Number.isFinite(startsAt.getTime()) ? formatDate(startsAt) : "Fecha no disponible",
    time: Number.isFinite(startsAt.getTime()) ? formatTime(startsAt) : "",
    doctorName: [doctorUser.firstName, doctorUser.lastName].filter(Boolean).join(" ") || "Médico asignado",
    specialtyName: specialty.name || "Especialidad asignada"
  };
}

function appointmentCanReschedule(appointment, now) {
  return appointment.status === "CONFIRMED"
    && Number.isFinite(appointment.startsAt.getTime())
    && appointment.startsAt.getTime() - now.getTime() >= RESCHEDULE_WINDOW_MS;
}

async function getPatientReschedulePage({ models, userId, appointmentId, query = {}, now = new Date() }) {
  const page = {
    status: "unavailable", appointment: null, slots: [], date: String(query.date || ""),
    time: String(query.time || ""), selectedSlot: null,
    minDate: dateInBogota(now), maxDate: addDays(dateInBogota(now), 30)
  };
  if (!/^[1-9]\d*$/.test(String(appointmentId || ""))) return { ...page, status: "invalid" };
  if (!models?.Patient?.findOne || !models?.Appointment?.findOne) return page;
  try {
    const patient = plain(await models.Patient.findOne({ where: { userId } }));
    if (!patient) return { ...page, status: "not_found" };
    const record = await models.Appointment.findOne({
      where: { id: appointmentId, patientId: patient.id },
      include: appointmentIncludes(models)
    });
    if (!record) return { ...page, status: "not_found" };
    const appointment = presentAppointment(record);
    if (!appointmentCanReschedule(appointment, now)) {
      return { ...page, status: "not_reschedulable", appointment };
    }

    if (!page.date) return { ...page, status: "ready", appointment };
    const available = await getAvailableSlots({
      models, doctorId: appointment.doctorId, date: page.date, now
    });
    if (available.status !== "ready") {
      return { ...page, status: available.status, appointment, slots: [] };
    }
    const selectedSlot = page.time
      ? available.slots.find((slot) => slot.time === page.time) || null
      : null;
    return {
      ...page,
      status: page.time && !selectedSlot ? "slot_unavailable" : "ready",
      appointment,
      slots: available.slots,
      selectedSlot
    };
  } catch {
    return { ...page, status: "error" };
  }
}

async function reschedulePatientAppointment({
  sequelize, models, userId, appointmentId, date, time, emailSender = null, now = new Date()
}) {
  if (!/^[1-9]\d*$/.test(String(appointmentId || ""))) return { status: "invalid" };
  if (!sequelize?.transaction || !models?.Patient?.findOne || !models?.Appointment?.findOne
    || !models?.Doctor?.findByPk || !models?.AuditLog?.create) return { status: "unavailable" };
  const startsAt = bogotaLocalToUtc(date, time);
  if (!startsAt) return { status: "invalid" };
  const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60 * 1000);

  let change;
  try {
    change = await sequelize.transaction(async (transaction) => {
      const patient = plain(await models.Patient.findOne({
        where: { userId }, transaction, lock: transaction.LOCK.UPDATE
      }));
      if (!patient) return { status: "not_found" };
      const record = await models.Appointment.findOne({
        where: { id: appointmentId, patientId: patient.id },
        include: appointmentIncludes(models),
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!record) return { status: "not_found" };

      const appointment = plain(record);
      const previousStart = new Date(appointment.startsAt);
      if (appointment.status !== "CONFIRMED" || !Number.isFinite(previousStart.getTime())
        || previousStart.getTime() - now.getTime() < RESCHEDULE_WINDOW_MS) {
        return { status: "not_reschedulable" };
      }
      if (startsAt.getTime() === previousStart.getTime()) return { status: "no_change" };

      const doctor = plain(await models.Doctor.findByPk(appointment.doctorId, {
        transaction, lock: transaction.LOCK.UPDATE
      }));
      if (!doctor) return { status: "unavailable" };

      const availability = await getAvailableSlots({
        models, doctorId: appointment.doctorId, date, now, transaction
      });
      if (availability.status !== "ready") return { status: availability.status };
      const slot = availability.slots.find((item) => item.startsAt.getTime() === startsAt.getTime());
      if (!slot) return { status: "slot_unavailable" };

      const beforeData = {
        status: appointment.status,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt
      };
      if (models.WhatsAppAppointmentReminder?.update) {
        const reminderAt = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
        await models.WhatsAppAppointmentReminder.update({
          scheduledAt: reminderAt,
          status: reminderAt.getTime() > now.getTime() ? "PENDING" : "CANCELLED",
          sentAt: null, attemptCount: 0, lastAttemptAt: null, providerMessageId: null, updatedAt: now
        }, { where: { appointmentId: appointment.id, status: { [Op.ne]: "CANCELLED" } }, transaction });
      }
      await record.update({ startsAt, endsAt, updatedAt: now }, { transaction });
      await models.AuditLog.create({
        actorUserId: userId,
        action: "PATIENT_APPOINTMENT_RESCHEDULED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        beforeData,
        afterData: { status: "CONFIRMED", startsAt, endsAt },
        createdAt: now
      }, { transaction });

      const patientUser = models.User
        ? plain(await models.User.findByPk(userId, {
          attributes: ["firstName", "email"], transaction
        }))
        : null;
      return {
        status: "rescheduled",
        appointmentId: appointment.id,
        patient: patientUser || {},
        doctorName: [plain(appointment.doctor)?.user?.firstName, plain(appointment.doctor)?.user?.lastName].filter(Boolean).join(" "),
        specialtyName: plain(appointment.specialty)?.name || "Especialidad asignada",
        previous: { date: formatDate(previousStart), time: formatTime(previousStart) },
        appointment: { date: formatDate(startsAt), time: formatTime(startsAt), startsAt, endsAt }
      };
    });
  } catch {
    return { status: "error" };
  }

  if (change.status !== "rescheduled") return change;

  let notificationStatus = "not_configured";
  if (emailSender?.sendAppointmentRescheduleNotification && change.patient.email) {
    try {
      await emailSender.sendAppointmentRescheduleNotification({
        to: change.patient.email,
        firstName: change.patient.firstName,
        doctorName: change.doctorName,
        specialtyName: change.specialtyName,
        previousDate: change.previous.date,
        previousTime: change.previous.time,
        appointmentDate: change.appointment.date,
        appointmentTime: change.appointment.time
      });
      notificationStatus = "sent";
    } catch {
      notificationStatus = "failed";
    }
  }

  try {
    await models.AuditLog.create({
      actorUserId: userId,
      action: "PATIENT_APPOINTMENT_RESCHEDULE_EMAIL_" + notificationStatus.toUpperCase(),
      entityType: "APPOINTMENT",
      entityId: change.appointmentId,
      beforeData: null,
      afterData: { status: notificationStatus },
      createdAt: new Date()
    });
  } catch {
    notificationStatus = notificationStatus === "sent" ? "sent_audit_failed" : notificationStatus;
  }
  return { ...change, notificationStatus };
}

module.exports = {
  RESCHEDULE_WINDOW_MS,
  getPatientReschedulePage,
  reschedulePatientAppointment
};
