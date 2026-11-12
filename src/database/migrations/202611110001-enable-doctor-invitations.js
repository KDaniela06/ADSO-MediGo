module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.changeColumn("users", "password_hash", {
      type: DataTypes.STRING(255), allowNull: true
    });
    await queryInterface.addColumn("users", "password_configured_at", {
      type: DataTypes.DATE(3), allowNull: true
    });
    await queryInterface.changeColumn("account_tokens", "purpose", {
      type: DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET", "EMAIL_CHANGE", "DOCTOR_INVITATION"),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    const [users] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS total FROM users WHERE password_hash IS NULL"
    );
    const [tokens] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS total FROM account_tokens WHERE purpose = 'DOCTOR_INVITATION'"
    );
    if (Number(users[0]?.total) > 0 || Number(tokens[0]?.total) > 0) {
      throw new Error("No se puede revertir mientras existan invitaciones médicas con cuentas o tokens asociados.");
    }
    const { DataTypes } = Sequelize;
    await queryInterface.changeColumn("account_tokens", "purpose", {
      type: DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET", "EMAIL_CHANGE"),
      allowNull: false
    });
    await queryInterface.removeColumn("users", "password_configured_at");
    await queryInterface.changeColumn("users", "password_hash", {
      type: DataTypes.STRING(255), allowNull: false
    });
  }
};
