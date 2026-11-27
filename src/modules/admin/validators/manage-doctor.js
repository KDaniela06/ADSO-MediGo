function validateAdminDoctor(input = {}) {
  const values = {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    phone: String(input.phone || "").trim(),
    professionalRegistration: String(input.professionalRegistration || "").trim().toUpperCase(),
    specialtyId: String(input.specialtyId || "").trim()
  };
  const errors = {};
  for (const field of Object.keys(values)) {
    if (!values[field]) errors[field] = "Este campo es obligatorio.";
  }
  for (const [field, max] of [["firstName", 100], ["lastName", 100], ["phone", 10], ["professionalRegistration", 80]]) {
    if (values[field].length > max) errors[field] = `Este campo no puede superar ${max} caracteres.`;
  }
  if (values.phone && !/^\d{7,10}$/.test(values.phone)) {
    errors.phone = "Ingresa un teléfono válido.";
  }
  if (values.specialtyId && !/^\d+$/.test(values.specialtyId)) errors.specialtyId = "Selecciona una especialidad válida.";
  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateAdminDoctor };
