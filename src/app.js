const express = require("express");
const path = require("node:path");
const homeRoutes = require("./modules/home/routes");
const { createAuthRouter } = require("./modules/auth/routes");
const { initializeAuthModels } = require("./modules/auth/models");
const { createEmailSender } = require("./modules/auth/services/email-sender");
const { createDatabaseConnection } = require("./config/database");
const { createSessionMiddleware, csrfSynchronisedProtection, generateToken } = require("./config/session");
const { createPatientRouter } = require("./modules/patient/routes");
const { createDoctorRouter } = require("./modules/doctor/routes");
const { createAdminRouter } = require("./modules/admin/routes");

const patientNavigationItems = [
  { id: "home", label: "Inicio", href: "/paciente", icon: "home" },
  { id: "booking", label: "Reservar cita", href: "/citas/reservar", icon: "calendar" },
  { id: "appointments", label: "Mis citas", href: "/mis-citas", icon: "appointments" },
  { id: "history", label: "Historial", href: "/historial", icon: "history" },
  { id: "profile", label: "Mi perfil", href: "/perfil", icon: "profile" },
  { id: "whatsapp", label: "WhatsApp", href: "/whatsapp/vincular", icon: "whatsapp" }
];

function getPatientActivePage(request) {
  const currentPath = request.path;

  if (currentPath === "/paciente") return "home";
  if (currentPath.startsWith("/citas/reservar")) return "booking";
  if (currentPath === "/historial") return "history";
  if (currentPath === "/mis-citas" && request.query.filtro === "anteriores") return "history";
  if (currentPath === "/mis-citas" || currentPath.startsWith("/citas/")) return "appointments";
  if (currentPath === "/perfil" || currentPath === "/cambiar-contrasena") return "profile";
  if (currentPath.startsWith("/whatsapp/")) return "whatsapp";

  return "";
}

function createApp({
  sequelize: providedSequelize,
  models: providedModels,
  emailSender: providedEmailSender,
  sessionStore
} = {}) {
  const app = express();
  const sequelize = providedSequelize || createDatabaseConnection();
  const authModels = providedModels || (sequelize ? initializeAuthModels(sequelize) : null);
  const emailSender = providedEmailSender || createEmailSender();

  app.set("view engine", "pug");
  app.set("views", [path.join(__dirname, "modules"), path.join(__dirname, "views")]);
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(createSessionMiddleware({ environment: process.env, store: sessionStore }));
  app.use(csrfSynchronisedProtection);
  app.use((request, response, next) => {
    response.locals.csrfToken = generateToken(request);
    response.locals.activePatientPage = getPatientActivePage(request);
    response.locals.patientNavigationItems = patientNavigationItems;
    next();
  });

  app.use(homeRoutes);
  app.use(createAuthRouter({ sequelize, models: authModels, emailSender }));
  app.use(createPatientRouter({ sequelize, models: authModels, emailSender }));
  app.use(createDoctorRouter({ sequelize, models: authModels }));
  app.use(createAdminRouter({ sequelize, models: authModels, emailSender }));

  app.use((error, request, response, next) => {
    if (error.code !== "EBADCSRFTOKEN") return next(error);
    return response.status(403).render("auth/views/access-denied", {
      title: "No se pudo validar la solicitud",
      message: "El formulario venció o no pudo validarse. Recarga la página e inténtalo de nuevo."
    });
  });

  return app;
}

module.exports = { createApp };
