const path = require("node:path");
const pug = require("pug");
const { appNavigationItems, getActiveAppNavigationItem } = require("../src/app");

const renderNavigation = pug.compileFile(path.join(__dirname, "../src/views/shared/app-navigation.pug"));

describe("navegación global", () => {
  test.each([
    ["PATIENT", "/paciente", "Inicio", "/whatsapp/vincular", "/medico/pacientes"],
    ["DOCTOR", "/medico", "Mis pacientes", "/medico/pacientes", "/administrador/medicos"],
    ["ADMIN", "/administrador", "Excepciones de agenda", "/administrador/excepciones", "/paciente"]
  ])("muestra solo las opciones del rol %s", (role, homePath, expectedLabel, expectedPath, forbiddenPath) => {
    const html = renderNavigation({
      currentUser: { role, firstName: "Alex" },
      appNavigationItems,
      activeAppNavigationItem: appNavigationItems[role][0].id,
      csrfToken: "csrf-test"
    });
    expect(html).toContain(`href="${homePath}"`);
    expect(html).toContain(`href="${expectedPath}"`);
    expect(html).toContain(expectedLabel);
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain(`href="${forbiddenPath}"`);
  });

  test("resalta el historial cuando se consulta la lista de citas anteriores", () => {
    expect(getActiveAppNavigationItem({ path: "/mis-citas", query: { filtro: "anteriores" } })).toBe("patient-history");
    expect(getActiveAppNavigationItem({ path: "/medico/citas/18", query: {} })).toBe("doctor-appointments");
    expect(getActiveAppNavigationItem({ path: "/administrador/medicos/nuevo", query: {} })).toBe("admin-doctors");
  });
});
