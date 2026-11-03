# Plan de sprints

## Sprint 0: planificación y diseño

El contexto indica que se definieron identidad, roles, reglas, esquema inicial de 15 tablas, 35 historias, paleta y mockups de autenticación, dashboards, citas, consulta, administración, perfiles, especialidades y WhatsApp. También indica que la auditoría visual dejó detalles pendientes. Por tanto, Sprint 0 no se considera cerrado hasta recuperar los artefactos originales y aprobar esos pendientes.

## Sprints propuestos

La siguiente agrupación deriva de las historias existentes; conserva sus textos e IDs. Las fechas y duraciones quedan abiertas. Sprint 0 sigue abierto según el documento fuente.

| Sprint | Enfoque | Historias relacionadas | Seguimiento GitHub |
|---|---|---|---|
| Sprint 0 | Cierre de planificación: revisar historias, mockups, auditoría visual y diseño físico | Sin historias asignadas | [#1](https://github.com/KDaniela06/ADSO-MediGo/issues/1), [documentación #47](https://github.com/KDaniela06/ADSO-MediGo/issues/47) |
| Sprint 1 | Estructura técnica, configuración y CI básico | Issues técnicos de estructura y CI | [#2](https://github.com/KDaniela06/ADSO-MediGo/issues/2) |
| Sprint 2 | Autenticación y perfiles | US-PAT-01–04, US-PAT-11–12, US-DOC-08, US-ADM-13 | [#3](https://github.com/KDaniela06/ADSO-MediGo/issues/3) |
| Sprint 3 | Dashboards, pacientes y gestión de médicos | US-PAT-05, US-DOC-01–03, US-DOC-07, US-ADM-01–04, US-ADM-12 | [#4](https://github.com/KDaniela06/ADSO-MediGo/issues/4) |
| Sprint 4 | Especialidades, disponibilidad y excepciones | US-ADM-05–07 | [#5](https://github.com/KDaniela06/ADSO-MediGo/issues/5) |
| Sprint 5 | Reserva y administración de citas | US-PAT-06–10, US-ADM-08–11 | [#6](https://github.com/KDaniela06/ADSO-MediGo/issues/6) |
| Sprint 6 | Consultas médicas | US-DOC-04–06 | [#7](https://github.com/KDaniela06/ADSO-MediGo/issues/7) |
| Sprint 7 | Vinculación y chatbot de WhatsApp | US-PAT-13–14 | [#8](https://github.com/KDaniela06/ADSO-MediGo/issues/8) |
| Sprint 8 | Revisión de integración, seguridad, pruebas y documentación | Issues de cierre pendientes | [#9](https://github.com/KDaniela06/ADSO-MediGo/issues/9) |

Esta asignación organiza trabajo; no modifica criterios ni alcance de las historias. Consultar a la autora antes de cambiar cualquier requisito.

## Secuencia recomendada

| Orden | Bloque | Dependencias/salida esperada |
|---:|---|---|
| 1 | Preparar entorno y estructura | Convenciones, configuración y estructura existente inspeccionada. |
| 2 | Base de datos y migraciones | Diseño físico aprobado y persistencia íntegra. |
| 3 | Autenticación y seguridad | Usuarios, sesiones, correo verificado, tokens y límites. |
| 4 | Gestión de pacientes | Perfil, restricciones y permisos de propiedad. |
| 5 | Gestión de médicos | Invitaciones, perfiles y estados. |
| 6 | Especialidades y horarios | Catálogo, disponibilidad y excepciones. |
| 7 | Gestión de citas | Reserva segura, consulta, cancelación, reprogramación e historial. |
| 8 | Consultas médicas | Atención, observación original y aclaraciones. |
| 9 | Administración | Gestión operativa, vistas previas y auditoría. |
| 10 | Notificaciones | Outbox y correo con reintentos. |
| 11 | WhatsApp | Vinculación y chatbot con proveedor oficial. |
| 12 | Revisión final | Pruebas, seguridad, documentación y correcciones. |

El orden se ajustará a dependencias y issues aprobados. Cada bloque se divide en issues pequeños; no se asume estado terminado por aparecer en este plan.

## Estado observado

El repositorio no contiene implementación. GitHub tiene ramas `main` y `develop`, 47 issues abiertos (#1–#47) y ningún PR al momento de consulta. La conexión disponible permite gestionar issues, pero no crear milestones/Projects; por ahora los sprints están representados como issues de seguimiento con checklists hacia sus historias.

