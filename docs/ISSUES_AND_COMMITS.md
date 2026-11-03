# Issues y commits

## Estado observado

Se crearon en GitHub los issues #1–#9 como seguimientos de Sprint 0–8, #10–#11 para la estructura inicial y CI, #12–#46 para las 35 historias y #47 para publicar la documentación. La asignación de historias a sprints es una propuesta de planificación. El conector disponible no permite crear milestones ni Projects; los issues de sprint funcionan como seguimiento y enlazan sus tareas.

El único commit local observado sigue siendo `dba4468` (`Initial commit`); aún no se han creado ramas de desarrollo, commits funcionales ni PRs. La creación de issues no altera las historias fuente.

## Convenciones acordadas

- Ramas en inglés, por ejemplo `feature/patient-registration`, `feature/appointment-booking`, `fix/appointment-validation` y `test/patient-registration`.
- Commits breves en inglés y con prefijo convencional: `feat:`, `fix:`, `test:`, `docs:`.
- Dividir el trabajo por issue y crear más de un commit cuando haya cambios coherentes distintos; no agrupar todo en un commit monolítico ni crear commits vacíos.
- Documentar en español qué se añadió/modificó, para qué sirve, qué puede hacer el usuario y qué pruebas se ejecutaron.
- No afirmar que se creó un issue, commit o push sin evidencia del comando/servicio correspondiente.

## Flujo obligatorio por issue

1. Crear una rama exclusiva desde `develop`: `feature/<numero-issue>-<descripcion-corta>` (o `fix/`, `test/`, `docs/` según aplique).
2. Trabajar solo el alcance del issue y hacer commits pequeños y frecuentes con mensajes descriptivos en inglés.
3. Agregar o actualizar pruebas básicas pertinentes; CI corre al abrir o actualizar un PR hacia `develop`.
4. Abrir un PR hacia `develop`, enlazar el issue y describir cambios, pruebas y resultado de CI.
5. No comenzar el siguiente issue hasta que el PR actual esté abierto para revisión. La fusión se realiza según la revisión acordada; no asumir permiso para fusionar automáticamente.

No modificar texto, alcance ni criterios de las historias sin consultar primero a la autora.

## Formato para registrar un issue

```markdown
### #ID — Título
- Historia relacionada:
- Objetivo y alcance:
- Criterios de aceptación:
- Archivos/componentes previstos:
- Estado:
- PR/commits:
- Pruebas ejecutadas y resultado:
```

## Ejemplos de mensajes

```text
feat: add patient registration form
feat: validate patient age
fix: prevent duplicate confirmed appointments
test: add patient registration tests
docs: document appointment rules
```

