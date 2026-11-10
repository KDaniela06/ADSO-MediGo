const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("doctor profile and schedule pages", () => {
  let server;
  let baseUrl;
  let user;
  let models;
  const password = "doctor-password-123";

  beforeAll(async () => {
    user = {
      id: 77, firstName: "Carlos", lastName: "Méndez", email: "doctor@example.com",
      passwordHash: await hashPassword(password), role: "DOCTOR", status: "ACTIVE",
      emailVerifiedAt: new Date()
    };
    const profile = {
      id: 8, professionalRegistration: "MED-123", professionalDescription: "Medicina familiar",
      profilePhotoUrl: null,
      user: { firstName: "Carlos", lastName: "Méndez", email: user.email, phone: "+573001112233" },
      specialty: { name: "Medicina familiar" }
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => where.email === user.email ? user : null),
        findByPk: jest.fn().mockImplementation(async (id) => Number(id) === user.id ? user : null)
      },
      Doctor: { findOne: jest.fn().mockResolvedValue(profile) },
      Specialty: {}
    };
    server = createApp({ models }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:\${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function login() {
    const page = await fetch(`\${baseUrl}/iniciar-sesion`);
    const html = await page.text();
    const cookie = page.headers.get("set-cookie").split(";")[0];
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    const response = await fetch(`\${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, email: user.email, password }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("protects both pages and shows the doctor profile and read-only schedule state", async () => {
    const anonymous = await fetch(`\${baseUrl}/medico/perfil`, { redirect: "manual" });
    expect(anonymous.status).toBe(303);
    const cookie = await login();
    const profile = await fetch(`\${baseUrl}/medico/perfil`, { headers: { cookie } });
    const profileHtml = await profile.text();
    expect(profile.status).toBe(200);
    expect(profileHtml).toContain("Registro profesional");
    expect(profileHtml).toContain("MED-123");
    expect(profileHtml).toContain('name="profilePhotoUrl"');
    const schedule = await fetch(`\${baseUrl}/medico/agenda`, { headers: { cookie } });
    expect(schedule.status).toBe(200);
    expect(await schedule.text()).toContain("Tu agenda todavía no está configurada");
  });

  test("does not allow a patient account into the doctor profile", async () => {
    const cookie = await login();
    user.role = "PATIENT";
    const response = await fetch(`\${baseUrl}/medico/perfil`, { headers: { cookie } });
    expect(response.status).toBe(403);
    user.role = "DOCTOR";
  });
});
