# Registro de cambios

Los cambios se registran en orden descendente. No se atribuyen funcionalidades de aplicación a cambios que solo añaden documentación.

## 2026-11-10 — Cierre de planificación del Sprint 0

- Se documentó como aprobado el diseño físico propuesto de 15 tablas a partir de historias, reglas de negocio y mockups revisados.
- Se registraron las decisiones aprobadas de autenticación, pruebas, zona horaria, CSRF, verificación de WhatsApp y acceso a observaciones clínicas.
- Se completó la revisión visual de las siete vistas recibidas y se aclaró que Google no forma parte del alcance actual.
- No se modificó el documento fuente de historias ni se añadieron migraciones.

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


