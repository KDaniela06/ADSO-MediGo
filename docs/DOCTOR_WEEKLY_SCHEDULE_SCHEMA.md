# Diseño físico de horarios semanales médicos

Este esquema implementa US-ADM-06 sin modificar los criterios de la historia. Conserva versiones anteriores del horario, permite varios bloques por día y usa los nombres de modelo que ya consume la vista de agenda médica.

## `doctor_weekly_schedules`

| Columna | Tipo MySQL | Reglas |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `doctor_id` | `BIGINT UNSIGNED` | Obligatorio, FK a `doctors.id` |
| `effective_from` | `DATE` | Primer día de vigencia en hora local de Colombia |
| `effective_to` | `DATE` | Opcional; último día de vigencia |
| `status` | `ENUM('ACTIVE','INACTIVE')` | La versión vigente queda activa; las anteriores se conservan inactivas |
| `created_at` | `DATETIME(3)` | Obligatorio |
| `updated_at` | `DATETIME(3)` | Obligatorio |

Índice de consulta: `(doctor_id, status, effective_from)`.

## `doctor_weekly_schedule_blocks`

| Columna | Tipo MySQL | Reglas |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `schedule_id` | `BIGINT UNSIGNED` | Obligatorio, FK a `doctor_weekly_schedules.id` |
| `weekday` | `TINYINT UNSIGNED` | De 1 a 7: lunes a domingo |
| `starts_at` | `TIME` | Hora local de inicio |
| `ends_at` | `TIME` | Hora local de fin |

El bloque también incluye `created_at` y `updated_at`. Una restricción única impide dos bloques con el mismo inicio en un día y versión. La aplicación valida intervalos de 30 minutos, fin posterior al inicio y ausencia de superposición entre bloques del mismo día.

## Actualización de horario

La pantalla presenta una vista previa de las citas futuras confirmadas que quedarían fuera de los nuevos bloques. El administrador debe confirmar esa lista. La aplicación vuelve a calcularla dentro de la transacción; si cambió desde la vista previa, pide confirmar la lista actualizada.

Al confirmar, crea una nueva versión, conserva la anterior, cancela las citas afectadas dentro de la misma transacción y escribe los cambios en `audit_logs`. Después de confirmar la transacción, envía un correo a cada paciente afectado. Las citas están almacenadas como instantes y se comparan con los bloques usando `America/Bogota`.

No se borran citas ni versiones históricas del horario.
