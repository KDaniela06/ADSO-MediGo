function validateDoctorAccountSetup(input = {}) {
  const values = {
    password: String(input.password || ""),
    passwordConfirmation: String(input.passwordConfirmation || "")
  };
  const errors = {};
  if (!values.password) errors.password = "Este campo es obligatorio.";
  else if (values.password.length < 8) errors.password = "La contraseña debe tener al menos 8 caracteres.";
  if (values.passwordConfirmation !== values.password) errors.passwordConfirmation = "Las contraseñas no coinciden.";
  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateDoctorAccountSetup };
