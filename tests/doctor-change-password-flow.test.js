const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");
const { verifyPassword } = require("../src/modules/auth/services/authentication");

describe("doctor change password pages", () => {
  let server;
  let baseUrl;
  let user;
  let models;

  beforeAll(async () => {
    user = {
      id: 8,
      firstName: "Carlos",
      lastName: "Méndez",
      email: "carlos@example.com",
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

  async function login(password = "old-password-123") {
    const form = await getForm("/iniciar-sesion");
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie: form.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: form.token, email: user.email, password }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  async function submit(cookie, fields) {
    const page = await fetch(`${baseUrl}/medico/cambiar-contrasena`, { headers: { cookie } });
    const html = await page.text();
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    return fetch(`${baseUrl}/medico/cambiar-contrasena`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, ...fields }).toString()
    });
  }

  test("requires a signed-in account", async () => {
    const response = await fetch(`${baseUrl}/medico/cambiar-contrasena`, { redirect: "manual" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/iniciar-sesion");
  });

  test("allows the doctor to change a password and leaves the role intact", async () => {
    const cookie = await login();
    user.role = "DOCTOR";
    const page = await fetch(`${baseUrl}/medico/cambiar-contrasena`, { headers: { cookie } });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("Cambiar contraseña");
    expect(html).toContain('name="currentPassword"');
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('name="passwordConfirmation"');

    const response = await submit(cookie, {
      currentPassword: "old-password-123",
      newPassword: "new-password-456",
      passwordConfirmation: "new-password-456"
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Tu contraseña se actualizó correctamente.");
    expect(user.role).toBe("DOCTOR");
    expect(await verifyPassword("new-password-456", user.passwordHash)).toBe(true);
  });

  test("does not allow a patient to use the doctor password route", async () => {
    const cookie = await login("new-password-456");
    user.role = "PATIENT";
    const response = await fetch(`${baseUrl}/medico/cambiar-contrasena`, { headers: { cookie } });
    expect(response.status).toBe(403);
    expect(user.role).toBe("PATIENT");
  });

  test("rejects submissions without CSRF", async () => {
    const response = await fetch(`${baseUrl}/medico/cambiar-contrasena`, {
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
