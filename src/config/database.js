const { Sequelize } = require("sequelize");

function createDatabaseConnection(environment = process.env) {
  const requiredVariables = ["DB_NAME", "DB_USER", "DB_PASSWORD"];
  const hasDatabaseSettings = requiredVariables.every((key) => environment[key] !== undefined);

  if (!hasDatabaseSettings) {
    return null;
  }

  return new Sequelize(environment.DB_NAME, environment.DB_USER, environment.DB_PASSWORD, {
    host: environment.DB_HOST || "localhost",
    port: Number(environment.DB_PORT) || 3306,
    dialect: "mysql",
    logging: environment.NODE_ENV === "development" ? console.log : false
  });
}

module.exports = { createDatabaseConnection };

