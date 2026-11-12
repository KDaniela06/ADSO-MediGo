const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("administrator account status permissions", () => {
  let server;
  let baseUrl;
  const account = {
    id: 20,
    firstName: "Patricia",
    lastName: "Paz",
    email: "patient@example.com",
    role: "PATIENT",
    status: "ACTIVE",
    emailVerifiedAt: new Date()
  };
  const password = "patient-route-password";

  beforeAll(async () => {
    account.passwordHash = await hashPassword(password);
    const models = {
      User: {
        findOne: jest.fn().mockResolvedValue(account),
        findByPk: jest.fn().mockResolvedValue(account)
      }
    };
    server = createApp({ sequelize: {}, models }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  test("requires ADMIN for patient and doctor account status routes", async () => {
    const loginPage = await fetch(`${baseUrl}/iniciar-sesion`);
    const html = await loginPage.text();
    const cookie = loginPage.headers.get("set-cookie").split(";")[0];
    const csrf = html.match(/name=" _csrf" value="([^"]+)"/)?.[1]
      || html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    const login = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: csrf, email: account.email, password }).toString(),
      redirect: "manual"
    });
    expect(login.status).toBe(303);
    const sessionCookie = login.headers.get("set-cookie").split(";")[0];

    for (const path of [
      "/administrador/pacientes/3/estado?nuevo=INACTIVE",
      "/administrador/medicos/3/estado?nuevo=INACTIVE"
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: sessionCookie },
        redirect: "manual"
      });
      expect(response.status).toBe(403);
    }
  });
});
