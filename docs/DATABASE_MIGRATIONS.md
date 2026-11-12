# Migraciones y datos iniciales

## Estado actual

Los issues #12 y #13 incluyen migraciones Sequelize para las tablas del registro y verificación de pacientes: `users`, `patients`, `account_tokens` y `notification_outbox`, más el índice compuesto para aplicar los límites de reenvío. La historia #27 agrega `specialties`, `doctors` y `appointments`, con claves foráneas e índices para consultas por médico/paciente, fecha y estado. El runner registra cada migración aplicada en `schema_migrations`.

El diseño físico de registro está en [USER_REGISTRATION_SCHEMA.md](USER_REGISTRATION_SCHEMA.md). La issue #36 incorpora una migración para permitir `password_hash` nulo durante invitaciones médicas, añadir `password_configured_at` y aceptar el propósito `DOCTOR_INVITATION` en `account_tokens`.
La historia #22 incorpora dos migraciones: `202611100002-add-patient-profile-email-change` añade `users.pending_email` y el propósito `EMAIL_CHANGE` a `account_tokens`; `202611100003-add-patient-city` añade la ciudad opcional a `patients`. El correo vigente no se reemplaza hasta que el paciente confirme el enlace. La migración `202611100004-create-doctor-appointments` crea las tablas base de especialidades, médicos y citas siguiendo el diseño físico aprobado. La migración `202611120001-create-doctor-weekly-schedules` crea `doctor_weekly_schedules` y `doctor_weekly_schedule_blocks` para administrar versiones semanales de disponibilidad sin borrar horarios anteriores. El detalle de columnas y reglas está en [DOCTOR_WEEKLY_SCHEDULE_SCHEMA.md](DOCTOR_WEEKLY_SCHEDULE_SCHEMA.md).


## Ejecutar la migración

1. Configura `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `.env`.
2. Para enviar mensajes, configura también `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `APP_BASE_URL`.
3. Ejecuta `npm run db:migrate`.

La migración `202611100005-create-audit-logs` crea la bitácora genérica aprobada; en la gestión de pacientes registra actor, entidad, estado anterior/nuevo y fecha, sin guardar datos clínicos.\n\nEl runner omite migraciones ya registradas. La migración exporta `down(queryInterface)` para rollback manual; el runner no aplica rollbacks. No se generan datos personales de pacientes en seeders y no se incluyen credenciales iniciales.

## Convenciones

- Una migración pequeña y reversible por cambio de esquema.
- Nombres técnicos en inglés y documentación funcional en español.
- No editar migraciones aplicadas para simular cambios; agregar una migración correctiva.
- Mantener claves foráneas, índices y restricciones únicas en la base de datos.
- No almacenar contraseñas, tokens originales ni secretos en fixtures o migraciones.
- Revisar cuidadosamente operaciones destructivas antes de ejecutarlas en un entorno compartido.

## Próximos pasos

Completar las migraciones restantes cuando se implementen sus historias y se definan las columnas físicas correspondientes. Crear seeders solo para catálogos aprobados. El usuario administrador inicial se configurará por un procedimiento seguro de despliegue, nunca con una contraseña fija publicada.

