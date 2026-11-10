const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");
const { verifyPassword } = require("../src/modules/auth/services/authentication");

describe("patient change password pages", () => {
  let server;
  let baseUrl;
  let user;
  let models;

  beforeAll(async () => {
    user = {
      id: 27,
      firstName: "Ana",
      lastName: "Gómez",
      email: "ana@example.com",
      passwordHash: await hashPassword("old-password-123"),
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      save: jest.fn().mockImplementation(async function save() {})
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => where.email === user.email ? user : null),
        findByPk: jest.fn().mockResolvedValue(user)
      },
      AccountToken: { update: jest.fn().mockResolvedValue([1]) }
    };
    const sequelize = { transaction: jest.fn((callback) => callback({ LOCK: { UPDATE: "UPDATE" } })) };
    server = createApp({ sequelize, models, emailSender: null }).listen(0);
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
        password: "old-password-123"
      }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  async function submit(cookie, fields) {
    const page = await fetch(`${baseUrl}/cambiar-contrasena`, { headers: { cookie } });
    const html = await page.text();
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    return fetch(`${baseUrl}/cambiar-contrasena`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, ...fields }).toString()
    });
  }

  test("requires a patient session to open the form", async () => {
    const response = await fetch(`${baseUrl}/cambiar-contrasena`, { redirect: "manual" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/iniciar-sesion");
  });

  test("shows all three password fields and rejects invalid lengths or confirmation", async () => {
    const cookie = await login();
    const page = await fetch(`${baseUrl}/cambiar-contrasena`, { headers: { cookie } });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('name="currentPassword"');
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('name="passwordConfirmation"');

    const response = await submit(cookie, {
      currentPassword: "old-password-123",
      newPassword: "short",
      passwordConfirmation: "different"
    });
    const errorPage = await response.text();
    expect(response.status).toBe(422);
    expect(errorPage).toContain("al menos 8 caracteres");
    expect(errorPage).toContain("no coincide");
    expect(errorPage).not.toContain("old-password-123");
    expect(errorPage).not.toContain("different");
  });

  test("changes the password only after verifying the current one", async () => {
    const cookie = await login();
    const rejected = await submit(cookie, {
      currentPassword: "wrong-password",
      newPassword: "new-password-456",
      passwordConfirmation: "new-password-456"
    });
    expect(rejected.status).toBe(400);
    expect(await verifyPassword("old-password-123", user.passwordHash)).toBe(true);

    const changed = await submit(cookie, {
      currentPassword: "old-password-123",
      newPassword: "new-password-456",
      passwordConfirmation: "new-password-456"
    });
    expect(changed.status).toBe(200);
    expect(await changed.text()).toContain("Tu contraseña se actualizó correctamente.");
    expect(await verifyPassword("new-password-456", user.passwordHash)).toBe(true);
  });

  test("rejects POST submissions without CSRF", async () => {
    const response = await fetch(`${baseUrl}/cambiar-contrasena`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
        passwordConfirmation: "new-password-456"
      }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(403);
  });
});
