const { Op } = require("sequelize");

const ACTIVE_APPOINTMENT_STATUSES = ["CONFIRMED", "IN_PROGRESS"];
const TIME_ZONE = "America/Bogota";

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function getBogotaDayRange(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return {
    start: new Date(Date.UTC(year, month - 1, day, 5)),
    end: new Date(Date.UTC(year, month - 1, day + 1, 5))
  };
}

function patientName(appointment) {
  const patient = plain(appointment.patient);
  const user = plain(patient?.user);
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Paciente asignado";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true
  }).format(new Date(value));
}

function withPatient(models) {
  if (!models.Patient) return [];
  const patientInclude = models.User
    ? [{ model: models.User, as: "user", attributes: ["firstName", "lastName"] }]
    : [];
  return [{ model: models.Patient, as: "patient", include: patientInclude }];
}

async function getDoctorDashboard({ models, userId, now = new Date() }) {
  if (!models?.Doctor || !models?.Appointment) {
    return { status: "empty", counts: { today: 0, inProgress: 0, attended: 0 }, appointments: [], nextAppointment: null };
  }

  try {
    const doctor = plain(await models.Doctor.findOne({ where: { userId } }));
    if (!doctor) return { status: "error", counts: { today: 0, inProgress: 0, attended: 0 }, appointments: [], nextAppointment: null };

    const range = getBogotaDayRange(now);
    const include = withPatient(models);
    const todayRecords = await models.Appointment.findAll({
      where: { doctorId: doctor.id, startsAt: { [Op.gte]: range.start, [Op.lt]: range.end } },
      include,
      order: [["startsAt", "ASC"]]
    });
    const nextRecord = await models.Appointment.findOne({
      where: {
        doctorId: doctor.id,
        startsAt: { [Op.gte]: now },
        status: ACTIVE_APPOINTMENT_STATUSES
      },
      include,
      order: [["startsAt", "ASC"]]
    });
    const records = todayRecords.map(plain);
    const next = plain(nextRecord);

    return {
      status: "ready",
      counts: {
        today: records.length,
        inProgress: records.filter((item) => item.status === "IN_PROGRESS").length,
        attended: records.filter((item) => item.status === "ATTENDED").length
      },
      appointments: records.map((item) => ({
        patientName: patientName(item),
        time: formatTime(item.startsAt),
        status: item.status
      })),
      nextAppointment: next ? {
        patientName: patientName(next),
        time: formatTime(next.startsAt),
        status: next.status
      } : null
    };
  } catch {
    return { status: "error", counts: { today: 0, inProgress: 0, attended: 0 }, appointments: [], nextAppointment: null };
  }
}

module.exports = { ACTIVE_APPOINTMENT_STATUSES, getBogotaDayRange, getDoctorDashboard };
