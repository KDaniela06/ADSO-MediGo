const { Op } = require("sequelize");

const ACTIVE_APPOINTMENT_STATUSES = ["CONFIRMED", "IN_PROGRESS"];

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

async function getPatientDashboard({ models, userId, now = new Date() }) {
  if (!models?.Patient || !models?.Appointment) {
    return { status: "empty", appointment: null };
  }

  try {
    const patient = plain(await models.Patient.findOne({ where: { userId } }));
    if (!patient) return { status: "error", appointment: null };

    const include = [];
    if (models.Doctor) {
      const doctorInclude = models.User
        ? [{ model: models.User, as: "user", attributes: ["firstName", "lastName"] }]
        : [];
      include.push({ model: models.Doctor, as: "doctor", include: doctorInclude });
    }
    if (models.Specialty) include.push({ model: models.Specialty, as: "specialty" });

    const appointmentRecord = await models.Appointment.findOne({
      where: {
        patientId: patient.id,
        startsAt: { [Op.gte]: now },
        status: ACTIVE_APPOINTMENT_STATUSES
      },
      include,
      order: [["startsAt", "ASC"]]
    });
    if (!appointmentRecord) return { status: "empty", appointment: null };

    const record = plain(appointmentRecord);
    const doctor = plain(record.doctor);
    const specialty = plain(record.specialty);
    const doctorUser = plain(doctor?.user);
    const startsAt = new Date(record.startsAt);
    if (!Number.isFinite(startsAt.getTime())) return { status: "error", appointment: null };

    return {
      status: "ready",
      appointment: {
        doctorName: [doctorUser?.firstName, doctorUser?.lastName].filter(Boolean).join(" ") || "Médico asignado",
        specialtyName: specialty?.name || "Especialidad asignada",
        date: new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota", weekday: "short", day: "2-digit", month: "short"
        }).format(startsAt),
        time: new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: true
        }).format(startsAt),
        status: record.status === "IN_PROGRESS" ? "En curso" : "Confirmada"
      }
    };
  } catch {
    return { status: "error", appointment: null };
  }
}

module.exports = { ACTIVE_APPOINTMENT_STATUSES, getPatientDashboard };
