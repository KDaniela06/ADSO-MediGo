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
const { createWhatsAppWebhookRouter } = require("./modules/whatsapp/routes");

const appNavigationItems = {
  PATIENT: [
    { id: "patient-home", label: "Inicio", href: "/paciente" },
    { id: "patient-appointments", label: "Mis citas", href: "/mis-citas" },
    { id: "patient-profile", label: "Mi perfil", href: "/perfil" },
    { id: "patient-whatsapp", label: "WhatsApp", href: "/whatsapp/vincular" }
  ],
  DOCTOR: [
    { id: "doctor-home", label: "Inicio", href: "/medico" },
    { id: "doctor-appointments", label: "Mis citas", href: "/medico/citas" },
    { id: "doctor-patients", label: "Mis pacientes", href: "/medico/pacientes" },
    { id: "doctor-schedule", label: "Mi agenda", href: "/medico/agenda" },
    { id: "doctor-profile", label: "Mi perfil", href: "/medico/perfil" }
  ],
  ADMIN: [
    { id: "admin-home", label: "Inicio", href: "/administrador" },
    { id: "admin-appointments", label: "Citas", href: "/administrador/citas" },
    { id: "admin-patients", label: "Pacientes", href: "/administrador/pacientes" },
    { id: "admin-doctors", label: "Médicos", href: "/administrador/medicos" },
    { id: "admin-specialties", label: "Especialidades", href: "/administrador/especialidades" },
    { id: "admin-schedules", label: "Horarios", href: "/administrador/horarios" },
    { id: "admin-exceptions", label: "Excepciones de agenda", href: "/administrador/excepciones" },
    { id: "admin-account", label: "Mi cuenta", href: "/administrador/mi-cuenta" }
  ]
};

function getActiveAppNavigationItem(request) {
  const currentPath = request.path;

  if (currentPath === "/paciente") return "patient-home";
  if (currentPath.startsWith("/citas/reservar")) return "patient-booking";
  if (currentPath === "/historial" || (currentPath === "/mis-citas" && request.query.filtro === "anteriores")) return "patient-history";
  if (currentPath === "/mis-citas" || currentPath.startsWith("/citas/")) return "patient-appointments";
  if (currentPath === "/perfil" || currentPath === "/cambiar-contrasena") return "patient-profile";
  if (currentPath.startsWith("/whatsapp/")) return "patient-whatsapp";
  if (currentPath === "/medico") return "doctor-home";
  if (currentPath.startsWith("/medico/citas")) return "doctor-appointments";
  if (currentPath.startsWith("/medico/pacientes")) return "doctor-patients";
  if (currentPath.startsWith("/medico/agenda")) return "doctor-schedule";
  if (currentPath === "/medico/perfil" || currentPath === "/medico/cambiar-contrasena") return "doctor-profile";
  if (currentPath === "/administrador") return "admin-home";
  if (currentPath.startsWith("/administrador/citas")) return "admin-appointments";
  if (currentPath.startsWith("/administrador/pacientes")) return "admin-patients";
  if (currentPath.startsWith("/administrador/medicos")) return "admin-doctors";
  if (currentPath.startsWith("/administrador/especialidades")) return "admin-specialties";
  if (currentPath.startsWith("/administrador/horarios")) return "admin-schedules";
  if (currentPath.startsWith("/administrador/excepciones")) return "admin-exceptions";
  if (currentPath.startsWith("/administrador/mi-cuenta") || currentPath === "/administrador/cambiar-contrasena") return "admin-account";
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
  app.locals.appNavigationItems = appNavigationItems;
  app.locals.activeAppNavigationItem = "";
  app.use("/webhooks/whatsapp", createWhatsAppWebhookRouter({ models: authModels, sequelize, emailSender }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(createSessionMiddleware({ environment: process.env, store: sessionStore }));
  app.use(csrfSynchronisedProtection);
  app.use((request, response, next) => {
    response.locals.csrfToken = generateToken(request);
    response.locals.activeAppNavigationItem = getActiveAppNavigationItem(request);
    response.locals.appNavigationItems = appNavigationItems;
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

module.exports = { appNavigationItems, createApp, getActiveAppNavigationItem };
