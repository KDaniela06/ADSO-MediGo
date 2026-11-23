const { createApp } = require("../src/app");

describe("patient registration HTTP flow", () => {
  let server;
  let baseUrl;
  let createdUser;
  let models;

  beforeAll(async () => {
    const inputEmail = "new-patient@example.com";
    const transaction = {};
    createdUser = null;

    models = {
      User: {
        findOne: jest.fn(async ({ where }) => {
          if (where.email === inputEmail) return createdUser;
          return null;
        }),
        create: jest.fn(async (values) => {
          createdUser = { id: 77, firstName: values.firstName, email: values.email, status: values.status };
          return createdUser;
        })
      },
      Patient: {
        create: jest.fn().mockResolvedValue({ id: 88 })
      },
      AccountToken: {
        count: jest.fn().mockResolvedValue(0),
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue([0]),
        create: jest.fn().mockResolvedValue({ id: 99 })
      },
      NotificationOutbox: {
        create: jest.fn().mockResolvedValue({ id: 100 }),
        update: jest.fn().mockResolvedValue([1])
      }
    };

    const sequelize = {
      transaction: jest.fn((callback) => callback(transaction))
    };
    server = createApp({ sequelize, models }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  test("creates the user and patient profile from a valid form", async () => {
    const page = await fetch(`${baseUrl}/registro`);
    const html = await page.text();
    const cookie = page.headers.get("set-cookie").split(";")[0];
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];

    const response = await fetch(`${baseUrl}/registro`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        _csrf: token,
        firstName: "Ana",
        lastName: "Gomez",
        documentType: "CC",
        documentNumber: "123456789",
        dateOfBirth: "1990-01-15",
        email: "new-patient@example.com",
        phone: "+57 300 123 4567",
        password: "clave-segura-1",
        passwordConfirmation: "clave-segura-1",
        privacyAccepted: "on"
      }).toString()
    });
    const result = await response.text();

    expect(response.status).toBe(201);
    expect(result).toContain("pendiente de verificaci");
    expect(models.User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "new-patient@example.com",
      role: "PATIENT",
      status: "PENDING_VERIFICATION",
      passwordHash: expect.stringMatching(/^scrypt\$/)
    }), expect.any(Object));
    expect(models.Patient.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 77,
      dateOfBirth: "1990-01-15"
    }), expect.any(Object));
  });
});
