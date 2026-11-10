# Issues por sprint — MediGo

Este documento relaciona los issues de seguimiento con las tareas y las historias asignadas a cada sprint. Los IDs y criterios de las historias se mantienen en el documento fuente; este archivo solo organiza su ejecución.

> **Planificación:** la distribución es una propuesta basada en el alcance documentado. No se definieron fechas ni duración. En GitHub, los sprints están representados mediante issues de seguimiento, no mediante milestones o iteraciones nativas.

## Sprint 0 — Cierre de planificación y documentación

**Seguimiento:** [Sprint 0 — issue #1](https://github.com/KDaniela06/ADSO-MediGo/issues/1)

**Issues incluidos:**

- [#47 — Publicar documentación del alcance y flujo de trabajo](https://github.com/KDaniela06/ADSO-MediGo/issues/47)
- [#49 — Mapear issues dentro de cada sprint](https://github.com/KDaniela06/ADSO-MediGo/issues/49)

**Cierre preparado:** diseño físico aprobado y documentado; mockups revisados; decisiones de alcance aprobadas y registradas. Los PR #48, #50 y #55 están fusionados. El cierre del issue #1 se completará al fusionar el PR de documentación de cierre hacia `develop`.

## Sprint 1 — Estructura técnica y CI básico

**Seguimiento:** [Sprint 1 — issue #2](https://github.com/KDaniela06/ADSO-MediGo/issues/2)

**Issues incluidos:**

- [#10 — Crear estructura inicial de MediGo](https://github.com/KDaniela06/ADSO-MediGo/issues/10)
- [#11 — Configurar GitHub Actions con pruebas básicas](https://github.com/KDaniela06/ADSO-MediGo/issues/11)

## Sprint 2 — Autenticación y perfiles

**Seguimiento:** [Sprint 2 — issue #3](https://github.com/KDaniela06/ADSO-MediGo/issues/3)

**Historias incluidas:**

- Paciente: [#12 US-PAT-01 Registro](https://github.com/KDaniela06/ADSO-MediGo/issues/12), [#13 US-PAT-02 Verificar correo](https://github.com/KDaniela06/ADSO-MediGo/issues/13), [#14 US-PAT-03 Iniciar/cerrar sesión](https://github.com/KDaniela06/ADSO-MediGo/issues/14), [#15 US-PAT-04 Recuperar contraseña](https://github.com/KDaniela06/ADSO-MediGo/issues/15), [#22 US-PAT-11 Perfil](https://github.com/KDaniela06/ADSO-MediGo/issues/22), [#23 US-PAT-12 Cambiar contraseña](https://github.com/KDaniela06/ADSO-MediGo/issues/23).
- Médico: [#33 US-DOC-08 Cambiar contraseña](https://github.com/KDaniela06/ADSO-MediGo/issues/33).
- Administrador: [#46 US-ADM-13 Administrar cuenta](https://github.com/KDaniela06/ADSO-MediGo/issues/46).

## Sprint 3 — Dashboards, pacientes y médicos

**Seguimiento:** [Sprint 3 — issue #4](https://github.com/KDaniela06/ADSO-MediGo/issues/4)

**Historias incluidas:**

- Paciente: [#16 US-PAT-05 Panel principal](https://github.com/KDaniela06/ADSO-MediGo/issues/16).
- Médico: [#26 US-DOC-01 Panel](https://github.com/KDaniela06/ADSO-MediGo/issues/26), [#27 US-DOC-02 Citas asignadas](https://github.com/KDaniela06/ADSO-MediGo/issues/27), [#28 US-DOC-03 Pacientes asignados](https://github.com/KDaniela06/ADSO-MediGo/issues/28), [#32 US-DOC-07 Agenda y perfil](https://github.com/KDaniela06/ADSO-MediGo/issues/32).
- Administrador: [#34 US-ADM-01 Panel](https://github.com/KDaniela06/ADSO-MediGo/issues/34), [#35 US-ADM-02 Gestionar pacientes](https://github.com/KDaniela06/ADSO-MediGo/issues/35), [#36 US-ADM-03 Registrar médico](https://github.com/KDaniela06/ADSO-MediGo/issues/36), [#37 US-ADM-04 Gestionar médicos](https://github.com/KDaniela06/ADSO-MediGo/issues/37), [#45 US-ADM-12 Activar/desactivar cuentas](https://github.com/KDaniela06/ADSO-MediGo/issues/45).

## Sprint 4 — Especialidades y disponibilidad

**Seguimiento:** [Sprint 4 — issue #5](https://github.com/KDaniela06/ADSO-MediGo/issues/5)

**Historias incluidas:**

- [#38 US-ADM-05 Gestionar especialidades](https://github.com/KDaniela06/ADSO-MediGo/issues/38)
- [#39 US-ADM-06 Configurar horarios médicos](https://github.com/KDaniela06/ADSO-MediGo/issues/39)
- [#40 US-ADM-07 Gestionar excepciones de agenda](https://github.com/KDaniela06/ADSO-MediGo/issues/40)

## Sprint 5 — Gestión de citas

**Seguimiento:** [Sprint 5 — issue #6](https://github.com/KDaniela06/ADSO-MediGo/issues/6)

**Historias incluidas:**

- Paciente: [#17 US-PAT-06 Reservar](https://github.com/KDaniela06/ADSO-MediGo/issues/17), [#18 US-PAT-07 Consultar citas](https://github.com/KDaniela06/ADSO-MediGo/issues/18), [#19 US-PAT-08 Cancelar](https://github.com/KDaniela06/ADSO-MediGo/issues/19), [#20 US-PAT-09 Reprogramar](https://github.com/KDaniela06/ADSO-MediGo/issues/20), [#21 US-PAT-10 Historial](https://github.com/KDaniela06/ADSO-MediGo/issues/21).
- Administrador: [#41 US-ADM-08 Consultar/buscar citas](https://github.com/KDaniela06/ADSO-MediGo/issues/41), [#42 US-ADM-09 Crear cita](https://github.com/KDaniela06/ADSO-MediGo/issues/42), [#43 US-ADM-10 Cancelar/reprogramar](https://github.com/KDaniela06/ADSO-MediGo/issues/43), [#44 US-ADM-11 Registrar inasistencia](https://github.com/KDaniela06/ADSO-MediGo/issues/44).

## Sprint 6 — Consultas médicas

**Seguimiento:** [Sprint 6 — issue #7](https://github.com/KDaniela06/ADSO-MediGo/issues/7)

**Historias incluidas:**

- [#29 US-DOC-04 Iniciar consulta](https://github.com/KDaniela06/ADSO-MediGo/issues/29)
- [#30 US-DOC-05 Observaciones y aclaraciones](https://github.com/KDaniela06/ADSO-MediGo/issues/30)
- [#31 US-DOC-06 Finalizar consulta](https://github.com/KDaniela06/ADSO-MediGo/issues/31)

## Sprint 7 — WhatsApp y notificaciones

**Seguimiento:** [Sprint 7 — issue #8](https://github.com/KDaniela06/ADSO-MediGo/issues/8)

**Historias incluidas:**

- [#24 US-PAT-13 Vincular WhatsApp](https://github.com/KDaniela06/ADSO-MediGo/issues/24)
- [#25 US-PAT-14 Gestionar citas por WhatsApp](https://github.com/KDaniela06/ADSO-MediGo/issues/25)

## Sprint 8 — Integración, revisión y cierre

**Seguimiento:** [Sprint 8 — issue #9](https://github.com/KDaniela06/ADSO-MediGo/issues/9)

Este sprint agrupa la verificación final de integración, seguridad, CI, pruebas de reglas críticas, accesibilidad, documentación y pendientes de entrega. No tiene historias de usuario adicionales asignadas.

## Reglas de ejecución por issue

1. Trabajar en una rama exclusiva creada desde `develop`.
2. Hacer commits pequeños y frecuentes con mensajes técnicos en inglés.
3. Ejecutar las pruebas básicas pertinentes y revisar el CI del PR.
4. Abrir un PR hacia `develop` y enlazar el issue.
5. No comenzar el siguiente issue hasta que la autora haya revisado y fusionado el PR actual.
6. Consultar a la autora antes de cambiar una historia o sus criterios.

## Conteo

- 9 issues de seguimiento de sprint: #1–#9.
- 2 issues técnicos: #10–#11.
- 35 issues de historias: #12–#46.
- 2 issues de documentación: #47 y #49.
