const express = require("express");
const path = require("node:path");
const homeRoutes = require("./modules/home/routes");
const { createAuthRouter } = require("./modules/auth/routes");
const { initializeAuthModels } = require("./modules/auth/models");
const { createDatabaseConnection } = require("./config/database");
const patientRoutes = require("./modules/patient/routes");
const doctorRoutes = require("./modules/doctor/routes");
const adminRoutes = require("./modules/admin/routes");

function createApp({ sequelize: providedSequelize } = {}) {
  const app = express();
  const sequelize = providedSequelize || createDatabaseConnection();
  const authModels = sequelize ? initializeAuthModels(sequelize) : null;

  app.set("view engine", "pug");
  app.set("views", [path.join(__dirname, "modules"), path.join(__dirname, "views")]);
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(homeRoutes);
  app.use(createAuthRouter({ sequelize, models: authModels }));
  app.use(patientRoutes);
  app.use(doctorRoutes);
  app.use(adminRoutes);

  return app;
}

module.exports = { createApp };

