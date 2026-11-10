function validatePatientPasswordChange(input = {}) {
  const values = {
    currentPassword: String(input.currentPassword || ""),
    newPassword: String(input.newPassword || ""),
    passwordConfirmation: String(input.passwordConfirmation || "")
  };
  const errors = {};

  if (!values.currentPassword) errors.currentPassword = "Escribe tu contraseña actual.";
  if (values.newPassword.length < 8) errors.newPassword = "La nueva contraseña debe tener al menos 8 caracteres.";
  if (values.passwordConfirmation !== values.newPassword) {
    errors.passwordConfirmation = "La confirmación no coincide con la nueva contraseña.";
  }

  return { values, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validatePatientPasswordChange };
