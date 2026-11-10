const {
  confirmPatientEmailChange,
  getPatientProfile,
  hashToken,
  updatePatientProfile,
  EMAIL_CHANGE_TTL_MS
} = require("../src/modules/patient/services/profile");
const { validatePatientProfile } = require("../src/modules/patient/validators/profile");

const now = new Date("2026-11-10T12:00:00.000Z");
const transaction = { LOCK: { UPDATE: "UPDATE" } };

function makeSequelize() {
  return { transaction: jest.fn((callback) => callback(transaction)) };
}

function makeModels(userOverrides = {}) {
  const user = {
    id: 7,
    role: "PATIENT",
    status: "ACTIVE",
    email: "ana@example.com",
    pendingEmail: null,
    firstName: "Ana",
    lastName: "Gómez",
    phone: "+573001112233",
    emailVerifiedAt: now,
    save: jest.fn().mockResolvedValue(undefined),
    ...userOverrides
  };
  const patient = {
    dateOfBirth: "1995-05-01",
    city: "Bogotá",
    save: jest.fn().mockResolvedValue(undefined)
  };
  const AccountToken = {
    create: jest.fn().mockResolvedValue({ id: 15 }),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue([1])
  };
  const NotificationOutbox = {
    create: jest.fn().mockResolvedValue({ id: 18 }),
    update: jest.fn().mockResolvedValue([1])
  };
  return {
    user,
    patient,
    models: {
      User: {
        findByPk: jest.fn().mockResolvedValue(user),
        findOne: jest.fn().mockResolvedValue(null)
      },
      Patient: { findOne: jest.fn().mockResolvedValue(patient) },
      AccountToken,
      NotificationOutbox
    }
  };
}

describe("patient profile", () => {
  test("validates editable contact fields and rejects malformed values", () => {
    expect(validatePatientProfile({
      firstName: " Ana ",
      lastName: " Gómez ",
      phone: "+573001112233",
      email: " ANA@EXAMPLE.COM "
    })).toMatchObject({
      isValid: true,
      values: {
        firstName: "Ana",
        lastName: "Gómez",
        email: "ana@example.com"
      }
    });

    const invalid = validatePatientProfile({
      firstName: "",
      lastName: "Gómez",
      phone: "abc",
      email: "bad-email"
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.firstName).toBeTruthy();
    expect(invalid.errors.phone).toBeTruthy();
    expect(invalid.errors.email).toBeTruthy();
  });

  test("loads only the signed-in patient's own profile and date of birth", async () => {
    const { models } = makeModels();
    const profile = await getPatientProfile({ models, userId: 7 });

    expect(models.User.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7, role: "PATIENT", status: "ACTIVE" }
    }));
    expect(models.Patient.findOne).toHaveBeenCalledWith({
      where: { userId: 7 },
      attributes: ["dateOfBirth"]
    });
    expect(profile).toMatchObject({
      email: "ana@example.com",
      documentNumber: undefined,
      dateOfBirth: "1995-05-01",
      city: "Bogotá"
    });
  });

  test("updates contact details while preserving identification and pending email", async () => {
    const { models, user, patient } = makeModels({ pendingEmail: "ana.new@example.com" });
    const result = await updatePatientProfile({
      sequelize: makeSequelize(),
      models,
      userId: 7,
      input: {
        firstName: "Ana María",
        lastName: "Gómez",
        phone: "+573009998877",
        email: "ana@example.com",
        city: "Medellín"
      },
      emailSender: null,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "saved" });
    expect(user.firstName).toBe("Ana María");
    expect(user.phone).toBe("+573009998877");
    expect(patient.city).toBe("Medellín");
    expect(patient.save).toHaveBeenCalledWith({ transaction });
    expect(user.pendingEmail).toBe("ana.new@example.com");
    expect(user.documentNumber).toBeUndefined();
    expect(models.AccountToken.update).not.toHaveBeenCalled();
    expect(user.save).toHaveBeenCalledWith({ transaction });
  });

  test("sends a hashed one-use confirmation link for a new email", async () => {
    const { models, user } = makeModels();
    const emailSender = { sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined) };
    const result = await updatePatientProfile({
      sequelize: makeSequelize(),
      models,
      userId: 7,
      input: {
        firstName: "Ana",
        lastName: "Gómez",
        phone: "+573001112233",
        email: "ANA.NEW@example.com",
        city: "Bogotá"
      },
      emailSender,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "verification_pending", deliveryFailed: false });
    expect(user.email).toBe("ana@example.com");
    expect(user.pendingEmail).toBe("ana.new@example.com");
    const tokenRecord = models.AccountToken.create.mock.calls[0][0];
    expect(tokenRecord.purpose).toBe("EMAIL_CHANGE");
    expect(tokenRecord.expiresAt.getTime()).toBe(now.getTime() + EMAIL_CHANGE_TTL_MS);
    expect(tokenRecord.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const url = new URL(emailSender.sendEmailChangeVerification.mock.calls[0][0].url);
    const rawToken = url.pathname.split("/").at(-1);
    expect(tokenRecord.tokenHash).toBe(hashToken(rawToken));
    expect(tokenRecord.tokenHash).not.toBe(rawToken);
    expect(models.NotificationOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      recipient: "ana.new@example.com",
      notificationType: "EMAIL_CHANGE"
    }), { transaction });
  });

  test("rejects a new email already used or reserved by another account", async () => {
    const { models, user } = makeModels();
    models.User.findOne.mockResolvedValue({ id: 99 });
    const result = await updatePatientProfile({
      sequelize: makeSequelize(),
      models,
      userId: 7,
      input: {
        firstName: "Ana",
        lastName: "Gómez",
        phone: "+573001112233",
        email: "other@example.com"
      },
      emailSender: null,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "email_in_use" });
    expect(user.save).not.toHaveBeenCalled();
    expect(models.AccountToken.create).not.toHaveBeenCalled();
  });

  test("confirms a valid token, changes the email and consumes outstanding links", async () => {
    const accountToken = {
      userId: 7,
      usedAt: null,
      expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MS)
    };
    const { models, user } = makeModels({ pendingEmail: "ana.new@example.com" });
    models.AccountToken.findOne.mockResolvedValue(accountToken);
    const result = await confirmPatientEmailChange({
      sequelize: makeSequelize(), models, token: "email-change-token", now
    });

    expect(result).toEqual({ status: "confirmed" });
    expect(models.AccountToken.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: hashToken("email-change-token"), purpose: "EMAIL_CHANGE" }
    }));
    expect(user.email).toBe("ana.new@example.com");
    expect(user.pendingEmail).toBeNull();
    expect(user.emailVerifiedAt).toBe(now);
    expect(user.save).toHaveBeenCalledWith({ transaction });
    expect(models.AccountToken.update).toHaveBeenCalledWith(
      { usedAt: now },
      { where: { userId: 7, purpose: "EMAIL_CHANGE", usedAt: null }, transaction }
    );
  });

  test("rejects invalid, used and expired email change links", async () => {
    for (const tokenRecord of [
      null,
      { usedAt: now, expiresAt: new Date(now.getTime() + 60_000) },
      { usedAt: null, expiresAt: new Date(now.getTime() - 1) }
    ]) {
      const { models, user } = makeModels({ pendingEmail: "ana.new@example.com" });
      models.AccountToken.findOne.mockResolvedValue(tokenRecord);
      const result = await confirmPatientEmailChange({
        sequelize: makeSequelize(), models, token: "email-change-token", now
      });
      expect(["invalid", "used", "expired"]).toContain(result.status);
      expect(user.save).not.toHaveBeenCalled();
    }
  });
});
