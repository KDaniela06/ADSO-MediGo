const { Op } = require("sequelize");

const TIME_ZONE = "America/Bogota";
const WEEKDAYS = [
  { key: "Mon", label: "Lun" },
  { key: "Tue", label: "Mar" },
  { key: "Wed", label: "Mié" },
  { key: "Thu", label: "Jue" },
  { key: "Fri", label: "Vie" },
  { key: "Sat", label: "Sáb" },
  { key: "Sun", label: "Dom" }
];

function bogotaDayStart(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 5));
}

function emptyDashboard(status = "empty") {
  return {
    status,
    counts: { patients: 0, activeDoctors: 0, appointmentsToday: 0, attendedToday: 0 },
    weeklyAppointments: WEEKDAYS.map((day) => ({ ...day, count: 0 })),
    weeklyScale: 1,
    hasActivity: false
  };
}

async function getAdminDashboard({ models, now = new Date() }) {
  if (!models?.Patient?.count || !models?.User?.count || !models?.Appointment?.count) {
    return emptyDashboard("unavailable");
  }

  try {
    const todayStart = bogotaDayStart(now);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart);
    const weekday = (new Date(todayStart).getUTCDay() + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - weekday);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [patients, activeDoctors, appointmentsToday, attendedToday, records] = await Promise.all([
      models.Patient.count(),
      models.User.count({ where: { role: "DOCTOR", status: "ACTIVE" } }),
      models.Appointment.count({
        where: { startsAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart } }
      }),
      models.Appointment.count({
        where: {
          startsAt: { [Op.gte]: todayStart, [Op.lt]: tomorrowStart },
          status: "ATTENDED"
        }
      }),
      models.Appointment.findAll({
        attributes: ["startsAt"],
        where: { startsAt: { [Op.gte]: weekStart, [Op.lt]: weekEnd } }
      })
    ]);

    const byDay = new Map(WEEKDAYS.map((day) => [day.key, 0]));
    for (const record of records) {
      const startsAt = typeof record?.get === "function"
        ? record.get("startsAt")
        : record.startsAt;
      const key = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE, weekday: "short"
      }).format(new Date(startsAt));
      if (byDay.has(key)) byDay.set(key, byDay.get(key) + 1);
    }
    const weeklyAppointments = WEEKDAYS.map((day) => ({ ...day, count: byDay.get(day.key) }));
    const weeklyScale = Math.max(1, ...weeklyAppointments.map((day) => day.count));
    const counts = { patients, activeDoctors, appointmentsToday, attendedToday };
    const hasActivity = Object.values(counts).some((count) => count > 0)
      || weeklyAppointments.some((day) => day.count > 0);
    return {
      status: hasActivity ? "ready" : "empty",
      counts,
      weeklyAppointments,
      weeklyScale,
      hasActivity
    };
  } catch {
    return emptyDashboard("error");
  }
}

module.exports = { bogotaDayStart, getAdminDashboard };
