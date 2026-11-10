const { createApp } = require("../src/app");
const { hashPassword } = require("../src/modules/auth/services/patient-registration");

describe("doctor appointments web flow", () => {
  let server;
  let baseUrl;
  let user;
  let models;
  const password = "secure-password-123";
  const appointment = {
    id: 81,
    startsAt: new Date("2026-11-10T15:00:00.000Z"),
    endsAt: new Date("2026-11-10T15:30:00.000Z"),
    status: "CONFIRMED",
    patient: {
      user: {
        firstName: "Ana",
        lastName: "Rojas",
        documentType: "CC",
        documentNumber: "123456",
        phone: "+573001112233"
      }
    },
    specialty: { name: "Medicina general" }
  };

  beforeAll(async () => {
    user = {
      id: 44,
      firstName: "Carlos",
      lastName: "Méndez",
      email: "doctor@example.com",
      passwordHash: await hashPassword(password),
      role: "DOCTOR",
      status: "ACTIVE",
      emailVerifiedAt: new Date()
    };
    models = {
      User: {
        findOne: jest.fn().mockImplementation(async ({ where }) => where.email === user.email ? user : null),
        findByPk: jest.fn().mockImplementation(async (id) => id === user.id ? user : null)
      },
      Doctor: { findOne: jest.fn().mockResolvedValue({ id: 9, userId: user.id }) },
      Patient: {},
      Specialty: {},
      Appointment: {
        findAll: jest.fn().mockResolvedValue([appointment]),
        findOne: jest.fn().mockImplementation(async ({ where }) => where.id === appointment.id ? appointment : null)
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
    expect(response.headers.get("location")).toBe("/medico");
    return response.headers.get("set-cookie").split(";")[0];
  }

  test("requires a doctor session to see assigned appointments", async () => {
    const anonymous = await fetch(`${baseUrl}/medico/citas`, { redirect: "manual" });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toBe("/iniciar-sesion");

    const cookie = await login();
    const response = await fetch(`${baseUrl}/medico/citas?date=2026-11-10&status=CONFIRMED`, {
      headers: { cookie }
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Mis citas");
    expect(html).toContain("Ana Rojas");
    expect(html).toContain("123456");
    expect(html).toContain("Iniciar atención");
    expect(models.Appointment.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ doctorId: 9, status: "CONFIRMED" })
    }));
  });

  test("shows details only when the appointment belongs to the doctor", async () => {
    const cookie = await login();
    const response = await fetch(`${baseUrl}/medico/citas/81`, { headers: { cookie } });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Detalle de cita");
    expect(html).toContain("Medicina general");
    expect(models.Appointment.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "81", doctorId: 9 }
    }));
  });

  test("blocks another role from the appointment list", async () => {
    const cookie = await login();
    user.role = "PATIENT";
    const response = await fetch(`${baseUrl}/medico/citas`, { headers: { cookie } });
    expect(response.status).toBe(403);
    user.role = "DOCTOR";
  });
});
