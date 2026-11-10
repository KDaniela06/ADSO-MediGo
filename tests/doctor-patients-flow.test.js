const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("doctor patients web flow", () => {
  let server;
  let baseUrl;
  let user;
  let models;
  const password = "secure-password-123";
  const patient = {
    id: 51,
    city: "Bogotá",
    user: {
      firstName: "María",
      lastName: "López",
      documentType: "CC",
      documentNumber: "111",
      phone: "+573001112233"
    }
  };
  const appointment = {
    id: 1,
    patientId: patient.id,
    startsAt: new Date("2026-11-08T15:00:00.000Z"),
    status: "ATTENDED",
    patient
  };

  beforeAll(async () => {
    user = {
      id: 77, firstName: "Carlos", lastName: "Méndez",
      email: "doctor@example.com", passwordHash: await hashPassword(password),
      role: "DOCTOR", status: "ACTIVE", emailVerifiedAt: new Date()
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => where.email === user.email ? user : null),
        findByPk: jest.fn().mockImplementation(async (id) => Number(id) === user.id ? user : null)
      },
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 8, userId: user.id }) },
      Patient: {},
      Appointment: {
        findAll: jest.fn().mockImplementation(async ({ include }) => {
          const condition = include?.[0]?.where;
          return !condition || String(condition.id) === String(patient.id) ? [appointment] : [];
        })
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

  async function login() {
    const page = await fetch(`${baseUrl}/iniciar-sesion`);
    const html = await page.text();
    const cookie = page.headers.get("set-cookie").split(";")[0];
    const csrfToken = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    const response = await fetch(`${baseUrl}/iniciar-sesion`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: csrfToken, email: user.email, password }).toString(),
      redirect: "manual"
    });
    expect(response.status).toBe(303);
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("requires a doctor session and lists associated patient details", async () => {
    const anonymous = await fetch(`${baseUrl}/medico/pacientes`, { redirect: "manual" });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toBe("/iniciar-sesion");

    const cookie = await login();
    const response = await fetch(`${baseUrl}/medico/pacientes?q=Maria`, { headers: { cookie } });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Mis pacientes");
    expect(html).toContain("María López");
    expect(html).toContain("CC 111");
    expect(html).not.toContain("historia clínica completa");
    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { doctorId: 8 }
    }));
  });

  test("shows only the basic patient details and rejects unassociated patient IDs", async () => {
    const cookie = await login();
    const response = await fetch(`${baseUrl}/medico/pacientes/51`, { headers: { cookie } });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Detalle del paciente");
    expect(html).toContain("Teléfono");
    expect(html).toContain("No incluye historia clínica ni observaciones de consultas.");

    const missing = await fetch(`${baseUrl}/medico/pacientes/999`, { headers: { cookie } });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("No encontramos un paciente asociado");
  });

  test("blocks other roles from the patient directory", async () => {
    const cookie = await login();
    user.role = "PATIENT";
    const response = await fetch(`${baseUrl}/medico/pacientes`, { headers: { cookie } });
    expect(response.status).toBe(403);
    user.role = "DOCTOR";
  });
});
