const { Op } = require("sequelize");
const { todayInBogota } = require("../../doctor/services/schedule");

const TIME_ZONE = "America/Bogota";
const WEEKDAY_NUMBER = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const CANCELLATION_REASON = "Horario médico actualizado";

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function localParts(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return { weekday: WEEKDAY_NUMBER[values.weekday], time: `${values.hour}:${values.minute}` };
}

function scheduleBlockCoversAppointment(appointment, blocks) {
  const starts = localParts(appointment.startsAt);
  const ends = localParts(appointment.endsAt);
  if (!starts || !ends || starts.weekday !== ends.weekday || starts.weekday < 1) return false;
  return blocks.some((block) =>
    Number(block.weekday) === starts.weekday
    && starts.time >= String(block.startsAt).slice(0, 5)
    && ends.time <= String(block.endsAt).slice(0, 5)
  );
}

function presentAppointment(record) {
  const appointment = plain(record);
  const user = plain(plain(appointment.patient)?.user) || {};
  const startsAt = new Date(appointment.startsAt);
  return {
    id: appointment.id,
    patientName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Paciente",
    email: user.email || null,
    startsAt,
    date: new Intl.DateTimeFormat("es-CO", {
      timeZone: TIME_ZONE, dateStyle: "long"
    }).format(startsAt),
    time: new Intl.DateTimeFormat("es-CO", {
      timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true
    }).format(startsAt)
  };
}

async function findUpcomingConfirmedAppointments({ models, doctorId, now, transaction = null }) {
  const include = [];
  if (models.Patient) {
    include.push({
      model: models.Patient, as: "patient", required: false,
      include: models.User ? [{
        model: models.User, as: "user", attributes: ["firstName", "lastName", "email"], required: false
      }] : []
    });
  }
  return models.Appointment.findAll({
    where: { doctorId, status: "CONFIRMED", startsAt: { [Op.gte]: now } },
    include,
    order: [["startsAt", "ASC"]],
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {})
  });
}

async function getAdminSchedulePage({ models, doctorId = "", now = new Date() }) {
  const empty = { status: "unavailable", doctors: [], selectedDoctor: null, blocks: [] };
  if (!models?.Doctor?.findAll || !models?.DoctorWeeklySchedule?.findAll || !models?.DoctorWeeklyScheduleBlock) return empty;
  try {
    const rows = await models.Doctor.findAll({
      attributes: ["id", "userId", "specialtyId"],
      include: [
        { model: models.User, as: "user", attributes: ["firstName", "lastName", "status"], where: { role: "DOCTOR" }, required: true },
        { model: models.Specialty, as: "specialty", attributes: ["name"], required: false }
      ],
      order: [["id", "DESC"]]
    });
    const doctors = rows.map((row) => {
      const doctor = plain(row);
      const user = plain(doctor.user) || {};
      const specialty = plain(doctor.specialty) || {};
      return {
        id: doctor.id, userId: doctor.userId,
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        specialtyName: specialty.name || "Sin especialidad",
        accountStatus: user.status
      };
    });
    const selectedDoctor = doctors.find((doctor) => String(doctor.id) === String(doctorId)) || null;
    if (!selectedDoctor) return { status: "ready", doctors, selectedDoctor: null, blocks: [], effectiveFrom: null };
    const schedules = await models.DoctorWeeklySchedule.findAll({
      where: { doctorId: selectedDoctor.id, status: "ACTIVE" },
      include: [{
        model: models.DoctorWeeklyScheduleBlock, as: "blocks",
        attributes: ["weekday", "startsAt", "endsAt"], required: false
      }],
      order: [["effectiveFrom", "DESC"]]
    });
    const today = todayInBogota(now);
    const active = schedules.map(plain).find((schedule) =>
      String(schedule.effectiveFrom).slice(0, 10) <= today
      && (!schedule.effectiveTo || String(schedule.effectiveTo).slice(0, 10) >= today)
    );
    const blocks = (active?.blocks || []).map(plain).map((block) => ({
      weekday: Number(block.weekday),
      startsAt: String(block.startsAt || "").slice(0, 5),
      endsAt: String(block.endsAt || "").slice(0, 5)
    })).sort((left, right) => left.weekday - right.weekday || left.startsAt.localeCompare(right.startsAt));
    return { status: "ready", doctors, selectedDoctor, blocks, effectiveFrom: active?.effectiveFrom || null };
  } catch {
    return { ...empty, status: "error" };
  }
}

async function previewDoctorScheduleChanges({ models, doctorId, blocks, now = new Date() }) {
  if (!models?.Doctor?.findByPk || !models?.Appointment?.findAll) return { status: "unavailable", appointments: [] };
  if (!/^\d+$/.test(String(doctorId || ""))) return { status: "not_found", appointments: [] };
  try {
    const doctor = await models.Doctor.findByPk(doctorId, { attributes: ["id"] });
    if (!doctor) return { status: "not_found", appointments: [] };
    const rows = await findUpcomingConfirmedAppointments({ models, doctorId, now });
    const appointments = rows.map(presentAppointment).filter((appointment, index) =>
      !scheduleBlockCoversAppointment(rows[index], blocks)
    );
    return { status: "ready", appointments };
  } catch {
    return { status: "error", appointments: [] };
  }
}

