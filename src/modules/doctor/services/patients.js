const TIME_ZONE = "America/Bogota";

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO");
}

function doctorIdFor(models, userId) {
  return models.Doctor.findOne({ where: { userId }, attributes: ["id"] });
}

function appointmentIncludes(models, patientId) {
  const patient = {
    model: models.Patient,
    as: "patient",
    attributes: ["id", "city"],
    required: true
  };
  if (patientId) patient.where = { id: patientId };
  if (models.User) {
    patient.include = [{
      model: models.User,
      as: "user",
      attributes: ["firstName", "lastName", "documentType", "documentNumber", "phone"]
    }];
  }
  return [patient];
}

function presentPatient(patientRecord, appointments) {
  const patient = plain(patientRecord);
  const user = plain(patient?.user) || {};
  const sorted = appointments
    .map(plain)
    .filter((appointment) => appointment.startsAt)
    .sort((left, right) => new Date(right.startsAt) - new Date(left.startsAt));
  const lastAppointment = sorted[0];
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Paciente";

  return {
    id: patient.id,
    name,
    documentType: user.documentType || null,
    documentNumber: user.documentNumber || null,
    phone: user.phone || null,
    city: patient.city || null,
    appointmentCount: appointments.length,
    lastAppointment: lastAppointment ? {
      date: new Intl.DateTimeFormat("es-CO", {
        timeZone: TIME_ZONE, dateStyle: "medium"
      }).format(new Date(lastAppointment.startsAt)),
      status: lastAppointment.status
    } : null
  };
}

async function getDoctorPatients({ models, userId, search = "" }) {
  if (!models?.Doctor || !models?.Patient || !models?.Appointment) {
    return { status: "empty", search, patients: [] };
  }

  try {
    const doctorRecord = await doctorIdFor(models, userId);
    const doctor = plain(doctorRecord);
    if (!doctor) return { status: "empty", search, patients: [] };

    const records = await models.Appointment.findAll({
      where: { doctorId: doctor.id },
      attributes: ["id", "patientId", "startsAt", "status"],
      include: appointmentIncludes(models),
      order: [["startsAt", "DESC"]]
    });
    const byPatient = new Map();
    for (const source of records) {
      const appointment = plain(source);
      const patient = plain(appointment.patient);
      if (!patient) continue;
      if (!byPatient.has(String(patient.id))) {
        byPatient.set(String(patient.id), { patient, appointments: [] });
      }
      byPatient.get(String(patient.id)).appointments.push(appointment);
    }

    const normalizedSearch = normalizeSearch(search);
    const patients = Array.from(byPatient.values())
      .map(({ patient, appointments }) => presentPatient(patient, appointments))
      .filter((patient) => {
        if (!normalizedSearch) return true;
        const haystack = normalizeSearch([
          patient.name, patient.documentType, patient.documentNumber, patient.phone, patient.city
        ].filter(Boolean).join(" "));
        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => left.name.localeCompare(right.name, "es"));

    return { status: "ready", search, patients };
  } catch {
    return { status: "error", search, patients: [] };
  }
}

async function getDoctorPatient({ models, userId, patientId }) {
  if (!models?.Doctor || !models?.Patient || !models?.Appointment) {
    return { status: "unavailable" };
  }
  if (!/^\d+$/.test(String(patientId || ""))) return { status: "not_found" };

  try {
    const doctor = plain(await doctorIdFor(models, userId));
    if (!doctor) return { status: "not_found" };
    const records = await models.Appointment.findAll({
      where: { doctorId: doctor.id },
      attributes: ["id", "patientId", "startsAt", "status"],
      include: appointmentIncludes(models, patientId),
      order: [["startsAt", "DESC"]]
    });
    if (!records.length) return { status: "not_found" };
    const appointments = records.map(plain);
    const patient = plain(appointments[0].patient);
    return {
      status: "ready",
      patient: presentPatient(patient, appointments)
    };
  } catch {
    return { status: "error" };
  }
}

module.exports = {
  getDoctorPatient,
  getDoctorPatients,
  normalizeSearch
};
