const {
  hashToken,
  requestPasswordReset,
  resetPatientPassword,
  TOKEN_TTL_MS
} = require("../src/modules/auth/services/password-reset");

const now = new Date("2026-11-10T12:00:00.000Z");
const transaction = { LOCK: { UPDATE: "UPDATE" } };

function makeModels({ user = { id: 7, email: "patient@example.com", firstName: "Ana", role: "PATIENT", status: "ACTIVE", emailVerifiedAt: now }, count = 0, latestToken = null } = {}) {
  const AccountToken = {
    count: jest.fn().mockResolvedValue(count),
    findOne: jest.fn().mockResolvedValue(latestToken),
    update: jest.fn().mockResolvedValue([1]),
    create: jest.fn().mockImplementation(async (values) => ({ id: 12, ...values }))
  };
  const NotificationOutbox = {
    create: jest.fn().mockResolvedValue({ id: 21 }),
    update: jest.fn().mockResolvedValue([1])
  };
  return {
    User: { findOne: jest.fn().mockResolvedValue(user), findByPk: jest.fn(), save: jest.fn() },
    AccountToken,
    NotificationOutbox
  };
}

function makeSequelize() {
  return { transaction: jest.fn((callback) => callback(transaction)) };
}

describe("patient password reset", () => {
  test("sends a single-use 30-minute link and stores only its hash", async () => {
    const models = makeModels();
    const emailSender = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };

    const result = await requestPasswordReset({
      sequelize: makeSequelize(),
      models,
      email: "PATIENT@example.com",
      emailSender,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "accepted" });
    const created = models.AccountToken.create.mock.calls[0][0];
    expect(created.purpose).toBe("PASSWORD_RESET");
    expect(created.expiresAt.getTime()).toBe(now.getTime() + TOKEN_TTL_MS);
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const sentUrl = new URL(emailSender.sendPasswordResetEmail.mock.calls[0][0].url);
    const rawToken = sentUrl.pathname.split("/").at(-1);
    expect(created.tokenHash).toBe(hashToken(rawToken));
    expect(created.tokenHash).not.toBe(rawToken);
    expect(models.NotificationOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      accountTokenId: 12,
      notificationType: "PASSWORD_RESET",
      status: "PENDING"
    }), { transaction });
  });

  test("returns a neutral result and sends nothing for an unknown account", async () => {
    const models = makeModels({ user: null });
    const emailSender = { sendPasswordResetEmail: jest.fn() };

    await expect(requestPasswordReset({
      sequelize: makeSequelize(), models, email: "unknown@example.com", emailSender,
      baseUrl: "https://medigo.example", now
    })).resolves.toEqual({ status: "accepted" });

    expect(models.AccountToken.create).not.toHaveBeenCalled();
    expect(emailSender.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("enforces both the hourly limit and the 60-second wait", async () => {
    for (const models of [
      makeModels({ count: 5 }),
      makeModels({ count: 1, latestToken: { createdAt: new Date(now.getTime() - 30_000) } })
    ]) {
      const emailSender = { sendPasswordResetEmail: jest.fn() };
      await requestPasswordReset({
        sequelize: makeSequelize(), models, email: "patient@example.com", emailSender,
        baseUrl: "https://medigo.example", now
      });
      expect(models.AccountToken.create).not.toHaveBeenCalled();
      expect(emailSender.sendPasswordResetEmail).not.toHaveBeenCalled();
    }
  });

  test("updates the password and consumes all outstanding reset links", async () => {
    const token = "one-time-reset-token";
    const accountToken = {
      userId: 7,
      usedAt: null,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS)
    };
    const user = {
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: now,
      passwordHash: "old-hash",
      save: jest.fn().mockResolvedValue(undefined)
    };
    const models = {
      User: { findByPk: jest.fn().mockResolvedValue(user) },
      AccountToken: { findOne: jest.fn().mockResolvedValue(accountToken), update: jest.fn().mockResolvedValue([1]) }
    };

    await expect(resetPatientPassword({
      sequelize: makeSequelize(), models, token, password: "new-password-123", now
    })).resolves.toEqual({ status: "reset" });

    expect(user.passwordHash).not.toBe("old-hash");
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.save).toHaveBeenCalledWith({ transaction });
    expect(models.AccountToken.update).toHaveBeenCalledWith(
      { usedAt: now },
      { where: { userId: 7, purpose: "PASSWORD_RESET", usedAt: null }, transaction }
    );
  });

  test("rejects unknown, used, and expired tokens without changing the password", async () => {
    for (const record of [
      null,
      { usedAt: now, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) },
      { usedAt: null, expiresAt: new Date(now.getTime() - 1) }
    ]) {
      const models = {
        User: { findByPk: jest.fn() },
        AccountToken: { findOne: jest.fn().mockResolvedValue(record), update: jest.fn() }
      };
      const result = await resetPatientPassword({
        sequelize: makeSequelize(), models, token: "invalid-token", password: "new-password-123", now
      });
      expect(["invalid", "used", "expired"]).toContain(result.status);
      expect(models.User.findByPk).not.toHaveBeenCalled();
    }
  });
});
