const { changePatientPassword } = require("../src/modules/patient/services/change-password");
const { verifyPassword } = require("../src/modules/auth/services/authentication");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");
const { validatePatientPasswordChange } = require("../src/modules/patient/validators/change-password");

const transaction = { LOCK: { UPDATE: "UPDATE" } };

function makeSetup(overrides = {}) {
  const user = {
    id: 7,
    role: "PATIENT",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
    passwordHash: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
  const models = {
    User: { findByPk: jest.fn().mockResolvedValue(user) },
    AccountToken: { update: jest.fn().mockResolvedValue([1]) }
  };
  const sequelize = { transaction: jest.fn((callback) => callback(transaction)) };
  return { user, models, sequelize };
}

describe("patient change password", () => {
  test("validates current password, minimum length and confirmation", () => {
    expect(validatePatientPasswordChange({
      currentPassword: "old-password",
      newPassword: "new-password",
      passwordConfirmation: "new-password"
    }).isValid).toBe(true);

    const invalid = validatePatientPasswordChange({
      currentPassword: "",
      newPassword: "short",
      passwordConfirmation: "different"
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.currentPassword).toBeTruthy();
    expect(invalid.errors.newPassword).toBeTruthy();
    expect(invalid.errors.passwordConfirmation).toBeTruthy();
  });

  test("changes the password after checking the current one", async () => {
    const oldPassword = "old-password-123";
    const { user, models, sequelize } = makeSetup({ passwordHash: await hashPassword(oldPassword) });

    await expect(changePatientPassword({
      sequelize, models, userId: 7,
      currentPassword: oldPassword, newPassword: "new-password-456"
    })).resolves.toEqual({ status: "changed" });

    expect(user.passwordHash).not.toBe(oldPassword);
    expect(await verifyPassword("new-password-456", user.passwordHash)).toBe(true);
    expect(await verifyPassword(oldPassword, user.passwordHash)).toBe(false);
    expect(user.save).toHaveBeenCalledWith({ transaction });
    expect(models.AccountToken.update).toHaveBeenCalledWith(
      { usedAt: expect.any(Date) },
      { where: { userId: 7, purpose: "PASSWORD_RESET", usedAt: null }, transaction }
    );
  });

  test("does not change the password when the current password is incorrect", async () => {
    const { user, models, sequelize } = makeSetup({ passwordHash: await hashPassword("old-password-123") });
    const originalHash = user.passwordHash;

    await expect(changePatientPassword({
      sequelize, models, userId: 7,
      currentPassword: "incorrect-password", newPassword: "new-password-456"
    })).resolves.toEqual({ status: "current_password_invalid" });

    expect(user.passwordHash).toBe(originalHash);
    expect(user.save).not.toHaveBeenCalled();
    expect(models.AccountToken.update).not.toHaveBeenCalled();
  });

  test("only allows active verified patients", async () => {
    const { user, models, sequelize } = makeSetup({ role: "DOCTOR" });

    await expect(changePatientPassword({
      sequelize, models, userId: 7,
      currentPassword: "old-password-123", newPassword: "new-password-456"
    })).resolves.toEqual({ status: "unavailable" });

    expect(user.save).not.toHaveBeenCalled();
  });
});
