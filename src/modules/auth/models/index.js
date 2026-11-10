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
    city: { type: DataTypes.STRING(100), allowNull: true },
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

  const Specialty = sequelize.define("Specialty", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(500), allowNull: true },
    status: { type: DataTypes.ENUM("ACTIVE", "INACTIVE"), allowNull: false, defaultValue: "ACTIVE" }
  }, { tableName: "specialties", underscored: true });

  const Doctor = sequelize.define("Doctor", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true,
      field: "user_id", references: { model: "users", key: "id" }
    },
    specialtyId: {
      type: DataTypes.BIGINT.UNSIGNED, allowNull: false,
      field: "specialty_id", references: { model: "specialties", key: "id" }
    },
    professionalRegistration: { type: DataTypes.STRING(80), allowNull: false, unique: true, field: "professional_registration" },
    professionalDescription: { type: DataTypes.TEXT, allowNull: true, field: "professional_description" },
    profilePhotoUrl: { type: DataTypes.STRING(2048), allowNull: true, field: "profile_photo_url" }
  }, { tableName: "doctors", underscored: true });

  const Appointment = sequelize.define("Appointment", {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    patientId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "patient_id" },
    doctorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "doctor_id" },
    specialtyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "specialty_id" },
    startsAt: { type: DataTypes.DATE(3), allowNull: false, field: "starts_at" },
    endsAt: { type: DataTypes.DATE(3), allowNull: false, field: "ends_at" },
    status: {
      type: DataTypes.ENUM("CONFIRMED", "IN_PROGRESS", "ATTENDED", "CANCELLED", "NO_SHOW"),
      allowNull: false, defaultValue: "CONFIRMED"
    },
    createdByUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: "created_by_user_id" },
    cancelledAt: { type: DataTypes.DATE(3), allowNull: true, field: "cancelled_at" },
    cancellationReason: { type: DataTypes.STRING(255), allowNull: true, field: "cancellation_reason" }
  }, { tableName: "appointments", underscored: true });

  User.hasOne(Patient, { foreignKey: "userId", as: "patient" });
  Patient.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasOne(Doctor, { foreignKey: "userId", as: "doctor" });
  Doctor.belongsTo(User, { foreignKey: "userId", as: "user" });
  Specialty.hasMany(Doctor, { foreignKey: "specialtyId", as: "doctors" });
  Doctor.belongsTo(Specialty, { foreignKey: "specialtyId", as: "specialty" });
  Patient.hasMany(Appointment, { foreignKey: "patientId", as: "appointments" });
  Doctor.hasMany(Appointment, { foreignKey: "doctorId", as: "appointments" });
  Specialty.hasMany(Appointment, { foreignKey: "specialtyId", as: "appointments" });
  Appointment.belongsTo(Patient, { foreignKey: "patientId", as: "patient" });
  Appointment.belongsTo(Doctor, { foreignKey: "doctorId", as: "doctor" });
  Appointment.belongsTo(Specialty, { foreignKey: "specialtyId", as: "specialty" });
  User.hasMany(AccountToken, { foreignKey: "userId", as: "accountTokens" });
  AccountToken.belongsTo(User, { foreignKey: "userId", as: "user" });
  AccountToken.hasOne(NotificationOutbox, { foreignKey: "accountTokenId", as: "notification" });
  NotificationOutbox.belongsTo(AccountToken, { foreignKey: "accountTokenId", as: "accountToken" });

  return { User, Patient, Doctor, Specialty, Appointment, AccountToken, NotificationOutbox };
}

module.exports = { initializeAuthModels };

