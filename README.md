# MediGo

MediGo es el proyecto académico de una plataforma web para la gestión de citas médicas. Su alcance previsto incluye pacientes, médicos y administración; reservas, consultas médicas, notificaciones por correo y un chatbot de WhatsApp sujeto a integración oficial.

> **Estado del repositorio:** contiene la documentación de planificación y el esqueleto técnico inicial. Las historias describen el alcance previsto; cada funcionalidad se incorporará mediante su propio issue y PR.

## Documentación

- [Resumen del proyecto](docs/PROJECT_OVERVIEW.md)
- [Requisitos funcionales y no funcionales](docs/REQUIREMENTS.md)
- [Inventario e historias de usuario](docs/USER_STORIES.md)
- [Documento consolidado de las 35 historias](docs/MediTurno_35_Historias_de_Usuario.md)
- [Reglas de negocio](docs/BUSINESS_RULES.md)
- [Diseño de datos](docs/DATABASE_DESIGN.md)
- [Relaciones de entidades](docs/ENTITY_RELATIONSHIP.md)
- [Migraciones y datos iniciales](docs/DATABASE_MIGRATIONS.md)
- [API y rutas previstas](docs/API_DOCUMENTATION.md)
- [Interfaz e identidad visual](docs/UI_DESIGN.md)
- [Pruebas](docs/TESTING.md)
- [Plan de sprints](docs/SPRINTS.md)
- [Issues y commits](docs/ISSUES_AND_COMMITS.md)
- [Registro de cambios](docs/CHANGELOG.md)
- [Diagnóstico del repositorio](docs/REPOSITORY_DIAGNOSTIC.md)

## Tecnologías acordadas

Node.js, Express, Pug, Tailwind CSS, MySQL, Sequelize, Jest, JavaScript y Git/GitHub. La interfaz se construirá con Pug y Tailwind; no se contempla React, Angular ni Vue. Consulta [PROJECT_OVERVIEW](docs/PROJECT_OVERVIEW.md) para las convenciones y límites.

## Ejecución local

1. Instala Node.js 20 o superior.
2. Copia `.env.example` a `.env` y ajusta las variables si vas a conectar MySQL.
3. Ejecuta `npm install`.
4. Ejecuta `npm run dev` y abre `http://localhost:3000`.

El código está organizado por módulos dentro de `src/modules/` (`auth`, `patient`, `doctor` y `admin`), donde cada funcionalidad tendrá sus rutas, controladores, servicios y plantillas Pug. Los elementos visuales compartidos están en `src/views/shared/`; las referencias para replicar las pantallas están en [`design/mockups`](design/mockups/README.md). El esquema físico aún no está configurado y la aplicación puede iniciar sin conectarse a MySQL.

Comandos disponibles: `npm start` construye el CSS y levanta el servidor; `npm test` ejecuta Jest; `npm run build:css` genera el CSS de producción.

## Registro de pacientes

El esquema propuesto para el registro está documentado en [USER_REGISTRATION_SCHEMA](docs/USER_REGISTRATION_SCHEMA.md). Con MySQL configurado en `.env`, ejecuta `npm run db:migrate` para crear las tablas de registro y el índice de límites de verificación. Para entregar correo, configura `APP_BASE_URL` y los valores SMTP de `.env.example`. El paciente permanece sin acceso hasta verificar su correo.

## Flujo de contribución

Trabajaremos un issue a la vez: rama desde `develop`, commits pequeños y frecuentes, pruebas/CI básico y PR hacia `develop`. El siguiente issue comienza cuando el PR actual esté abierto para revisión. No se cambiarán historias sin consultar primero.

## Estado actual

La aplicación base se puede iniciar siguiendo la sección de ejecución local. Las funcionalidades de pacientes, médicos y administración se implementarán en los sprints y issues asignados.

GitHub tiene issues de seguimiento para los sprints #1–#9, tareas técnicas #10–#11, historias #12–#46 y documentación #47 y #49. Los sprints están representados mediante issues de seguimiento porque no se configuraron milestones o Projects.

## Idioma

El código, nombres de archivos y comentarios se escribirán en inglés. La interfaz, mensajes al usuario y documentación funcional se mantendrán en español.


