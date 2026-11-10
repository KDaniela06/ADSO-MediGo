require("dotenv").config();

const { Sequelize } = require("sequelize");
const { createDatabaseConnection } = require("../src/config/database");

const migrations = [
  {
    name: "202611090001-create-patient-registration-tables",
    migration: require("../src/database/migrations/202611090001-create-patient-registration-tables")
  },
  {
    name: "202611100001-add-account-token-rate-limit-index",
    migration: require("../src/database/migrations/202611100001-add-account-token-rate-limit-index")
  }
];

async function run() {
  const sequelize = createDatabaseConnection();
  if (!sequelize) throw new Error("Configura DB_NAME, DB_USER y DB_PASSWORD antes de ejecutar migraciones.");

  try {
    await sequelize.authenticate();
    await sequelize.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME(3) NOT NULL)"
    );
    const queryInterface = sequelize.getQueryInterface();
    let appliedCount = 0;

    for (const { name, migration } of migrations) {
      const [applied] = await sequelize.query(
        "SELECT name FROM schema_migrations WHERE name = :name",
        { replacements: { name }, type: Sequelize.QueryTypes.SELECT }
      );
      if (applied) continue;

      await migration.up(queryInterface, Sequelize);
      await sequelize.query(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (:name, NOW(3))",
        { replacements: { name } }
      );
      console.log(`Migration applied: ${name}`);
      appliedCount += 1;
    }

    if (!appliedCount) console.log("No pending migrations.");
  } finally {
    await sequelize.close();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
