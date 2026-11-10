const { Op } = require("sequelize");
const { getBogotaDayRange } = require("./dashboard");

const APPOINTMENT_STATUSES = ["CONFIRMED", "IN_PROGRESS", "ATTENDED", "CANCELLED", "NO_SHOW"];

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function parseBogotaDate(dateText) {
  if (!dateText) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return undefined;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day
  ) return undefined;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function appointmentIncludes(models) {
  const include = [];
  if (models.Patient) {
    include.push({
      model: models.Patient,
      as: "patient",
      include: models.User
        ? [{ model: models.User, as: "user", attributes: ["firstName", "lastName", "documentType", "documentNumber", "phone"] }]
        : []
    });
  }
  if (models.Specialty) include.push({ model: models.Specialty, as: "specialty", attributes: ["name"] });
  return include;
}

function presentAppointment(record, now) {
  const appointment = plain(record);
  const patient = plain(appointment.patient);
  const patientUser = plain(patient?.user);
  const specialty = plain(appointment.specialty);
  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);
  const canStart = appointment.status === "CONFIRMED"
    && Number.isFinite(startsAt.getTime())
    && Number.isFinite(endsAt.getTime())
    && startsAt.getTime() <= now.getTime()
    && now.getTime() < endsAt.getTime();

  return {
    id: appointment.id,
    patientName: [patientUser?.firstName, patientUser?.lastName].filter(Boolean).join(" ") || "Paciente asignado",
    documentType: patientUser?.documentType || null,
    documentNumber: patientUser?.documentNumber || null,
    phone: patientUser?.phone || null,
    specialty: specialty?.name || "Especialidad no disponible",
    startsAt,
    endsAt,
    date: new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long" }).format(startsAt),
    time: new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: true }).format(startsAt),
    status: appointment.status,
    canStart
  };
}

async function findDoctorId(models, userId) {
  const doctor = plain(await models.Doctor.findOne({ where: { userId } }));
  return doctor?.id || null;
}

async function getDoctorAppointments({ models, userId, filters = {}, now = new Date() }) {
  if (!models?.Doctor || !models?.Appointment) {
    return { status: "empty", appointments: [], filters };
  }
  if (filters.date && !parseBogotaDate(filters.date)) {
    return { status: "invalid", appointments: [], filters };
  }
  if (filters.status && !APPOINTMENT_STATUSES.includes(filters.status)) {
    return { status: "invalid", appointments: [], filters };
  }

  try {
    const doctorId = await findDoctorId(models, userId);
    if (!doctorId) return { status: "empty", appointments: [], filters };

    const where = { doctorId };
    if (filters.date) {
      const range = getBogotaDayRange(parseBogotaDate(filters.date));
      where.startsAt = { [Op.gte]: range.start, [Op.lt]: range.end };
    } else {
      where.startsAt = { [Op.gte]: now };
    }
    if (filters.status) where.status = filters.status;

    const records = await models.Appointment.findAll({
      where,
      include: appointmentIncludes(models),
      order: [["startsAt", "ASC"]]
    });
    return {
      status: "ready",
      filters,
      appointments: records.map((record) => presentAppointment(record, now))
    };
  } catch {
    return { status: "error", appointments: [], filters };
  }
}

async function getDoctorAppointment({ models, userId, appointmentId, now = new Date() }) {
  if (!models?.Doctor || !models?.Appointment) return { status: "unavailable" };
  try {
    const doctorId = await findDoctorId(models, userId);
    if (!doctorId) return { status: "not_found" };
    const record = await models.Appointment.findOne({
      where: { id: appointmentId, doctorId },
      include: appointmentIncludes(models)
    });
    if (!record) return { status: "not_found" };
    return { status: "ready", appointment: presentAppointment(record, now) };
  } catch {
    return { status: "error" };
  }
}

module.exports = {
  APPOINTMENT_STATUSES,
  getDoctorAppointment,
  getDoctorAppointments,
  parseBogotaDate,
  presentAppointment
};
