const {
  confirmAccountEmailChange,
  hashEmailChangeToken,
  requestAccountEmailChange
} = require("../src/modules/auth/services/account-email-change");
const { validateAdminAccount } = require("../src/modules/admin/validators/account");

const now = new Date("2026-11-10T12:00:00.000Z");
const transaction = { LOCK: { UPDATE: "UPDATE" } };

function setup(overrides = {}) {
  const user = {
    id: 9,
    role: "ADMIN",
    status: "ACTIVE",
    email: "admin@example.com",
    pendingEmail: null,
    firstName: "Alicia",
    lastName: "Rojas",
    phone: "+573001112233",
    emailVerifiedAt: now,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
  const token = {
    id: 50,
    userId: user.id,
    usedAt: null,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  };
  const models = {
    User: {
      findByPk: jest.fn().mockResolvedValue(user),
      findOne: jest.fn().mockResolvedValue(null)
    },
    AccountToken: {
      update: jest.fn().mockResolvedValue([1]),
      create: jest.fn().mockResolvedValue({ id: token.id }),
      findOne: jest.fn().mockResolvedValue(token)
    },
    NotificationOutbox: {
      create: jest.fn().mockResolvedValue({ id: 51 }),
      update: jest.fn().mockResolvedValue([1])
    }
  };
  const sequelize = { transaction: jest.fn((callback) => callback(transaction)) };
  return { user, token, models, sequelize };
}

describe("administrator account", () => {
  test("validates only the permitted contact fields", () => {
    expect(validateAdminAccount({
      firstName: " Alicia ", lastName: " Rojas ",
      phone: "+573001112233", email: " ADMIN@EXAMPLE.COM "
    })).toMatchObject({
      isValid: true,
      values: { firstName: "Alicia", lastName: "Rojas", email: "admin@example.com" }
    });

    const invalid = validateAdminAccount({
      firstName: "", lastName: "Rojas", phone: "bad", email: "not-an-email"
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.firstName).toBeTruthy();
    expect(invalid.errors.phone).toBeTruthy();
    expect(invalid.errors.email).toBeTruthy();
    expect(validateAdminAccount({
      firstName: "A", lastName: "B", phone: "+573001112233",
      email: "a@example.com", role: "PATIENT"
    }).values.role).toBeUndefined();
  });

  test("keeps the current email and sends a hashed confirmation for its replacement", async () => {
    const { user, models, sequelize } = setup();
    const emailSender = { sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined) };

    await expect(requestAccountEmailChange({
      sequelize, models, userId: user.id, role: "ADMIN",
      email: " NEW@example.com ",
      updates: { firstName: "Alicia María", phone: "+573009998877" },
      emailSender, baseUrl: "https://medigo.example", now
    })).resolves.toEqual({ status: "verification_pending", deliveryFailed: false });

    expect(user.email).toBe("admin@example.com");
    expect(user.pendingEmail).toBe("new@example.com");
    expect(user.firstName).toBe("Alicia María");
    expect(user.phone).toBe("+573009998877");
    expect(user.role).toBe("ADMIN");
    const created = models.AccountToken.create.mock.calls[0][0];
    expect(created.purpose).toBe("EMAIL_CHANGE");
    const url = new URL(emailSender.sendEmailChangeVerification.mock.calls[0][0].url);
    const rawToken = url.pathname.split("/").at(-1);
    expect(created.tokenHash).toBe(hashEmailChangeToken(rawToken));
    expect(created.tokenHash).not.toBe(rawToken);
    expect(models.NotificationOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      recipient: "new@example.com", notificationType: "EMAIL_CHANGE"
    }), { transaction });
  });

  test("rejects an email already in use without editing the account", async () => {
    const { user, models, sequelize } = setup();
    models.User.findOne.mockResolvedValue({ id: 44 });

    await expect(requestAccountEmailChange({
      sequelize, models, userId: user.id, role: "ADMIN",
      email: "used@example.com", updates: { firstName: "Changed" },
      emailSender: null, baseUrl: "https://medigo.example", now
    })).resolves.toEqual({ status: "email_in_use" });

    expect(user.firstName).toBe("Alicia");
    expect(user.save).not.toHaveBeenCalled();
    expect(models.AccountToken.create).not.toHaveBeenCalled();
  });

  test("confirms only a valid one-use administrator email token", async () => {
    const { user, token, models, sequelize } = setup({ pendingEmail: "new@example.com" });
    models.AccountToken.findOne.mockResolvedValue(token);

    await expect(confirmAccountEmailChange({
      sequelize, models, token: "email-token", requiredRole: "ADMIN", now
    })).resolves.toEqual({ status: "confirmed" });

    expect(models.AccountToken.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: hashEmailChangeToken("email-token"), purpose: "EMAIL_CHANGE" }
    }));
    expect(user.email).toBe("new@example.com");
    expect(user.pendingEmail).toBeNull();
    expect(user.role).toBe("ADMIN");
    expect(models.AccountToken.update).toHaveBeenLastCalledWith(
      { usedAt: now },
      { where: { userId: 9, purpose: "EMAIL_CHANGE", usedAt: null }, transaction }
    );
  });
});
