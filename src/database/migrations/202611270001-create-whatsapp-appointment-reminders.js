module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable("whatsapp_appointment_reminders", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      appointment_id: {
        type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true,
        references: { model: "appointments", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE"
      },
      scheduled_at: { type: DataTypes.DATE(3), allowNull: false },
      status: {
        type: DataTypes.ENUM("PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"),
        allowNull: false, defaultValue: "PENDING"
      },
      sent_at: { type: DataTypes.DATE(3), allowNull: true },
      attempt_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      last_attempt_at: { type: DataTypes.DATE(3), allowNull: true },
      provider_message_id: { type: DataTypes.STRING(160), allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addIndex(
      "whatsapp_appointment_reminders",
      ["status", "scheduled_at"],
      { name: "whatsapp_appointment_reminders_due" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("whatsapp_appointment_reminders");
  }
};
