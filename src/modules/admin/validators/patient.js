function validateAdminPatient(input = {}) {
  const values = {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    phone: String(input.phone || "").trim(),
    city: String(input.city || "").trim()
  };
  const errors = {};
  for (const field of ["firstName", "lastName"]) {
    if (!values[field]) errors[field] = "Este campo es obligatorio.";
    else if (values[field].length > 100) errors[field] = "Usa máximo 100 caracteres.";
  }
  if (!values.phone) errors.phone = "El teléfono es obligatorio.";
  else if (!/^[+]?[0-9 ()-]{7,30}$/.test(values.phone)) errors.phone = "Ingresa un teléfono válido.";
  if (values.city.length > 100) errors.city = "Usa máximo 100 caracteres.";
  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateAdminPatient };
