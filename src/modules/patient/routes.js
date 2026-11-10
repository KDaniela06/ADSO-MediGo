const { Router } = require("express");
const { requireAuthenticatedUser, requireRole } = require("../auth/middleware/authorization");
const { validatePatientProfile } = require("./validators/profile");
const { confirmPatientEmailChange, getPatientProfile, updatePatientProfile } = require("./services/profile");

function createPatientRouter({ sequelize = null, models, emailSender = null } = {}) {
  const router = Router();

  router.get(
    "/paciente",
    requireAuthenticatedUser({ models }),
    requireRole("PATIENT"),
    (request, response) => {
      response.set("Cache-Control", "no-store");
      return response.render("patient/views/dashboard", { title: "Mi espacio MediGo" });
    }
  );

  return router;
}

module.exports = { createPatientRouter };