function normalizedIds(value) {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return values.map(String).sort();
}

async function saveDoctorWeeklySchedule({
  sequelize, models, doctorId, actorUserId, blocks, confirmed, confirmedAppointmentIds = [], emailSender = null, now = new Date()
}) {
  if (!sequelize || !models?.Doctor || !models?.DoctorWeeklySchedule || !models?.DoctorWeeklyScheduleBlock
    || !models?.Appointment || !models?.AuditLog) return { status: "unavailable" };
  if (!/^\d+$/.test(String(doctorId || ""))) return { status: "not_found" };

  const effectiveFrom = todayInBogota(now);
  const result = await sequelize.transaction(async (transaction) => {
    const doctor = await models.Doctor.findByPk(doctorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!doctor) return { status: "not_found" };
    const current = await models.DoctorWeeklySchedule.findOne({
      where: { doctorId, status: "ACTIVE" },
      include: [{
        model: models.DoctorWeeklyScheduleBlock, as: "blocks",
        attributes: ["weekday", "startsAt", "endsAt"], required: false
      }],
      order: [["effectiveFrom", "DESC"]],
      transaction, lock: transaction.LOCK.UPDATE
    });
    const upcoming = await findUpcomingConfirmedAppointments({ models, doctorId, now, transaction });
    const affectedRows = upcoming.filter((appointment) => !scheduleBlockCoversAppointment(appointment, blocks));
    const affected = affectedRows.map(presentAppointment);
    if (confirmed !== "YES") return { status: "confirmation_required", appointments: affected };
    if (normalizedIds(confirmedAppointmentIds).join(",") !== normalizedIds(affected.map((item) => item.id)).join(",")) {
      return { status: "preview_changed", appointments: affected };
    }

    const previousBlocks = (plain(current)?.blocks || []).map(plain).map((block) => ({
      weekday: Number(block.weekday), startsAt: String(block.startsAt).slice(0, 5), endsAt: String(block.endsAt).slice(0, 5)
    }));
    if (current) {
      current.status = "INACTIVE";
      current.effectiveTo = effectiveFrom;
      await current.save({ transaction });
    }
    const schedule = await models.DoctorWeeklySchedule.create({
      doctorId: doctor.id, effectiveFrom, effectiveTo: null, status: "ACTIVE"
    }, { transaction });
    await models.DoctorWeeklyScheduleBlock.bulkCreate(blocks.map((block) => ({
      scheduleId: schedule.id,
      weekday: block.weekday,
      startsAt: block.startsAt + ":00",
      endsAt: block.endsAt + ":00"
    })), { transaction });

    await models.AuditLog.create({
      actorUserId, action: "DOCTOR_WEEKLY_SCHEDULE_UPDATED",
      entityType: "DOCTOR", entityId: doctor.id,
      beforeData: { scheduleId: current?.id || null, effectiveFrom: current?.effectiveFrom || null, blocks: previousBlocks },
      afterData: { scheduleId: schedule.id, effectiveFrom, blocks: blocks.map(({ weekday, startsAt, endsAt }) => ({ weekday, startsAt, endsAt })) },
      createdAt: now
    }, { transaction });

    for (const appointment of affectedRows) {
      const record = appointment;
      const beforeData = { status: record.status, cancelledAt: record.cancelledAt || null, cancellationReason: record.cancellationReason || null };
      record.status = "CANCELLED";
      record.cancelledAt = now;
      record.cancellationReason = CANCELLATION_REASON;
      await record.save({ transaction });
      await models.AuditLog.create({
        actorUserId, action: "APPOINTMENT_CANCELLED_BY_SCHEDULE",
        entityType: "APPOINTMENT", entityId: record.id,
        beforeData, afterData: { status: "CANCELLED", cancelledAt: now, cancellationReason: CANCELLATION_REASON },
        createdAt: now
      }, { transaction });
    }
    return { status: "saved", appointments: affected, cancelled: affectedRows.length };
  });

  if (result.status !== "saved" || !result.cancelled) return { ...result, failedNotifications: 0 };
  const notifications = await Promise.allSettled(result.appointments.map((appointment) => {
    if (!emailSender?.sendAppointmentCancellationNotification || !appointment.email) {
      throw new Error("No hay un medio de notificación disponible.");
    }
    return emailSender.sendAppointmentCancellationNotification({
      to: appointment.email, firstName: appointment.patientName.split(" ")[0],
      appointmentDate: appointment.date, appointmentTime: appointment.time
    });
  }));
  const failedNotifications = notifications.filter((notification) => notification.status === "rejected").length;
  return { ...result, failedNotifications };
}

module.exports = {
  CANCELLATION_REASON, getAdminSchedulePage, previewDoctorScheduleChanges,
  saveDoctorWeeklySchedule, scheduleBlockCoversAppointment
};
