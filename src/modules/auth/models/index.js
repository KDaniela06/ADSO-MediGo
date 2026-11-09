function initializeAuthModels(sequelize) {
  const { DataTypes } = require("sequelize");

  const User = sequelize.define("User", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    documentType: { type: DataTypes.ENUM("CC", "CE", "PASSPORT"), allowNull: false, field: "document_type" },
    documentNumber: { type: DataTypes.STRING(30), allowNull: false, field: "document_number" },
    firstName: { type: DataTypes.STRING(100), allowNull: false, field: "first_name" },
    lastName: { type: DataTypes.STRING(100), allowNull: false, field: "last_name" },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: "password_hash" },
    role: { type: DataTypes.ENUM("PATIENT", "DOCTOR", "ADMIN"), allowNull: false },
    status: { type: DataTypes.ENUM("PENDING_VERIFICATION", "ACTIVE", "INACTIVE"), allowNull: false },
    emailVerifiedAt: { type: DataTypes.DATE(3), allowNull: true, field: "email_verified_at" }
  }, {
    tableName: "users",
    underscored: true,
    indexes: [{ unique: true, fields: ["document_type", "document_number"] }]
  });

  const Patient = sequelize.define("Patient", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: "user_id",
      references: { model: "users", key: "id" }
    },
    dateOfBirth: { type: DataTypes.DATEONLY, allowNull: false, field: "date_of_birth" },
    termsAcceptedAt: { type: DataTypes.DATE(3), allowNull: false, field: "terms_accepted_at" },
    termsVersion: { type: DataTypes.STRING(32), allowNull: false, field: "terms_version" },
    privacyAcceptedAt: { type: DataTypes.DATE(3), allowNull: false, field: "privacy_accepted_at" },
    privacyVersion: { type: DataTypes.STRING(32), allowNull: false, field: "privacy_version" }
  }, { tableName: "patients", underscored: true });

  const AccountToken = sequelize.define("AccountToken", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "user_id",
      references: { model: "users", key: "id" }
    },
    purpose: { type: DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET"), allowNull: false },
    tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true, field: "token_hash" },
    expiresAt: { type: DataTypes.DATE(3), allowNull: false, field: "expires_at" },
    usedAt: { type: DataTypes.DATE(3), allowNull: true, field: "used_at" }
  }, { tableName: "account_tokens", underscored: true });

  User.hasOne(Patient, { foreignKey: "userId", as: "patient" });
  Patient.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasMany(AccountToken, { foreignKey: "userId", as: "accountTokens" });
  AccountToken.belongsTo(User, { foreignKey: "userId", as: "user" });

  return { User, Patient, AccountToken };
}

module.exports = { initializeAuthModels };

