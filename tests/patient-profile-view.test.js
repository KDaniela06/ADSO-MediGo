const path = require("node:path");
const pug = require("pug");

const renderProfile = pug.compileFile(path.join(__dirname, "../src/modules/patient/views/profile.pug"));

describe("vista de perfil del paciente", () => {
  test("conserva los campos, mensajes y acciones del formulario", () => {
    const html = renderProfile({
      title: "Mi perfil",
      currentUser: { role: "PATIENT", firstName: "Juan", lastName: "Pérez" },
      appNavigationItems: {
        PATIENT: [
          { id: "patient-home", label: "Inicio", href: "/paciente" },
          { id: "patient-profile", label: "Mi perfil", href: "/perfil" }
        ]
      },
      activeAppNavigationItem: "patient-profile",
      csrfToken: "csrf-test",
      profile: {
        firstName: "Juan",
        lastName: "Pérez García",
        documentType: "CC",
        documentNumber: "12345678",
        dateOfBirth: "1990-03-15",
        pendingEmail: null
      },
      values: {
        firstName: "Juan",
        lastName: "Pérez García",
        email: "juan@example.com",
        phone: "3001234567",
        city: "Bogotá"
      },
      errors: {},
      message: null
    });

    expect(html).toContain("Mi Perfil");
    expect(html).toContain("Información personal");
    expect(html).toContain("Información de contacto");
    expect(html).toContain('name="_csrf"');
    expect(html).toContain('action="/perfil"');
    expect(html).toContain('href="/cambiar-contrasena"');
    expect(html).toContain("Bogotá");
  });
});

