const WEEKDAY_NAMES = {
  "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves",
  "5": "Viernes", "6": "Sábado", "7": "Domingo"
};

function valuesAsArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function validateWeeklySchedule(input = {}) {
  const weekdays = valuesAsArray(input.weekday);
  const starts = valuesAsArray(input.startsAt);
  const ends = valuesAsArray(input.endsAt);
  const count = Math.max(weekdays.length, starts.length, ends.length);
  const blocks = [];
  const errors = {};

  for (let index = 0; index < count; index += 1) {
    const weekday = String(weekdays[index] || "").trim();
    const startsAt = String(starts[index] || "").trim();
    const endsAt = String(ends[index] || "").trim();
    if (!weekday && !startsAt && !endsAt) continue;
    if (!weekday || !startsAt || !endsAt) {
      errors.blocks = "Completa el día, la hora de inicio y la hora de fin de cada bloque.";
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(WEEKDAY_NAMES, weekday)) {
      errors.blocks = "Selecciona un día válido para cada bloque.";
      continue;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endsAt)) {
      errors.blocks = "Ingresa horas válidas para cada bloque.";
      continue;
    }
    const startMinute = Number(startsAt.slice(0, 2)) * 60 + Number(startsAt.slice(3, 5));
    const endMinute = Number(endsAt.slice(0, 2)) * 60 + Number(endsAt.slice(3, 5));
    if (startMinute % 30 !== 0 || endMinute % 30 !== 0) {
      errors.blocks = "Las horas deben alinearse a intervalos de 30 minutos.";
      continue;
    }
    if (startMinute >= endMinute) {
      errors.blocks = "La hora de fin debe ser posterior a la hora de inicio y el bloque no puede cruzar medianoche.";
      continue;
    }
    blocks.push({ weekday: Number(weekday), weekdayLabel: WEEKDAY_NAMES[weekday], startsAt, endsAt });
  }

  if (!blocks.length && !errors.blocks) errors.blocks = "Agrega al menos un bloque de disponibilidad.";
  const ordered = [...blocks].sort((left, right) =>
    left.weekday - right.weekday || left.startsAt.localeCompare(right.startsAt)
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous.weekday === current.weekday && current.startsAt < previous.endsAt) {
      errors.blocks = "Los bloques de un mismo día no pueden superponerse.";
      break;
    }
  }

  return {
    values: { blocks: ordered },
    errors,
    isValid: Object.keys(errors).length === 0
  };
}

module.exports = { WEEKDAY_NAMES, validateWeeklySchedule };
