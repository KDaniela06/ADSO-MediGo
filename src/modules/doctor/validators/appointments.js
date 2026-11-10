const { APPOINTMENT_STATUSES, parseBogotaDate } = require("../services/appointments");

function validateAppointmentFilters(input = {}) {
  const values = {
    date: typeof input.date === "string" ? input.date.trim() : "",
    status: typeof input.status === "string" ? input.status.trim() : ""
  };
  const errors = {};
  if (values.date && !parseBogotaDate(values.date)) errors.date = "Ingresa una fecha válida.";
  if (values.status && !APPOINTMENT_STATUSES.includes(values.status)) {
    errors.status = "Selecciona un estado válido.";
  }
  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateAppointmentFilters };
