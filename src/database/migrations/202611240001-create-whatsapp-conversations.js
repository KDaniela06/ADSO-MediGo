module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable("whatsapp_conversations", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      patient_id: {
        type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true,
        references: { model: "patients", key: "id" }, onDelete: "CASCADE"
      },
      state: { type: DataTypes.STRING(40), allowNull: false },
      context_json: { type: DataTypes.JSON, allowNull: true },
      last_activity_at: { type: DataTypes.DATE(3), allowNull: false },
      expires_at: { type: DataTypes.DATE(3), allowNull: false },
      last_message_id: { type: DataTypes.STRING(160), allowNull: true, unique: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addIndex("whatsapp_conversations", ["expires_at"], { name: "whatsapp_conversations_expires_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("whatsapp_conversations");
  }
};
