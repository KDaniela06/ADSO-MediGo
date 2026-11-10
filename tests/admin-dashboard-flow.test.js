const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("administrator dashboard page", () => {
  let server;
  let baseUrl;
  let user;
  let models;
  const password = "admin-password-123";

  beforeAll(async () => {
    user = {
      id: 9, firstName: "Alicia", lastName: "Rojas", email: "admin@example.com",
      passwordHash: await hashPassword(password), role: "ADMIN", status: "ACTIVE",
      emailVerifiedAt: new Date()
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => where.email === user.email ? user : null),
        findByPk: jest.fn().mockImplementation(async (id) => Number(id) === user.id ? user : null),
        count: jest.fn().mockResolvedValue(2)
      },
      Patient: { count: jest.fn().mockResolvedValue(5) },
      Appointment: {
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1),
        findAll: jest.fn().mockResolvedValue([
          { startsAt: new Date("2026-11-10T15:00:00.000Z") }
        ])
      }
    };
    server = createApp({ models }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function login() {
    const page = await fetch(`${baseUrl}/iniciar-sesion`);
    const html = await page.text();
    const cookie = page.headers.get("set-cookie").split(";")[0];
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, email: user.email, password }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/administrador");
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("requires an administrator and shows privacy-safe indicators and shortcuts", async () => {
    const anonymous = await fetch(`${baseUrl}/administrador`, { redirect: "manual" });
    expect(anonymous.status).toBe(303);
    const cookie = await login();
    const response = await fetch(`${baseUrl}/administrador`, { headers: { cookie } });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain("Panel de administración");
    expect(html).toContain("Pacientes");
    expect(html).toContain("Médicos activos");
    expect(html).toContain("Citas de hoy");
    expect(html).toContain("Consultas atendidas hoy");
    expect(html).toContain("/administrador/horarios");
    expect(html).toContain("/administrador/excepciones");
    expect(html).not.toContain("observaciones médicas");
  });

  test("rejects non-administrator accounts", async () => {
    const cookie = await login();
    user.role = "PATIENT";
    const response = await fetch(`${baseUrl}/administrador`, { headers: { cookie } });
    expect(response.status).toBe(403);
    user.role = "ADMIN";
  });
});
