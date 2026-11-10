const { createApp } = require("../src/app");

describe("MediGo web app", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("renders the initial page in Spanish", async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Tu salud, en buenas manos");
    expect(html).toContain('lang="es"');
  });

  it("renders the patient registration page", async () => {
    const response = await fetch(`${baseUrl}/registro`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Crear cuenta de paciente");
  });

  it("renders a clear email verification state when storage is unavailable", async () => {
    const response = await fetch(`${baseUrl}/verificar-correo/not-a-real-token`);
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(html).toContain("No pudimos verificar el correo");
  });
});

