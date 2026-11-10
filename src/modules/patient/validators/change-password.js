const { validatePasswordChange } = require("../../auth/validators/change-password");

function validatePatientPasswordChange(input) {
  return validatePasswordChange(input);
}

module.exports = { validatePatientPasswordChange };
