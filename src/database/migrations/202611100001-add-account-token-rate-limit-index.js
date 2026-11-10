module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("account_tokens", ["user_id", "purpose", "created_at"], {
      name: "account_tokens_rate_limit_idx"
    });
    const { DataTypes } = Sequelize;
    await queryInterface.createTable("notification_outbox", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      account_token_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: "account_tokens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      recipient: { type: DataTypes.STRING(254), allowNull: false },
      notification_type: { type: DataTypes.STRING(64), allowNull: false },
      channel: { type: DataTypes.ENUM("EMAIL", "WHATSAPP"), allowNull: false },
      status: { type: DataTypes.ENUM("PENDING", "SENT", "FAILED"), allowNull: false },
      attempts: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      sent_at: { type: DataTypes.DATE(3), allowNull: true },
      last_error: { type: DataTypes.STRING(100), allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notification_outbox");
    await queryInterface.removeIndex("account_tokens", "account_tokens_rate_limit_idx");
  }
};

