const DOCUMENT_TYPES = new Set(["CC", "CE", "PASSPORT"]);

function getAge(dateOfBirth, today = new Date()) {
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return -1;

  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function validatePatientRegistration(input, today = new Date()) {
  const values = {
    firstName: String(input.firstName || "").trim(),
    lastName: String(input.lastName || "").trim(),
    documentType: String(input.documentType || "").trim(),
    documentNumber: String(input.documentNumber || "").trim(),
    dateOfBirth: String(input.dateOfBirth || "").trim(),
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    password: String(input.password || ""),
    passwordConfirmation: String(input.passwordConfirmation || ""),
    privacyAccepted: input.privacyAccepted === "on" || input.privacyAccepted === true
  };
  const errors = {};

  for (const field of ["firstName", "lastName", "documentType", "documentNumber", "dateOfBirth", "email", "phone", "password", "passwordConfirmation"]) {
    if (!values[field]) errors[field] = "Este campo es obligatorio.";
  }
  for (const [field, maxLength] of [["firstName", 100], ["lastName", 100], ["documentNumber", 30], ["email", 254], ["phone", 30]]) {
    if (values[field].length > maxLength) errors[field] = `Este campo no puede superar ${maxLength} caracteres.`;
  }
  if (values.documentType && !DOCUMENT_TYPES.has(values.documentType)) {
    errors.documentType = "Selecciona un tipo de documento válido.";
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Ingresa un correo electrónico válido.";
  }
  if (values.phone && (!/^\+?[0-9\s().-]{7,30}$/.test(values.phone) || values.phone.replace(/\D/g, "").length < 7)) {
    errors.phone = "Ingresa un teléfono válido.";
  }
  if (values.dateOfBirth) {
    const parsedDate = new Date(`${values.dateOfBirth}T00:00:00`);
    const isExactDate = !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === values.dateOfBirth;
    const age = isExactDate ? getAge(values.dateOfBirth, today) : -1;
    if (age < 0) errors.dateOfBirth = "Ingresa una fecha válida.";
    else if (age < 18) errors.dateOfBirth = "Debes tener al menos 18 años para registrarte.";
  }
  if (values.password && values.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres.";
  }
  if (values.passwordConfirmation && values.password !== values.passwordConfirmation) {
    errors.passwordConfirmation = "Las contraseñas no coinciden.";
  }
  if (!values.privacyAccepted) errors.privacyAccepted = "Debes aceptar los términos y la política de privacidad.";

  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { getAge, validatePatientRegistration };

