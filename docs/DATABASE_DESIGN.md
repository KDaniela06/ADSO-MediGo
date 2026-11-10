# Diseño de datos

## Estado

El diseño físico propuesto para las 15 tablas fue aprobado por la autora al fusionar el PR #55. El detalle de columnas, relaciones, restricciones y decisiones está en [DATABASE_PHYSICAL_PROPOSAL.md](DATABASE_PHYSICAL_PROPOSAL.md).

El modelo se elaboró con las historias de usuario, reglas de negocio y mockups disponibles. No se encontró un diagrama físico previo; por eso se conserva como diseño del proyecto acordado, no como transcripción de un artefacto externo. Las historias se mantienen sin cambios.

## Inventario aprobado

1. `users`
2. `patients`
3. `doctors`
4. `specialties`
5. `doctor_weekly_schedules`
6. `doctor_weekly_schedule_blocks`
7. `doctor_schedule_exceptions`
8. `doctor_schedule_exception_blocks`
9. `appointments`
10. `consultations`
11. `consultation_addenda`
12. `account_tokens`
13. `whatsapp_conversations`
14. `notification_outbox`
15. `audit_logs`

## Relaciones principales

- `users` 1:0..1 `patients` y 1:0..1 `doctors`.
- `specialties` 1:N `doctors` y 1:N `appointments`.
- `doctors` 1:N `doctor_weekly_schedules` y 1:N `doctor_schedule_exceptions`.
- Las configuraciones semanales y excepciones tienen sus respectivos bloques de detalle.
- `patients` y `doctors` 1:N `appointments`.
- `appointments` 1:0..1 `consultations`; `consultations` 1:N `consultation_addenda`.
- `users` 1:N `account_tokens` y 1:N `audit_logs`.
- `patients` 1:N `whatsapp_conversations`; los avisos se registran en `notification_outbox`.

## Reglas de persistencia

- MySQL con InnoDB y `utf8mb4`; la versión mínima se define antes de implementar restricciones dependientes de versión.
- Instantes persistidos en UTC con precisión de milisegundos; la interfaz los presenta en `America/Bogota`.
- Unicidad para correo, identificación compuesta, perfil por usuario, registro profesional y WhatsApp vinculado.
- Las operaciones de reserva y reprogramación usan transacciones y validación de concurrencia en base de datos.
- `audit_logs` conserva actor y cambios operativos permitidos; nunca guarda contraseñas, tokens, códigos ni observaciones clínicas.
- Las observaciones clínicas son visibles solo para el médico autorizado; la aplicación aplica autorización en servidor.
- Contraseñas, tokens y códigos de verificación se almacenan mediante hashes seguros, nunca en texto plano.
- Este diseño no incorpora diagnósticos, prescripciones ni una historia clínica completa.

## Implementación

El diseño lógico aprobado no equivale a que las 15 tablas estén implementadas. Las migraciones se agregan por issues funcionales en ramas separadas y pasan por PR a `develop`. Las tablas de registro y verificación de cuenta se documentan en [USER_REGISTRATION_SCHEMA.md](USER_REGISTRATION_SCHEMA.md) y fueron abordadas en los issues #12 y #13.
