module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.changeColumn("users", "email", {
      type: DataTypes.STRING(300),
      allowNull: false
    });
    await queryInterface.changeColumn("users", "pending_email", {
      type: DataTypes.STRING(300),
      allowNull: true
    });
    await queryInterface.changeColumn("notification_outbox", "recipient", {
      type: DataTypes.STRING(300),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.changeColumn("notification_outbox", "recipient", {
      type: DataTypes.STRING(254),
      allowNull: false
    });
    await queryInterface.changeColumn("users", "pending_email", {
      type: DataTypes.STRING(254),
      allowNull: true
    });
    await queryInterface.changeColumn("users", "email", {
      type: DataTypes.STRING(254),
      allowNull: false
    });
  }
};
