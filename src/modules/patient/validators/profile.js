function validatePatientProfile(input) {
  const values = {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    phone: String(input.phone || "").trim(),
    city: String(input.city || "").trim(),
    email: String(input.email || "").trim().toLowerCase()
  };
  const errors = {};

  for (const field of ["firstName", "lastName", "phone", "email"]) {
    if (!values[field]) errors[field] = "Este campo es obligatorio.";
  }
  for (const [field, maxLength] of [["firstName", 100], ["lastName", 100], ["phone", 30], ["email", 254], ["city", 100]]) {
    if (values[field].length > maxLength) {
      errors[field] = `Este campo no puede superar ${maxLength} caracteres.`;
    }
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Ingresa un correo electrónico válido.";
  }
  if (values.phone && (!/^\+?[0-9\s().-]{7,30}$/.test(values.phone) || values.phone.replace(/\D/g, "").length < 7)) {
    errors.phone = "Ingresa un teléfono válido.";
  }

  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validatePatientProfile };
