const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("administrator patient pages", () => {
  let server;
  let baseUrl;
  let user;
  let auditCreate;
  let patient;
  let models;
  const password = "admin-password-123";

  beforeAll(async () => {
    user = {
      id: 9, firstName: "Alicia", lastName: "Rojas", email: "admin@example.com",
      passwordHash: await hashPassword(password), role: "ADMIN", status: "ACTIVE",
      emailVerifiedAt: new Date(), save: jest.fn().mockImplementation(async function save() {})
    };
    patient = {
      id: 3, userId: 7, city: "Cali", dateOfBirth: "1995-04-02",
      user: { id: 7, firstName: "Ana", lastName: "Paz", documentType: "CC",
        documentNumber: "123", email: "ana@example.com", phone: "3001112233", role: "PATIENT", status: "ACTIVE", save: jest.fn().mockResolvedValue(undefined) },
      save: jest.fn()
    };
    auditCreate = jest.fn().mockResolvedValue({ id: 1 });
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => where.email === user.email ? user : null),
        findByPk: jest.fn().mockImplementation(async (id) => Number(id) === user.id ? user : (Number(id) === patient.userId ? patient.user : null))
      },
      Patient: {
        findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [patient] }),
        findByPk: jest.fn().mockResolvedValue(patient)
      },
      Appointment: { count: jest.fn().mockResolvedValue(0) },
      AuditLog: { create: auditCreate }
    };
    const sequelize = { transaction: (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }) };
    server = createApp({ sequelize, models }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function getPage(path, cookie) {
    const response = await fetch(`${baseUrl}${path}`, cookie ? { headers: { cookie } } : {});
    const html = await response.text();
    return {
      response, html,
      cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie,
      token: html.match(/name="_csrf" value="([^"]+)"/)?.[1]
    };
  }

  async function login() {
    const form = await getPage("/iniciar-sesion");
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie: form.cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: form.token, email: user.email, password }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("protects the directory and displays privacy-safe patient data", async () => {
    const anonymous = await fetch(`${baseUrl}/administrador/pacientes`, { redirect: "manual" });
    expect(anonymous.status).toBe(303);
    const cookie = await login();
    const page = await getPage("/administrador/pacientes", cookie);
    expect(page.response.status).toBe(200);
    expect(page.html).toContain("Gestionar pacientes");
    expect(page.html).toContain("ana@example.com");
    expect(page.html).not.toMatch(/observaciones|historia clínica/i);
    expect(page.html).toContain("/administrador/pacientes/3");
  });

  test("requires an explicit confirmation before recording a state change", async () => {
    const cookie = await login();
    const form = await getPage("/administrador/pacientes/3/estado?nuevo=INACTIVE", cookie);
    expect(form.response.status).toBe(200);
    expect(form.html).toContain("Confirmar cambio de estado");
    const response = await fetch(`${baseUrl}/administrador/pacientes/3/estado`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: form.token, newStatus: "INACTIVE", confirmed: "YES" }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    expect(patient.user.status).toBe("INACTIVE");
    expect(auditCreate).toHaveBeenCalled();
  });
});
