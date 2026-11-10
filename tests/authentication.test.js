const { authenticatePatient, verifyPassword } = require("../src/modules/auth/services/authentication");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("patient authentication", () => {
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await hashPassword("secure-password-123");
  });

  test("verifies a stored scrypt password hash", async () => {
    await expect(verifyPassword("secure-password-123", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("another-password", passwordHash)).resolves.toBe(false);
  });

  test("admits only active patients with a verified email", async () => {
    const user = {
      id: 19,
      firstName: "Ana",
      lastName: "Gómez",
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordHash
    };
    const models = { User: { findOne: jest.fn().mockResolvedValue(user) } };

    await expect(authenticatePatient({
      models,
      email: " ANA@EXAMPLE.COM ",
      password: "secure-password-123"
    })).resolves.toEqual({
      id: 19,
      firstName: "Ana",
      lastName: "Gómez",
      role: "PATIENT"
    });
    expect(models.User.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "ana@example.com" }
    }));

    for (const changes of [
      { status: "PENDING_VERIFICATION", emailVerifiedAt: null },
      { status: "INACTIVE" },
      { role: "DOCTOR" }
    ]) {
      models.User.findOne.mockResolvedValueOnce({ ...user, ...changes });
      await expect(authenticatePatient({
        models,
        email: "ana@example.com",
        password: "secure-password-123"
      })).resolves.toBeNull();
    }
  });

  test("returns the same result for an unknown account and a wrong password", async () => {
    const models = { User: { findOne: jest.fn().mockResolvedValue(null) } };
    await expect(authenticatePatient({
      models,
      email: "unknown@example.com",
      password: "secure-password-123"
    })).resolves.toBeNull();

    models.User.findOne.mockResolvedValue({
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordHash
    });
    await expect(authenticatePatient({
      models,
      email: "known@example.com",
      password: "wrong-password"
    })).resolves.toBeNull();
  });
});
