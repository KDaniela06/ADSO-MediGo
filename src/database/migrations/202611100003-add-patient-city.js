module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("patients", "city", {
      type: Sequelize.DataTypes.STRING(100),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("patients", "city");
  }
};
