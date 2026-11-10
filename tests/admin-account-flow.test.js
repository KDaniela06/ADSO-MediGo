const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");
const { verifyPassword } = require("../src/modules/auth/services/authentication");

describe("administrator account pages", () => {
  let server;
  let baseUrl;
  let user;
  let models;
  let emailSender;

  beforeAll(async () => {
    user = {
      id: 9,
      documentType: "CC",
      documentNumber: "900123",
      firstName: "Alicia",
      lastName: "Rojas",
      email: "admin@example.com",
      pendingEmail: null,
      phone: "+573001112233",
      passwordHash: await hashPassword("old-password-123"),
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      save: jest.fn().mockImplementation(async function save() {})
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => {
          if (where.email) return where.email === user.email ? user : null;
          return null;
        }),
        findByPk: jest.fn().mockResolvedValue(user)
      },
      AccountToken: {
        update: jest.fn().mockResolvedValue([1]),
        create: jest.fn().mockImplementation(async (values) => ({ id: 50, ...values })),
        findOne: jest.fn().mockImplementation(async ({ where }) => {
          return where.tokenHash === createdTokenHash ? createdToken : null;
        })
      },
      NotificationOutbox: {
        create: jest.fn().mockResolvedValue({ id: 51 }),
        update: jest.fn().mockResolvedValue([1])
      }
    };
    emailSender = { sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined) };
    const sequelize = { transaction: jest.fn((callback) => callback({ LOCK: { UPDATE: "UPDATE" } })) };
    server = createApp({ sequelize, models, emailSender }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  let createdToken;
  let createdTokenHash;

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function getPage(path, cookie) {
    const response = await fetch(`${baseUrl}${path}`, cookie ? { headers: { cookie } } : {});
    const html = await response.text();
    const nextCookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    return { response, html, cookie: nextCookie, token };
  }

  async function login() {
    const form = await getPage("/iniciar-sesion");
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie: form.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: form.token, email: user.email, password: "old-password-123"
      }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("requires the administrator role and shows only personal account fields", async () => {
    const anonymous = await fetch(`${baseUrl}/administrador/mi-cuenta`, { redirect: "manual" });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toBe("/iniciar-sesion");

    const cookie = await login();
    user.role = "ADMIN";
    const page = await getPage("/administrador/mi-cuenta", cookie);
    expect(page.response.status).toBe(200);
    expect(page.html).toContain("Mi cuenta");
    expect(page.html).toContain('name="firstName"');
    expect(page.html).toContain("900123");
    expect(page.html).not.toContain('name="role"');
    expect(page.html).not.toContain("Crear administrador");
  });

  test("updates personal details and confirms a new email before replacing the current one", async () => {
    const cookie = await login();
    user.role = "ADMIN";
    const page = await getPage("/administrador/mi-cuenta", cookie);
    const response = await fetch(`${baseUrl}/administrador/mi-cuenta`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: page.token,
        firstName: "Alicia María",
        lastName: "Rojas",
        phone: "+573009998877",
        email: "admin.nuevo@example.com",
        role: "PATIENT"
      }).toString()
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("seguirá activo hasta que lo confirmes");
    expect(user.firstName).toBe("Alicia María");
    expect(user.phone).toBe("+573009998877");
    expect(user.email).toBe("admin@example.com");
    expect(user.pendingEmail).toBe("admin.nuevo@example.com");
    expect(user.role).toBe("ADMIN");

    const sent = emailSender.sendEmailChangeVerification.mock.calls.at(-1)[0];
    const rawToken = new URL(sent.url).pathname.split("/").at(-1);
    const record = models.AccountToken.create.mock.results.at(-1).value;
    createdToken = { ...record, userId: user.id, usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    createdTokenHash = record.tokenHash;

    const confirmPage = await getPage(new URL(sent.url).pathname, cookie);
    const confirmed = await fetch(`${baseUrl}${new URL(sent.url).pathname}`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: confirmPage.token }).toString()
    });
    expect(rawToken).toBeTruthy();
    expect(confirmed.status).toBe(200);
    expect(await confirmed.text()).toContain("Confirmamos tu nuevo correo");
    expect(user.email).toBe("admin.nuevo@example.com");
    expect(user.pendingEmail).toBeNull();
    expect(user.role).toBe("ADMIN");
  });

  test("changes the administrator password without changing the role", async () => {
    user.role = "PATIENT";
    const cookie = await login();
    user.role = "ADMIN";
    const page = await getPage("/administrador/cambiar-contrasena", cookie);
    const response = await fetch(`${baseUrl}/administrador/cambiar-contrasena`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: page.token,
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
        passwordConfirmation: "new-password-456"
      }).toString()
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Tu contraseña se actualizó correctamente.");
    expect(user.role).toBe("ADMIN");
    expect(await verifyPassword("new-password-456", user.passwordHash)).toBe(true);
  });

  test("keeps account POST protected by CSRF", async () => {
    const response = await fetch(`${baseUrl}/administrador/mi-cuenta`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        firstName: "Cambio",
        lastName: "No permitido",
        phone: "+573001112233",
        email: "admin@example.com"
      }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(403);
  });
});
