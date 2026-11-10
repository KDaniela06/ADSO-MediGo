const { changeAccountPassword } = require("../../auth/services/change-account-password");

function changeDoctorPassword(input) {
  return changeAccountPassword({ ...input, role: "DOCTOR" });
}

module.exports = { changeDoctorPassword };
