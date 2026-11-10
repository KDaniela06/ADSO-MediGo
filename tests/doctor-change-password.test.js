const { changeDoctorPassword } = require("../src/modules/doctor/services/change-password");
const { verifyPassword } = require("../src/modules/auth/services/authentication");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

const transaction = { LOCK: { UPDATE: "UPDATE" } };
const now = new Date("2026-11-10T12:00:00.000Z");

function makeSetup(overrides = {}) {
  const user = {
    id: 8,
    role: "DOCTOR",
    status: "ACTIVE",
    emailVerifiedAt: now,
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

describe("doctor change password", () => {
  test("updates the password after verifying the current one without changing the role", async () => {
    const { user, models, sequelize } = makeSetup({ passwordHash: await hashPassword("old-password-123") });

    await expect(changeDoctorPassword({
      sequelize, models, userId: 8,
      currentPassword: "old-password-123", newPassword: "new-password-456", now
    })).resolves.toEqual({ status: "changed" });

    expect(await verifyPassword("new-password-456", user.passwordHash)).toBe(true);
    expect(user.role).toBe("DOCTOR");
    expect(user.save).toHaveBeenCalledWith({ transaction });
    expect(models.AccountToken.update).toHaveBeenCalledWith(
      { usedAt: now },
      { where: { userId: 8, purpose: "PASSWORD_RESET", usedAt: null }, transaction }
    );
  });

  test("rejects an incorrect current password without saving", async () => {
    const { user, models, sequelize } = makeSetup({ passwordHash: await hashPassword("old-password-123") });
    const originalHash = user.passwordHash;

    await expect(changeDoctorPassword({
      sequelize, models, userId: 8,
      currentPassword: "wrong-password", newPassword: "new-password-456", now
    })).resolves.toEqual({ status: "current_password_invalid" });

    expect(user.passwordHash).toBe(originalHash);
    expect(user.save).not.toHaveBeenCalled();
    expect(models.AccountToken.update).not.toHaveBeenCalled();
  });

  test("rejects other roles and inactive accounts", async () => {
    for (const overrides of [{ role: "PATIENT" }, { status: "DISABLED" }]) {
      const { user, models, sequelize } = makeSetup({
        passwordHash: await hashPassword("old-password-123"), ...overrides
      });
      await expect(changeDoctorPassword({
        sequelize, models, userId: 8,
        currentPassword: "old-password-123", newPassword: "new-password-456", now
      })).resolves.toEqual({ status: "unavailable" });
      expect(user.save).not.toHaveBeenCalled();
    }
  });
});
