const express = require("express");
const path = require("node:path");
const webRoutes = require("./routes/web");

function createApp() {
  const app = express();

  app.set("view engine", "pug");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(webRoutes);

  return app;
}

module.exports = { createApp };

