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
      title: "Mi perfil",
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

  test("no falla si la lista de navegación no está presente en los datos de la vista", () => {
    const html = renderNavigation({
      currentUser: { role: "PATIENT", firstName: "Alex" },
      title: "Mi perfil",
      csrfToken: "csrf-test"
    });

    expect(html).toContain("Navegación");
    expect(html).not.toMatch(/class="app-navigation-link(?: |")/);
  });

  test("muestra al paciente la barra lateral fija y el botón hamburguesa inicia abierta", () => {
    const html = renderNavigation({
      currentUser: { role: "PATIENT", firstName: "Alex", lastName: "Pérez" },
      title: "Mi perfil",
      appNavigationItems,
      activeAppNavigationItem: "patient-profile",
      csrfToken: "csrf-test"
    });

    expect(html).toContain('class="app-navigation patient-app-navigation"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('class="patient-sidebar-brand"');
    expect(html).toContain("Mi perfil – Paciente");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('action="/cerrar-sesion"');
  });
});
