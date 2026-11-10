# Registro de cambios

Los cambios se registran en orden descendente. No se atribuyen funcionalidades de aplicación a cambios que solo añaden documentación.

## 2026-11-10 — Cuenta del administrador (US-ADM-13)

- Se añadió la pantalla para actualizar datos propios, con identificación y rol de solo lectura.
- El correo nuevo queda pendiente hasta confirmar un enlace de un solo uso; también se añadió el formulario para cambiar contraseña.
- Se protegieron las operaciones por sesión y rol ADMIN, y se añadieron pruebas y documentación. El inicio de sesión ahora dirige médicos y administradores a sus espacios protegidos. La cuenta no permite crear otros administradores.

## 2026-11-10 — Cambio de contraseña de médico (US-DOC-08)

- Se añadió el formulario y la ruta protegida para que un médico autenticado actualice su contraseña.
- Se valida la contraseña actual, la nueva con mínimo de ocho caracteres y su confirmación; el rol permanece sin cambios.
- Se reutilizó la verificación compartida de contraseña y se agregaron pruebas de servicio y del flujo web.

## 2026-11-10 — Cambio de contraseña del paciente (US-PAT-12)

- Se añadió el formulario accesible desde el perfil para solicitar la contraseña actual, una nueva de mínimo ocho caracteres y su confirmación.
- La contraseña actual se verifica antes de guardar; se usa un nuevo hash scrypt y se invalidan enlaces de recuperación pendientes.
- Se protegieron las rutas con sesión, rol de paciente y CSRF, y se añadieron pruebas del servicio y del flujo web.

## 2026-11-10 — Perfil del paciente (US-PAT-11)

- Se añadió la pantalla, siguiendo el mockup, para consultar identificación y datos de contacto, incluida ciudad opcional; la identificación queda de solo lectura.
- Se incorporó la edición de nombres y teléfono con validaciones y autorización por sesión y rol.
- El cambio de correo queda pendiente hasta confirmar un enlace de un solo uso; se añadieron migraciones para reservar la dirección nueva y guardar la ciudad opcional.
- Se añadieron pruebas de servicio y del flujo web, y se documentaron rutas y esquema.

## 2026-11-10 — Recuperación de contraseña (US-PAT-04)

- Se añadieron formularios para pedir un enlace y establecer una contraseña nueva.
- El correo de recuperación usa un token de un solo uso con vencimiento de 30 minutos; solo se almacena su hash y el cambio invalida enlaces pendientes.
- Las respuestas de solicitud son genéricas y se aplican los límites de cinco solicitudes por hora y una cada 60 segundos.
- Se añadieron pruebas de servicio y rutas, y se documentaron los endpoints.

## 2026-11-10 — Cierre de planificación del Sprint 0

- Se documentó como aprobado el diseño físico propuesto de 15 tablas a partir de historias, reglas de negocio y mockups revisados.
- Se registraron las decisiones aprobadas de autenticación, pruebas, zona horaria, CSRF, verificación de WhatsApp y acceso a observaciones clínicas.
- Se completó la revisión visual de las siete vistas recibidas y se aclaró que Google no forma parte del alcance actual.
- No se modificó el documento fuente de historias ni se añadieron migraciones.

## 2026-11-10 — Inicio y cierre de sesión (US-PAT-03)

- Se añadió la vista de inicio de sesión según el mockup, sin el acceso con Google que quedó fuera del alcance aprobado.
- Se incorporaron sesiones protegidas, validación CSRF en formularios, autenticación de pacientes activos con correo verificado y cierre de sesión.
- Se protegió el espacio inicial del paciente por autenticación y rol; el panel completo queda para su issue correspondiente.
- Se añadieron pruebas de acceso y documentación de las rutas. El almacenamiento en memoria de sesiones se limita al desarrollo local.

## 2026-11-10 — Verificación de correo (US-PAT-02)

- Se añadió envío de enlaces de verificación por SMTP configurable y activación de cuentas con token de un solo uso, vencimiento de 24 horas y almacenamiento únicamente del hash.
- Se añadió el reenvío con espera de 60 segundos y límite de cinco solicitudes por hora, contando también los fallos de entrega.
- Se añadieron `notification_outbox`, hasta tres intentos automáticos de entrega, pantallas de estado, migración del índice de límites, documentación y pruebas para los flujos de correo.

## 2026-11-03 — Incorporación del inventario de historias

- Se incorporó al índice el documento `MediTurno_35_Historias_de_Usuario.md` disponible en `docs/`.
- Se registraron los 35 IDs y nombres para facilitar navegación y trazabilidad.
- Se señalaron diferencias de nombre del producto y decisiones adicionales que deben confirmarse antes de implementar.
- No se implementó código ni se ejecutaron pruebas automatizadas.

## 2026-11-03 — Organización inicial en GitHub

- Se crearon los issues de seguimiento Sprint 0–8 (#1–#9), el scaffolding (#10), CI básico (#11) y un issue por cada historia (#12–#46).
- Se copiaron los criterios de las historias sin editarlos y se añadieron enlaces entre issues, sprints propuestos y documentación local.
- Se documentó el flujo de rama por issue, commits frecuentes, CI en PRs y PR hacia `develop` antes de iniciar el siguiente issue.
- No se crearon milestones/Projects porque la conexión GitHub disponible no expone esa operación; los sprints están representados por issues de seguimiento.
- No se implementó código ni se ejecutaron pruebas.
- Se creó el issue #47 para publicar la documentación del proyecto mediante un PR dedicado.

## 2026-11-03 — Documentación inicial

- Se inspeccionó el repositorio: únicamente existía `README.md` con el título del proyecto y el commit inicial `dba4468`.
- Se añadió documentación del alcance maestro, requisitos, reglas, entidades, rutas previstas, diseño visual, pruebas y plan de trabajo.
- Se marcaron expresamente como pendientes los criterios originales de historias, el diseño físico detallado y los artefactos visuales no presentes.
- No se implementó código de aplicación ni se ejecutaron pruebas automatizadas.


