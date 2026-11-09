require("dotenv").config();

const { Sequelize } = require("sequelize");
const migration = require("../src/database/migrations/202611090001-create-patient-registration-tables");
const { createDatabaseConnection } = require("../src/config/database");

async function run() {
  const sequelize = createDatabaseConnection();
  if (!sequelize) throw new Error("Configura DB_NAME, DB_USER y DB_PASSWORD antes de ejecutar migraciones.");

  try {
    await sequelize.authenticate();
    await sequelize.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME(3) NOT NULL)"
    );
    const [applied] = await sequelize.query(
      "SELECT name FROM schema_migrations WHERE name = :name",
      { replacements: { name: "202611090001-create-patient-registration-tables" }, type: Sequelize.QueryTypes.SELECT }
    );
    if (applied) {
      console.log("No hay migraciones pendientes.");
      return;
    }

    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await sequelize.query(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (:name, NOW(3))",
      { replacements: { name: "202611090001-create-patient-registration-tables" } }
    );
    console.log("Migración de registro de paciente aplicada.");
  } finally {
    await sequelize.close();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

