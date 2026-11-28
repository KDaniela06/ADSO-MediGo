const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = "America/Bogota";

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

function cancellationIncludes(models) {
  const include = [];
  if (models.Doctor) {
    include.push({
      model: models.Doctor, as: "doctor", required: false,
      include: models.User
        ? [{ model: models.User, as: "user", attributes: ["firstName", "lastName"], required: false }]
        : []
    });
  }
  if (models.Specialty) include.push({
    model: models.Specialty, as: "specialty", attributes: ["name"], required: false
  });
  return include;
}

function presentCancellation(record, now) {
  const appointment = plain(record);
  const doctor = plain(appointment.doctor) || {};
  const doctorUser = plain(doctor.user) || {};
  const specialty = plain(appointment.specialty) || {};
  const startsAt = new Date(appointment.startsAt);
  const validStart = Number.isFinite(startsAt.getTime());
  const canCancel = appointment.status === "CONFIRMED" && validStart
    && startsAt.getTime() - now.getTime() >= CANCELLATION_WINDOW_MS;
  return {
    id: appointment.id,
    status: appointment.status,
    startsAt,
    date: validStart ? formatDate(startsAt) : "Fecha no disponible",
    time: validStart ? formatTime(startsAt) : "",
    doctorName: [doctorUser.firstName, doctorUser.lastName].filter(Boolean).join(" ") || "Médico asignado",
    specialtyName: specialty.name || "Especialidad asignada",
    canCancel
  };
}

async function getPatientAppointmentCancellation({ models, userId, appointmentId, now = new Date() }) {
  if (!/^[1-9]\d*$/.test(String(appointmentId || ""))) return { status: "invalid" };
  if (!models?.Patient?.findOne || !models?.Appointment?.findOne) return { status: "unavailable" };
  try {
    const patient = plain(await models.Patient.findOne({ where: { userId } }));
    if (!patient) return { status: "not_found" };
    const record = await models.Appointment.findOne({
      where: { id: appointmentId, patientId: patient.id },
      include: cancellationIncludes(models)
    });
    if (!record) return { status: "not_found" };
    return { status: "ready", appointment: presentCancellation(record, now) };
  } catch {
    return { status: "error" };
  }
}

async function cancelPatientAppointment({
  sequelize, models, userId, appointmentId, emailSender = null, now = new Date()
}) {
  if (!/^[1-9]\d*$/.test(String(appointmentId || ""))) return { status: "invalid" };
  if (!sequelize?.transaction || !models?.Patient?.findOne || !models?.Appointment?.findOne
    || !models?.AuditLog?.create) return { status: "unavailable" };

  let cancellation;
  try {
    cancellation = await sequelize.transaction(async (transaction) => {
      const patient = plain(await models.Patient.findOne({
        where: { userId }, transaction, lock: transaction.LOCK.UPDATE
      }));
      if (!patient) return { status: "not_found" };

      const record = await models.Appointment.findOne({
        where: { id: appointmentId, patientId: patient.id },
        include: cancellationIncludes(models),
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!record) return { status: "not_found" };

      const appointment = plain(record);
      const startsAt = new Date(appointment.startsAt);
      if (appointment.status !== "CONFIRMED" || !Number.isFinite(startsAt.getTime())
        || startsAt.getTime() - now.getTime() < CANCELLATION_WINDOW_MS) {
        return { status: "not_cancellable" };
      }

      const beforeData = {
        status: appointment.status,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt
      };
      if (models.WhatsAppAppointmentReminder?.update) {
        await models.WhatsAppAppointmentReminder.update(
          { status: "CANCELLED", updatedAt: now },
          { where: { appointmentId: appointment.id, status: ["PENDING", "SENDING", "FAILED"] }, transaction }
        );
      }
      await record.update({
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: "Cancelada por el paciente",
        updatedAt: now
      }, { transaction });
      await models.AuditLog.create({
        actorUserId: userId,
        action: "PATIENT_APPOINTMENT_CANCELLED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        beforeData,
        afterData: { ...beforeData, status: "CANCELLED", cancelledAt: now },
        createdAt: now
      }, { transaction });

      const patientUser = models.User
        ? plain(await models.User.findByPk(userId, {
          attributes: ["firstName", "email"], transaction
        }))
        : null;
      return {
        status: "cancelled",
        appointmentId: appointment.id,
        patient: patientUser || {},
        appointment: presentCancellation({ ...appointment, status: "CANCELLED" }, now)
      };
    });
  } catch {
    return { status: "error" };
  }

  if (cancellation.status !== "cancelled") return cancellation;

  let notificationStatus = "not_configured";
  if (emailSender?.sendAppointmentCancellationNotification && cancellation.patient.email) {
    try {
      await emailSender.sendAppointmentCancellationNotification({
        to: cancellation.patient.email,
        firstName: cancellation.patient.firstName,
        appointmentDate: cancellation.appointment.date,
        appointmentTime: cancellation.appointment.time
      });
      notificationStatus = "sent";
    } catch {
      notificationStatus = "failed";
    }
  }

  try {
    await models.AuditLog.create({
      actorUserId: userId,
      action: "PATIENT_APPOINTMENT_CANCELLATION_EMAIL_" + notificationStatus.toUpperCase(),
      entityType: "APPOINTMENT",
      entityId: cancellation.appointmentId,
      beforeData: null,
      afterData: { status: notificationStatus },
      createdAt: new Date()
    });
  } catch {
    notificationStatus = notificationStatus === "sent" ? "sent_audit_failed" : notificationStatus;
  }

  return { ...cancellation, notificationStatus };
}

module.exports = {
  CANCELLATION_WINDOW_MS,
  cancelPatientAppointment,
  getPatientAppointmentCancellation,
  presentCancellation
};
