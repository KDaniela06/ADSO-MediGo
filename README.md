# MediGo

MediGo es el proyecto académico de una plataforma web para la gestión de citas médicas. Su alcance previsto incluye pacientes, médicos y administración; reservas, consultas médicas, notificaciones por correo y un chatbot de WhatsApp sujeto a integración oficial.

> **Estado del repositorio:** contiene documentación de planificación, incluido el inventario de 35 historias. No se encontraron aplicación, dependencias, modelos, migraciones, vistas ni pruebas implementadas. La documentación describe el alcance previsto, no funcionalidades ya construidas.

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

## Flujo de contribución

Trabajaremos un issue a la vez: rama desde `develop`, commits pequeños y frecuentes, pruebas/CI básico y PR hacia `develop`. El siguiente issue comienza cuando el PR actual esté abierto para revisión. No se cambiarán historias sin consultar primero.

## Estado actual

El único commit disponible es `dba4468` (`Initial commit`). No se detectaron scripts de instalación, ejecución o pruebas; por tanto, todavía no hay instrucciones ejecutables para levantar la aplicación. El diagnóstico se actualizará cuando se agregue código.

GitHub tiene 47 issues iniciales: sprints propuestos #1–#9, tareas técnicas #10–#11, historias #12–#46 y documentación #47. Los sprints están representados mediante issues de seguimiento porque la conexión disponible no permite crear milestones/Projects.

## Idioma

El código, nombres de archivos y comentarios se escribirán en inglés. La interfaz, mensajes al usuario y documentación funcional se mantendrán en español.

