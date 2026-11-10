module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.addColumn("users", "pending_email", {
      type: DataTypes.STRING(254),
      allowNull: true
    });
    await queryInterface.addIndex("users", ["pending_email"], {
      unique: true,
      name: "users_pending_email_unique"
    });
    await queryInterface.changeColumn("account_tokens", "purpose", {
      type: DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET", "EMAIL_CHANGE"),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "DELETE notification_outbox FROM notification_outbox INNER JOIN account_tokens ON account_tokens.id = notification_outbox.account_token_id WHERE account_tokens.purpose = 'EMAIL_CHANGE'"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM account_tokens WHERE purpose = 'EMAIL_CHANGE'"
    );
    await queryInterface.changeColumn("account_tokens", "purpose", {
      type: Sequelize.DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET"),
      allowNull: false
    });
    await queryInterface.removeIndex("users", "users_pending_email_unique");
    await queryInterface.removeColumn("users", "pending_email");
  }
};
