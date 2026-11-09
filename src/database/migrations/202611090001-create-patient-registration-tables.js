module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable("users", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      document_type: { type: DataTypes.ENUM("CC", "CE", "PASSPORT"), allowNull: false },
      document_number: { type: DataTypes.STRING(30), allowNull: false },
      first_name: { type: DataTypes.STRING(100), allowNull: false },
      last_name: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
      phone: { type: DataTypes.STRING(30), allowNull: false },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.ENUM("PATIENT", "DOCTOR", "ADMIN"), allowNull: false },
      status: { type: DataTypes.ENUM("PENDING_VERIFICATION", "ACTIVE", "INACTIVE"), allowNull: false },
      email_verified_at: { type: DataTypes.DATE(3), allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
    await queryInterface.addIndex("users", ["document_type", "document_number"], { unique: true, name: "users_document_unique" });

    await queryInterface.createTable("patients", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      date_of_birth: { type: DataTypes.DATEONLY, allowNull: false },
      terms_accepted_at: { type: DataTypes.DATE(3), allowNull: false },
      terms_version: { type: DataTypes.STRING(32), allowNull: false },
      privacy_accepted_at: { type: DataTypes.DATE(3), allowNull: false },
      privacy_version: { type: DataTypes.STRING(32), allowNull: false },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });

    await queryInterface.createTable("account_tokens", {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      purpose: { type: DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET"), allowNull: false },
      token_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE(3), allowNull: false },
      used_at: { type: DataTypes.DATE(3), allowNull: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("account_tokens");
    await queryInterface.dropTable("patients");
    await queryInterface.dropTable("users");
  }
};

