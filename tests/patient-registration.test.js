const { validatePatientRegistration, getAge } = require("../src/modules/auth/validators/patient-registration");
const { hashPassword, normalizeRegistration, registerPatient } = require("../src/modules/auth/services/patient-registration");

const today = new Date("2026-11-09T12:00:00");

function validInput(overrides = {}) {
  return {
    firstName: "Daniela",
    lastName: "Pérez",
    documentType: "CC",
    documentNumber: "123456789",
    dateOfBirth: "2000-06-15",
    email: "daniela@example.com",
    phone: "+57 300 123 4567",
    password: "clave-segura-1",
    passwordConfirmation: "clave-segura-1",
    privacyAccepted: "on",
    ...overrides
  };
}

describe("patient registration validation", () => {
  test("accepts a valid adult registration", () => {
    expect(validatePatientRegistration(validInput(), today).isValid).toBe(true);
  });

  test("requires the patient to have turned 18", () => {
    expect(getAge("2008-11-10", today)).toBe(17);
    expect(validatePatientRegistration(validInput({ dateOfBirth: "2008-11-10" }), today).errors.dateOfBirth)
      .toMatch(/18 años/);
  });

  test("rejects invalid dates, email, phone, password and missing consent", () => {
    const result = validatePatientRegistration(validInput({
      dateOfBirth: "2000-02-30",
      email: "not-an-email",
      phone: "abc",
      password: "short",
      passwordConfirmation: "different",
      privacyAccepted: undefined
    }), today);

    expect(result.isValid).toBe(false);
    expect(result.errors.dateOfBirth).toBeDefined();
    expect(result.errors.email).toBeDefined();
    expect(result.errors.phone).toBeDefined();
    expect(result.errors.password).toBeDefined();
    expect(result.errors.passwordConfirmation).toBeDefined();
    expect(result.errors.privacyAccepted).toBeDefined();
  });

  test("normalizes document and email without changing the password", () => {
    const normalized = normalizeRegistration(validInput({
      documentNumber: " ab 123 ",
      email: " PATIENT@EXAMPLE.COM "
    }));
    expect(normalized.documentNumber).toBe("AB123");
    expect(normalized.email).toBe("patient@example.com");
    expect(normalized.password).toBe("clave-segura-1");
  });

  test("stores a salted password hash rather than the original password", async () => {
    const hash = await hashPassword("clave-segura-1");
    expect(hash).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(hash).not.toContain("clave-segura-1");
  });

  test("creates a pending account and patient profile in one transaction", async () => {
    const transaction = { id: "transaction" };
    const user = { id: 42 };
    const User = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(user)
    };
    const Patient = { create: jest.fn().mockResolvedValue({}) };
    const sequelize = { transaction: jest.fn((callback) => callback(transaction)) };

    const result = await registerPatient({
      sequelize,
      models: { User, Patient },
      input: validInput(),
      now: today
    });

    expect(result).toEqual({ ok: true });
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      role: "PATIENT",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
      passwordHash: expect.stringMatching(/^scrypt\$/)
    }), { transaction });
    expect(Patient.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: user.id,
      dateOfBirth: "2000-06-15"
    }), { transaction });
  });
});

