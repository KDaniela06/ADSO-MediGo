function initializeAuthModels(sequelize) {
  const { DataTypes } = require("sequelize");

  const User = sequelize.define("User", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    documentType: { type: DataTypes.ENUM("CC", "CE", "PASSPORT"), allowNull: false, field: "document_type" },
    documentNumber: { type: DataTypes.STRING(30), allowNull: false, field: "document_number" },
    firstName: { type: DataTypes.STRING(100), allowNull: false, field: "first_name" },
    lastName: { type: DataTypes.STRING(100), allowNull: false, field: "last_name" },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    pendingEmail: { type: DataTypes.STRING(254), allowNull: true, unique: true, field: "pending_email" },
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
    purpose: { type: DataTypes.ENUM("EMAIL_VERIFICATION", "PASSWORD_RESET", "EMAIL_CHANGE"), allowNull: false },
    tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true, field: "token_hash" },
    expiresAt: { type: DataTypes.DATE(3), allowNull: false, field: "expires_at" },
    usedAt: { type: DataTypes.DATE(3), allowNull: true, field: "used_at" }
  }, { tableName: "account_tokens", underscored: true });

  const NotificationOutbox = sequelize.define("NotificationOutbox", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    accountTokenId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: "account_token_id",
      references: { model: "account_tokens", key: "id" }
    },
    recipient: { type: DataTypes.STRING(254), allowNull: false },
    notificationType: { type: DataTypes.STRING(64), allowNull: false, field: "notification_type" },
    channel: { type: DataTypes.ENUM("EMAIL", "WHATSAPP"), allowNull: false },
    status: { type: DataTypes.ENUM("PENDING", "SENT", "FAILED"), allowNull: false },
    attempts: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    sentAt: { type: DataTypes.DATE(3), allowNull: true, field: "sent_at" },
    lastError: { type: DataTypes.STRING(100), allowNull: true, field: "last_error" }
  }, { tableName: "notification_outbox", underscored: true });

  User.hasOne(Patient, { foreignKey: "userId", as: "patient" });
  Patient.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasMany(AccountToken, { foreignKey: "userId", as: "accountTokens" });
  AccountToken.belongsTo(User, { foreignKey: "userId", as: "user" });
  AccountToken.hasOne(NotificationOutbox, { foreignKey: "accountTokenId", as: "notification" });
  NotificationOutbox.belongsTo(AccountToken, { foreignKey: "accountTokenId", as: "accountToken" });

  return { User, Patient, AccountToken, NotificationOutbox };
}

module.exports = { initializeAuthModels };

