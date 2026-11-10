const WEEKDAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TIME_ZONE = "America/Bogota";

function plain(record) {
  return record && typeof record.get === "function" ? record.get({ plain: true }) : record;
}

function todayInBogota(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getDoctorSchedule({ models, userId, now = new Date() }) {
  if (!models?.Doctor) return { status: "unavailable", blocks: [] };
  try {
    const doctor = plain(await models.Doctor.findOne({ where: { userId }, attributes: ["id"] }));
    if (!doctor) return { status: "not_found", blocks: [] };
    if (!models.DoctorWeeklySchedule || !models.DoctorWeeklyScheduleBlock) {
      return { status: "not_configured", blocks: [] };
    }

    const schedules = await models.DoctorWeeklySchedule.findAll({
      where: { doctorId: doctor.id, status: "ACTIVE" },
      include: [{
        model: models.DoctorWeeklyScheduleBlock,
        as: "blocks",
        attributes: ["weekday", "startsAt", "endsAt"],
        required: false
      }],
      order: [["effectiveFrom", "DESC"]]
    });
    const today = todayInBogota(now);
    const active = schedules.map(plain).filter((schedule) =>
      String(schedule.effectiveFrom).slice(0, 10) <= today &&
      (!schedule.effectiveTo || String(schedule.effectiveTo).slice(0, 10) >= today)
    );
    const schedule = active[0];
    if (!schedule) return { status: "empty", blocks: [] };

    const blocks = (schedule.blocks || [])
      .map(plain)
      .filter((block) => Number(block.weekday) >= 1 && Number(block.weekday) <= 7)
      .map((block) => ({
        weekday: Number(block.weekday),
        weekdayLabel: WEEKDAYS[Number(block.weekday)],
        startsAt: String(block.startsAt || "").slice(0, 5),
        endsAt: String(block.endsAt || "").slice(0, 5)
      }))
      .sort((left, right) => left.weekday - right.weekday || left.startsAt.localeCompare(right.startsAt));
    return { status: blocks.length ? "ready" : "empty", blocks };
  } catch {
    return { status: "error", blocks: [] };
  }
}

module.exports = { getDoctorSchedule, todayInBogota };
