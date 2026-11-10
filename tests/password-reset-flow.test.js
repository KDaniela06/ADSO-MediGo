const { createApp } = require("../src/app");

describe("patient password reset pages", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const sequelize = {
      transaction: jest.fn((callback) => callback({ LOCK: { UPDATE: "UPDATE" } }))
    };
    const models = {
      User: { findOne: jest.fn().mockResolvedValue(null), findByPk: jest.fn() },
      AccountToken: { count: jest.fn().mockResolvedValue(0), findOne: jest.fn().mockResolvedValue(null), update: jest.fn(), create: jest.fn() },
      NotificationOutbox: { create: jest.fn(), update: jest.fn() }
    };
    server = createApp({ sequelize, models, emailSender: null }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function form(path) {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    expect(response.status).toBe(200);
    expect(token).toBeTruthy();
    return { cookie, token, html };
  }

  test("shows the recovery form and protects it with CSRF", async () => {
    const result = await form("/recuperar-contrasena");
    expect(result.html).toContain("Recuperar contraseña");
    expect(result.html).toContain("Correo electrónico");
    expect(result.html).toContain("name=\"_csrf\"");
  });

  test("gives a generic response after a recovery request", async () => {
    const recoveryForm = await form("/recuperar-contrasena");
    const response = await fetch(`${baseUrl}/recuperar-contrasena`, {
      method: "POST",
      headers: { cookie: recoveryForm.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: recoveryForm.token,
        email: "unknown@example.com"
      }).toString()
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Si el correo corresponde a una cuenta activa");
    expect(html).not.toContain("unknown@example.com");
  });

  test("requires matching passwords that meet the minimum length", async () => {
    const resetForm = await form("/restablecer-contrasena/example-token");
    const response = await fetch(`${baseUrl}/restablecer-contrasena/example-token`, {
      method: "POST",
      headers: { cookie: resetForm.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: resetForm.token,
        password: "short",
        passwordConfirmation: "different"
      }).toString()
    });
    const html = await response.text();

    expect(response.status).toBe(422);
    expect(html).toContain("al menos 8 caracteres");
    expect(html).toContain("Las contraseñas no coinciden");
  });

  test("does not accept an invalid token and prevents CSRF-free submissions", async () => {
    const resetForm = await form("/restablecer-contrasena/invalid-token");
    const invalid = await fetch(`${baseUrl}/restablecer-contrasena/invalid-token`, {
      method: "POST",
      headers: { cookie: resetForm.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        _csrf: resetForm.token,
        password: "new-password-123",
        passwordConfirmation: "new-password-123"
      }).toString()
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toContain("El enlace no es válido");

    const csrfFree = await fetch(`${baseUrl}/recuperar-contrasena`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "unknown@example.com" }).toString(),
      redirect: "manual"
    });
    expect(csrfFree.status).toBe(403);
  });
});
