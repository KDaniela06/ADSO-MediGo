const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("patient profile web flow", () => {
  const password = "secure-password-123";
  let server;
  let baseUrl;
  let user;
  let models;

  beforeAll(async () => {
    user = {
      id: 27,
      documentType: "CC",
      documentNumber: "123456789",
      firstName: "Ana",
      lastName: "Gómez",
      phone: "+573001112233",
      email: "ana@example.com",
      pendingEmail: null,
      passwordHash: await hashPassword(password),
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      save: jest.fn().mockImplementation(async function save() {})
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => {
          if (where.email) return where.email === user.email ? user : null;
          return where.id === user.id ? user : null;
        }),
        findByPk: jest.fn().mockResolvedValue(user)
      },
      Patient: { findOne: jest.fn().mockResolvedValue({ dateOfBirth: "1995-05-01", city: "Bogotá", save: jest.fn().mockResolvedValue(undefined) }) },
      AccountToken: {
        count: jest.fn().mockResolvedValue(0),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 51 }),
        update: jest.fn().mockResolvedValue([0])
      },
      NotificationOutbox: {
        create: jest.fn().mockResolvedValue({ id: 52 }),
        update: jest.fn().mockResolvedValue([1])
      }
    };
    const sequelize = { transaction: jest.fn((callback) => callback({ LOCK: { UPDATE: "UPDATE" } })) };
    server = createApp({
      sequelize,
      models,
      emailSender: { sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined) }
    }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function getForm(path) {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    return { response, html, cookie, token };
  }

  async function login() {
    const form = await getForm("/iniciar-sesion");
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie: form.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: form.token,
        email: user.email,
        password
      }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("requires an authenticated patient to view the profile", async () => {
    const response = await fetch(`${baseUrl}/perfil`, { redirect: "manual" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/iniciar-sesion");
  });

  test("shows identification as read-only and editable contact fields", async () => {
    const cookie = await login();
    const response = await fetch(`${baseUrl}/perfil`, { headers: { cookie } });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Mi perfil");
    expect(html).toContain("123456789");
    expect(html).not.toContain('name="documentNumber"');
    expect(html).toContain("ana@example.com");
    expect(html).toContain("name=\"phone\"");
  });

  test("validates changes and keeps the current email until the new one is confirmed", async () => {
    const cookie = await login();
    const pageResponse = await fetch(`${baseUrl}/perfil`, { headers: { cookie } });
    const pageHtml = await pageResponse.text();
    const token = pageHtml.match(/name="_csrf" value="([^"]+)"/)?.[1];
    expect(pageResponse.status).toBe(200);
    expect(token).toBeTruthy();
    const response = await fetch(`${baseUrl}/perfil`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: token,
        firstName: "Ana María",
        lastName: "Gómez",
        phone: "+573009998877",
        email: "ana.nueva@example.com",
        city: "Medellín"
      }).toString()
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(user.firstName).toBe("Ana María");
    expect(user.phone).toBe("+573009998877");
    expect(user.email).toBe("ana@example.com");
    expect(user.pendingEmail).toBe("ana.nueva@example.com");
    expect(html).toContain("seguirá activo el correo actual");
    expect(models.AccountToken.create).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "EMAIL_CHANGE"
    }), expect.any(Object));
  });

  test("rejects profile submissions without CSRF", async () => {
    const response = await fetch(`${baseUrl}/perfil`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        firstName: "Ana",
        lastName: "Gómez",
        phone: "+573001112233",
        email: "ana@example.com"
      }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(403);
  });
});
