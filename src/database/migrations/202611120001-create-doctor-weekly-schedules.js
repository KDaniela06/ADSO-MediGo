module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await queryInterface.createTable("doctor_weekly_schedules", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      doctor_id: {
        type: DataTypes.BIGINT.UNSIGNED, allowNull: false,
        references: { model: "doctors", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT"
      },
      effective_from: { type: DataTypes.DATEONLY, allowNull: false },
      effective_to: { type: DataTypes.DATEONLY, allowNull: true },
      status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addIndex("doctor_weekly_schedules", ["doctor_id", "status", "effective_from"], {
      name: "doctor_weekly_schedules_current_idx"
    });

    await queryInterface.createTable("doctor_weekly_schedule_blocks", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      schedule_id: {
        type: DataTypes.BIGINT.UNSIGNED, allowNull: false,
        references: { model: "doctor_weekly_schedules", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT"
      },
      weekday: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
      starts_at: { type: DataTypes.TIME, allowNull: false },
      ends_at: { type: DataTypes.TIME, allowNull: false },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addConstraint("doctor_weekly_schedule_blocks", {
      fields: ["schedule_id", "weekday", "starts_at"],
      type: "unique",
      name: "doctor_weekly_schedule_block_unique_start"
    });
    await queryInterface.addIndex("doctor_weekly_schedule_blocks", ["schedule_id", "weekday", "starts_at"], {
      name: "doctor_weekly_schedule_blocks_weekday_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("doctor_weekly_schedule_blocks");
    await queryInterface.dropTable("doctor_weekly_schedules");
  }
};
