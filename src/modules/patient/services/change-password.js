const { changeAccountPassword } = require("../../auth/services/change-account-password");

function changePatientPassword(input) {
  return changeAccountPassword({ ...input, role: "PATIENT" });
}

module.exports = { changePatientPassword };
