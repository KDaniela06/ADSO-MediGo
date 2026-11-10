module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.createTable("specialties", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(500), allowNull: true },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });

    await queryInterface.createTable("doctors", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      specialty_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "specialties", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      professional_registration: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      professional_description: { type: DataTypes.TEXT, allowNull: true },
      profile_photo_url: { type: DataTypes.STRING(2048), allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });

    await queryInterface.createTable("appointments", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      patient_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      doctor_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "doctors", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      specialty_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "specialties", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      starts_at: { type: DataTypes.DATE(3), allowNull: false },
      ends_at: { type: DataTypes.DATE(3), allowNull: false },
      status: {
        type: DataTypes.ENUM("CONFIRMED", "IN_PROGRESS", "ATTENDED", "CANCELLED", "NO_SHOW"),
        allowNull: false,
        defaultValue: "CONFIRMED"
      },
      created_by_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      cancelled_at: { type: DataTypes.DATE(3), allowNull: true },
      cancellation_reason: { type: DataTypes.STRING(255), allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addIndex("appointments", ["doctor_id", "starts_at", "status"], {
      name: "appointments_doctor_start_status_idx"
    });
    await queryInterface.addIndex("appointments", ["patient_id", "starts_at", "status"], {
      name: "appointments_patient_start_status_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("appointments");
    await queryInterface.dropTable("doctors");
    await queryInterface.dropTable("specialties");
  }
};
