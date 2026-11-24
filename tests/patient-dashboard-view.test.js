const path = require("node:path");
const pug = require("pug");

const renderDashboard = pug.compileFile(path.join(__dirname, "../src/modules/patient/views/dashboard.pug"));

describe("vista de inicio del paciente", () => {
  test("deja los accesos de navegación en la barra lateral", () => {
    const html = renderDashboard({
      currentUser: { role: "PATIENT", firstName: "Alex", lastName: "Pérez" },
      title: "Mi espacio MediGo",
      dashboard: { status: "empty" },
      csrfToken: "csrf-test"
    });

    expect(html).not.toContain('aria-label="Accesos rápidos"');
    expect(html).toContain('href="/paciente"');
    expect(html).toContain('href="/mis-citas"');
    expect(html).toContain('href="/perfil"');
    expect(html).toContain('href="/whatsapp/vincular"');
    expect(html).toContain("Próximas citas");
  });
});
