const { createHash } = require("node:crypto");
const { validateDoctorRegistration } = require("../src/modules/admin/validators/doctor");
const { createDoctorInvitation } = require("../src/modules/admin/services/doctors");
const { configureDoctorAccount, getDoctorInvitationStatus, hashToken } = require("../src/modules/auth/services/doctor-invitation");

function validInput(overrides = {}) {
  return {
    firstName: "Laura",
    lastName: "Gómez",
    documentType: "CC",
    documentNumber: " 12 345 ",
    email: " LAURA@EXAMPLE.COM ",
    phone: "+57 300 123 4567",
    specialtyId: "4",
    professionalRegistration: "reg-123",
    ...overrides
  };
}

describe("doctor registration", () => {
  test("validates and normalizes required personal and professional fields", () => {
    const result = validateDoctorRegistration(validInput());
    expect(result.isValid).toBe(true);
    expect(result.values).toMatchObject({ documentNumber: "12345", email: "laura@example.com", professionalRegistration: "REG-123" });
  });

  test("rejects invalid email, phone, document type, specialty and long registration", () => {
    const result = validateDoctorRegistration(validInput({
      documentType: "OTHER", email: "mal-correo", phone: "abc",
      specialtyId: "x", professionalRegistration: "r".repeat(81)
    }));
    expect(result.errors).toEqual(expect.objectContaining({
      documentType: expect.any(String), email: expect.any(String), phone: expect.any(String),
      specialtyId: expect.any(String), professionalRegistration: expect.any(String)
    }));
  });

  test("creates a doctor without a password and stores only a one-use token hash", async () => {
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const user = { id: 12 };
    const tokenRow = { id: 40 };
    const specialty = { id: 4, status: "ACTIVE" };
    const User = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(user)
    };
    const Doctor = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 22 })
    };
    const AccountToken = { create: jest.fn().mockResolvedValue(tokenRow) };
    const NotificationOutbox = { create: jest.fn().mockResolvedValue({ id: 55 }), update: jest.fn().mockResolvedValue([1]) };
    const Specialty = { findByPk: jest.fn().mockResolvedValue(specialty) };
    const models = { User, Doctor, AccountToken, NotificationOutbox, Specialty };
    const sequelize = { transaction: (callback) => callback(transaction) };
    const sendDoctorInvitationEmail = jest.fn().mockResolvedValue(undefined);

    const result = await createDoctorInvitation({
      sequelize, models, input: validInput(), actorUserId: 9,
      emailSender: { sendDoctorInvitationEmail }, baseUrl: "https://medigo.example"
    });

    expect(result).toEqual({ status: "created", deliveryFailed: false });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "laura@example.com", role: "DOCTOR", status: "PENDING_VERIFICATION",
      passwordHash: null, passwordConfiguredAt: null, emailVerifiedAt: null
    }), { transaction });
    expect(Doctor.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 12, specialtyId: 4, professionalRegistration: "REG-123"
    }), { transaction });
    const savedToken = AccountToken.create.mock.calls[0][0];
    expect(savedToken).toMatchObject({ userId: 12, purpose: "DOCTOR_INVITATION", usedAt: null });
    expect(savedToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedToken.tokenHash).not.toBe(sendDoctorInvitationEmail.mock.calls[0][0].url.split("/").pop());
    expect(sendDoctorInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "laura@example.com", expiresInHours: 24, url: expect.stringContaining("/invitacion-medico/")
    }));
  });

  test("refuses a specialty that is no longer active", async () => {
    const result = await createDoctorInvitation({
      sequelize: { transaction: (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }) },
      models: {
        User: { findOne: jest.fn() }, Doctor: { findOne: jest.fn() },
        Specialty: { findByPk: jest.fn().mockResolvedValue({ id: 4, status: "INACTIVE" }) },
        AccountToken: {}, NotificationOutbox: {}
      },
      input: validInput(), emailSender: null, baseUrl: "https://medigo.example"
    });
    expect(result).toEqual({ status: "specialty_unavailable" });
  });
});

describe("doctor invitation setup", () => {
  test("activates the account once and records the configuration date", async () => {
    const now = new Date("2026-11-11T12:00:00Z");
    const token = "secure-random-token";
    const accountToken = { userId: 12, expiresAt: new Date(now.getTime() + 1000), usedAt: null, save: jest.fn() };
    const user = {
      id: 12, role: "DOCTOR", status: "PENDING_VERIFICATION", passwordHash: null,
      save: jest.fn()
    };
    const models = {
      AccountToken: { findOne: jest.fn().mockResolvedValue(accountToken) },
      User: { findByPk: jest.fn().mockResolvedValue(user) }
    };
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const sequelize = { transaction: (callback) => callback(transaction) };

    expect(await getDoctorInvitationStatus({ models, token, now })).toEqual({ status: "ready", firstName: undefined });
    const result = await configureDoctorAccount({ sequelize, models, token, password: "password-seguro", now });

    expect(result).toEqual({ status: "configured" });
    expect(accountToken.usedAt).toEqual(now);
    expect(accountToken.save).toHaveBeenCalledWith({ transaction });
    expect(user).toMatchObject({
      role: "DOCTOR", status: "ACTIVE", emailVerifiedAt: now, passwordConfiguredAt: now,
      passwordHash: expect.stringMatching(/^scrypt\\$/)
    });
    expect(user.passwordHash).not.toContain("password-seguro");
    expect(user.save).toHaveBeenCalledWith({ transaction });
  });

  test("reports used and expired links without allowing a second setup", async () => {
    const token = "one-use-token";
    const now = new Date("2026-11-11T12:00:00Z");
    const used = { userId: 12, usedAt: new Date(), expiresAt: new Date(now.getTime() + 1000) };
    const models = { AccountToken: { findOne: jest.fn().mockResolvedValue(used) }, User: { findByPk: jest.fn() } };
    expect(await getDoctorInvitationStatus({ models, token, now })).toEqual({ status: "used" });
    const expired = { ...used, usedAt: null, expiresAt: new Date(now.getTime() - 1000) };
    models.AccountToken.findOne.mockResolvedValue(expired);
    expect(await getDoctorInvitationStatus({ models, token, now })).toEqual({ status: "expired" });
  });
});
