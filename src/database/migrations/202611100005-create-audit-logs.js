module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable("audit_logs", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      actor_user_id: {
        type: DataTypes.BIGINT.UNSIGNED, allowNull: true,
        references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL"
      },
      action: { type: DataTypes.STRING(80), allowNull: false },
      entity_type: { type: DataTypes.STRING(60), allowNull: false },
      entity_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      before_data: { type: DataTypes.JSON, allowNull: true },
      after_data: { type: DataTypes.JSON, allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      request_id: { type: DataTypes.STRING(64), allowNull: true }
    });
    await queryInterface.addIndex("audit_logs", ["entity_type", "entity_id", "created_at"], {
      name: "audit_logs_entity_date"
    });
    await queryInterface.addIndex("audit_logs", ["actor_user_id", "created_at"], {
      name: "audit_logs_actor_date"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
  }
};
