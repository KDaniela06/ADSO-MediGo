const {
  hashToken,
  requestEmailVerification,
  TOKEN_TTL_MS,
  verifyEmailToken
} = require("../src/modules/auth/services/email-verification");

const now = new Date("2026-11-10T12:00:00.000Z");

function makeTransaction() {
  return { LOCK: { UPDATE: "UPDATE" } };
}

describe("email verification", () => {
  test("sends a 24-hour link and stores only the token hash", async () => {
    const transaction = makeTransaction();
    const user = { id: 7, email: "patient@example.com", firstName: "Ana", status: "PENDING_VERIFICATION" };
    const accountToken = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue([0]),
      create: jest.fn().mockImplementation(async (values) => {
        accountToken.createdValues = values;
        return values;
      })
    };
    const userModel = { findOne: jest.fn().mockResolvedValue(user) };
    const sequelize = { transaction: jest.fn((callback) => callback(transaction)) };
    const emailSender = { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) };

    const result = await requestEmailVerification({
      sequelize,
      models: { User: userModel, AccountToken: accountToken },
      email: "PATIENT@example.com",
      emailSender,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "sent" });
    expect(accountToken.createdValues.expiresAt.getTime()).toBe(now.getTime() + TOKEN_TTL_MS);
    expect(accountToken.createdValues.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(emailSender.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const sentUrl = new URL(emailSender.sendVerificationEmail.mock.calls[0][0].url);
    const rawToken = sentUrl.pathname.split("/").at(-1);
    expect(accountToken.createdValues.tokenHash).toBe(hashToken(rawToken));
    expect(accountToken.createdValues.tokenHash).not.toBe(rawToken);
  });

  test("does not send when the hourly request limit is reached", async () => {
    const accountToken = {
      count: jest.fn().mockResolvedValue(5),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };
    const emailSender = { sendVerificationEmail: jest.fn() };
    const sequelize = { transaction: jest.fn((callback) => callback(makeTransaction())) };

    const result = await requestEmailVerification({
      sequelize,
      models: {
        User: { findOne: jest.fn().mockResolvedValue({ id: 8, status: "PENDING_VERIFICATION" }) },
        AccountToken: accountToken
      },
      email: "patient@example.com",
      emailSender,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "accepted" });
    expect(accountToken.create).not.toHaveBeenCalled();
    expect(emailSender.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("enforces the 60-second resend interval", async () => {
    const accountToken = {
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn().mockResolvedValue({ createdAt: new Date(now.getTime() - 30_000) }),
      create: jest.fn(),
      update: jest.fn()
    };
    const emailSender = { sendVerificationEmail: jest.fn() };
    const sequelize = { transaction: jest.fn((callback) => callback(makeTransaction())) };

    const result = await requestEmailVerification({
      sequelize,
      models: {
        User: { findOne: jest.fn().mockResolvedValue({ id: 8, status: "PENDING_VERIFICATION" }) },
        AccountToken: accountToken
      },
      email: "patient@example.com",
      emailSender,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "accepted" });
    expect(accountToken.create).not.toHaveBeenCalled();
    expect(emailSender.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("counts a request even when email delivery is not configured", async () => {
    const accountToken = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue([0]),
      create: jest.fn().mockResolvedValue({})
    };
    const sequelize = { transaction: jest.fn((callback) => callback(makeTransaction())) };

    const result = await requestEmailVerification({
      sequelize,
      models: {
        User: { findOne: jest.fn().mockResolvedValue({ id: 8, email: "patient@example.com", status: "PENDING_VERIFICATION" }) },
        AccountToken: accountToken
      },
      email: "patient@example.com",
      emailSender: null,
      baseUrl: "https://medigo.example",
      now
    });

    expect(result).toEqual({ status: "delivery_failed" });
    expect(accountToken.create).toHaveBeenCalledTimes(1);
  });

  test("activates a pending user once and marks the token used", async () => {
    const token = "sample-verification-token";
    const accountToken = {
      userId: 7,
      purpose: "EMAIL_VERIFICATION",
      usedAt: null,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      save: jest.fn().mockResolvedValue(undefined)
    };
    const user = {
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
      save: jest.fn().mockResolvedValue(undefined)
    };
    const sequelize = { transaction: jest.fn((callback) => callback(makeTransaction())) };
    const models = {
      AccountToken: { findOne: jest.fn().mockResolvedValue(accountToken) },
      User: { findByPk: jest.fn().mockResolvedValue(user) }
    };

    const result = await verifyEmailToken({ sequelize, models, token, now });

    expect(result).toEqual({ status: "verified" });
    expect(models.AccountToken.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: hashToken(token), purpose: "EMAIL_VERIFICATION" }
    }));
    expect(accountToken.usedAt).toBe(now);
    expect(user.emailVerifiedAt).toBe(now);
    expect(user.status).toBe("ACTIVE");
    expect(accountToken.save).toHaveBeenCalledTimes(1);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  test("returns clear expired and already-used states without activating the user", async () => {
    for (const [tokenRecord, expected] of [
      [{ usedAt: now, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) }, "used"],
      [{ usedAt: null, expiresAt: new Date(now.getTime() - 1) }, "expired"]
    ]) {
      const sequelize = { transaction: jest.fn((callback) => callback(makeTransaction())) };
      const models = {
        AccountToken: { findOne: jest.fn().mockResolvedValue(tokenRecord) },
        User: { findByPk: jest.fn() }
      };
      await expect(verifyEmailToken({ sequelize, models, token: "token", now }))
        .resolves.toEqual({ status: expected });
      expect(models.User.findByPk).not.toHaveBeenCalled();
    }
  });
});

