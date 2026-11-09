# MediGo

MediGo es el proyecto acadÃ©mico de una plataforma web para la gestiÃ³n de citas mÃ©dicas. Su alcance previsto incluye pacientes, mÃ©dicos y administraciÃ³n; reservas, consultas mÃ©dicas, notificaciones por correo y un chatbot de WhatsApp sujeto a integraciÃ³n oficial.

> **Estado del repositorio:** contiene la documentaciÃ³n de planificaciÃ³n y el esqueleto tÃ©cnico inicial. Las historias describen el alcance previsto; cada funcionalidad se incorporarÃ¡ mediante su propio issue y PR.

## DocumentaciÃ³n

- [Resumen del proyecto](docs/PROJECT_OVERVIEW.md)
- [Requisitos funcionales y no funcionales](docs/REQUIREMENTS.md)
- [Inventario e historias de usuario](docs/USER_STORIES.md)
- [Documento consolidado de las 35 historias](docs/MediTurno_35_Historias_de_Usuario.md)
- [Reglas de negocio](docs/BUSINESS_RULES.md)
- [DiseÃ±o de datos](docs/DATABASE_DESIGN.md)
- [Relaciones de entidades](docs/ENTITY_RELATIONSHIP.md)
- [Migraciones y datos iniciales](docs/DATABASE_MIGRATIONS.md)
- [API y rutas previstas](docs/API_DOCUMENTATION.md)
- [Interfaz e identidad visual](docs/UI_DESIGN.md)
- [Pruebas](docs/TESTING.md)
- [Plan de sprints](docs/SPRINTS.md)
- [Issues y commits](docs/ISSUES_AND_COMMITS.md)
- [Registro de cambios](docs/CHANGELOG.md)
- [DiagnÃ³stico del repositorio](docs/REPOSITORY_DIAGNOSTIC.md)

## TecnologÃ­as acordadas

Node.js, Express, Pug, Tailwind CSS, MySQL, Sequelize, Jest, JavaScript y Git/GitHub. La interfaz se construirÃ¡ con Pug y Tailwind; no se contempla React, Angular ni Vue. Consulta [PROJECT_OVERVIEW](docs/PROJECT_OVERVIEW.md) para las convenciones y lÃ­mites.

## EjecuciÃ³n local

1. Instala Node.js 20 o superior.
2. Copia `.env.example` a `.env` y ajusta las variables si vas a conectar MySQL.
3. Ejecuta `npm install`.
4. Ejecuta `npm run dev` y abre `http://localhost:3000`.

La estructura inicial estÃ¡ en `src/`: configuraciÃ³n en `config/`, rutas en `routes/` y plantillas Pug en `views/`. Las referencias visuales aprobadas se agrupan por mÃ³dulo en [`design/mockups`](design/mockups/README.md). El esquema fÃ­sico aÃºn no estÃ¡ configurado; la aplicaciÃ³n puede iniciar sin conectarse a MySQL.

Comandos disponibles: `npm start` construye el CSS y levanta el servidor; `npm test` ejecuta Jest; `npm run build:css` genera el CSS de producciÃ³n.

## Flujo de contribuciÃ³n

Trabajaremos un issue a la vez: rama desde `develop`, commits pequeÃ±os y frecuentes, pruebas/CI bÃ¡sico y PR hacia `develop`. El siguiente issue comienza cuando el PR actual estÃ© abierto para revisiÃ³n. No se cambiarÃ¡n historias sin consultar primero.

## Estado actual

La aplicaciÃ³n base se puede iniciar siguiendo la secciÃ³n de ejecuciÃ³n local. Las funcionalidades de pacientes, mÃ©dicos y administraciÃ³n se implementarÃ¡n en los sprints y issues asignados.

GitHub tiene issues de seguimiento para los sprints #1â€“#9, tareas tÃ©cnicas #10â€“#11, historias #12â€“#46 y documentaciÃ³n #47 y #49. Los sprints estÃ¡n representados mediante issues de seguimiento porque no se configuraron milestones o Projects.

## Idioma

El cÃ³digo, nombres de archivos y comentarios se escribirÃ¡n en inglÃ©s. La interfaz, mensajes al usuario y documentaciÃ³n funcional se mantendrÃ¡n en espaÃ±ol.


