const DOCUMENT_TYPES = new Set(["CC", "CE", "PASSPORT"]);
const { isValidPhone } = require("../../phone");

function validateDoctorRegistration(input = {}) {
  const values = {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    documentType: String(input.documentType || "").trim().toUpperCase(),
    documentNumber: String(input.documentNumber || "").trim().replace(/\s+/g, "").toUpperCase(),
    email: String(input.email || "").trim().toLowerCase(),
    phone: String(input.phone || "").trim(),
    specialtyId: String(input.specialtyId || "").trim(),
    professionalRegistration: String(input.professionalRegistration || "").trim().toUpperCase()
  };
  const errors = {};
  for (const field of ["firstName", "lastName", "documentType", "documentNumber", "email", "phone", "specialtyId", "professionalRegistration"]) {
    if (!values[field]) errors[field] = "Este campo es obligatorio.";
  }
  for (const [field, length] of [["firstName", 100], ["lastName", 100], ["documentNumber", 10], ["email", 300], ["professionalRegistration", 80]]) {
    if (values[field].length > length) errors[field] = `Este campo no puede superar ${length} caracteres.`;
  }
  if (values.documentType && !DOCUMENT_TYPES.has(values.documentType)) errors.documentType = "Selecciona un tipo de documento válido.";
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Ingresa un correo electrónico válido.";
  if (values.phone && !isValidPhone(values.phone)) errors.phone = "Ingresa un teléfono válido.";
  if (values.specialtyId && !/^\d+$/.test(values.specialtyId)) errors.specialtyId = "Selecciona una especialidad válida.";
  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateDoctorRegistration };
