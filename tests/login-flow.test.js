const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");
const { requireRole } = require("../src/modules/auth/middleware/authorization");

describe("patient login flow", () => {
  const password = "secure-password-123";
  let server;
  let baseUrl;
  let user;
  let models;

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    user = {
      id: 19,
      firstName: "Ana",
      lastName: "Gómez",
      email: "ana@example.com",
      passwordHash,
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date()
    };
    models = {
      User: {
        findOne: jest.fn(() => Promise.resolve(user)),
        findByPk: jest.fn(() => Promise.resolve(user))
      }
    };
    server = createApp({ models }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function getLoginForm() {
    const response = await fetch(`${baseUrl}/iniciar-sesion`);
    const html = await response.text();
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    expect(response.status).toBe(200);
    expect(token).toBeTruthy();
    return { cookie, token, html };
  }

  async function submitLogin({ cookie, token, submittedPassword = password, rememberMe = false }) {
    const body = new URLSearchParams({
      _csrf: token,
      email: "ana@example.com",
      password: submittedPassword
    });
    if (rememberMe) body.set("rememberMe", "on");
    return fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: body.toString(),
      redirect: "manual"
    });
  }

  test("shows the Spanish login screen without offering Google sign-in", async () => {
    const { html } = await getLoginForm();
    expect(html).toContain("Iniciar sesión");
    expect(html).toContain("Correo electrónico");
    expect(html).toContain("¿Olvidaste tu contraseña?");
    expect(html).not.toContain("Continuar con Google");
  });

  test("logs in an active verified patient and protects the dashboard", async () => {
    const form = await getLoginForm();
    const response = await submitLogin({ ...form, rememberMe: true });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/paciente");

    const sessionCookie = response.headers.get("set-cookie").split(";")[0];
    const dashboard = await fetch(`${baseUrl}/paciente`, {
      headers: { cookie: sessionCookie }
    });
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain("Hola, Ana");
    expect(models.User.findByPk).toHaveBeenCalledWith(19, expect.any(Object));
  });

  test("sends doctors and administrators to their own protected pages", async () => {
    for (const [role, path] of [
      ["DOCTOR", "/medico/cambiar-contrasena"],
      ["ADMIN", "/administrador/mi-cuenta"]
    ]) {
      user.role = role;
      const form = await getLoginForm();
      const response = await submitLogin(form);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(path);

      const cookie = response.headers.get("set-cookie").split(";")[0];
      const page = await fetch(`${baseUrl}${path}`, { headers: { cookie } });
      expect(page.status).toBe(200);
      user.role = "PATIENT";
    }
  });

  test("uses one generic message for invalid credentials and unverified accounts", async () => {
    const form = await getLoginForm();
    const invalidResponse = await submitLogin({ ...form, submittedPassword: "wrong-password" });
    const invalidHtml = await invalidResponse.text();
    expect(invalidResponse.status).toBe(401);
    expect(invalidHtml).toContain("No pudimos iniciar sesión con esos datos");

    user = { ...user, status: "PENDING_VERIFICATION", emailVerifiedAt: null };
    const pendingForm = await getLoginForm();
    const pendingResponse = await submitLogin(pendingForm);
    const pendingHtml = await pendingResponse.text();
    expect(pendingResponse.status).toBe(401);
    expect(pendingHtml).toContain("No pudimos iniciar sesión con esos datos");
    user = { ...user, status: "ACTIVE", emailVerifiedAt: new Date() };
  });

  test("rejects a login submission without its CSRF token", async () => {
    const { cookie } = await getLoginForm();
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "ana@example.com", password }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(403);
  });

  test("invalidates the session on logout", async () => {
    const loginForm = await getLoginForm();
    const loginResponse = await submitLogin(loginForm);
    const sessionCookie = loginResponse.headers.get("set-cookie").split(";")[0];
    const dashboard = await fetch(`${baseUrl}/paciente`, {
      headers: { cookie: sessionCookie }
    });
    const dashboardHtml = await dashboard.text();
    const token = dashboardHtml.match(/name="_csrf" value="([^"]+)"/)?.[1];
    expect(token).toBeTruthy();

    const logout = await fetch(`${baseUrl}/cerrar-sesion`, {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ _csrf: token }).toString(),
      redirect: "manual"
    });
    expect(logout.status).toBe(303);
    expect(logout.headers.get("location")).toBe("/");

    const privatePage = await fetch(`${baseUrl}/paciente`, {
      headers: { cookie: sessionCookie },
      redirect: "manual"
    });
    expect(privatePage.status).toBe(303);
    expect(privatePage.headers.get("location")).toBe("/iniciar-sesion");
  });

  test("blocks a user with the wrong role", () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      render: jest.fn()
    };
    const next = jest.fn();

    requireRole("PATIENT")({ currentUser: { role: "DOCTOR" } }, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.render).toHaveBeenCalledWith("auth/views/access-denied", expect.any(Object));
    expect(next).not.toHaveBeenCalled();
  });
});
