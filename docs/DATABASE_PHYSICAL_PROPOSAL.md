# Propuesta de diseño físico de la base de datos

> **Estado: propuesta para revisión.** Se elaboró a partir de las historias de usuario, reglas de negocio y vistas disponibles en \`design/mockups/\`. No se encontró un diagrama físico aprobado con los nombres y columnas originales. Este documento no cambia las historias ni autoriza todavía crear migraciones.

## Criterios usados

- Se conserva el inventario de 15 tablas del diseño lógico existente.
- Las vistas sirven para identificar datos visibles; las historias y reglas describen procesos, relaciones y restricciones.
- Identificadores, nombres de tablas y columnas se proponen en inglés para mantener consistencia con el código.
- Tipos MySQL son una propuesta para revisión. Se asume InnoDB y \`utf8mb4\`; confirmar la versión exacta antes de depender de restricciones \`CHECK\`.
- Se propone almacenar instantes en UTC con \`DATETIME(3)\` y convertir a \`America/Bogota\` en la interfaz. Esta decisión debe aprobarse junto con la revisión de las historias.
- Las contraseñas, tokens y códigos de verificación nunca se almacenan en texto plano.
- No se incluyen diagnósticos, prescripciones ni historia clínica completa.

## Inventario propuesto

| # | Tabla | Propósito |
|---:|---|---|
| 1 | \`users\` | Identidad, acceso, contacto y rol común |
| 2 | \`patients\` | Datos complementarios y vinculación WhatsApp del paciente |
| 3 | \`doctors\` | Perfil profesional del médico |
| 4 | \`specialties\` | Catálogo de especialidades |
| 5 | \`doctor_weekly_schedules\` | Vigencia de una configuración semanal |
| 6 | \`doctor_weekly_schedule_blocks\` | Bloques horarios por día de semana |
| 7 | \`doctor_schedule_exceptions\` | Excepciones con rango de fechas y motivo |
| 8 | \`doctor_schedule_exception_blocks\` | Días/horas bloqueados dentro de una excepción |
| 9 | \`appointments\` | Reservas y su estado actual |
| 10 | \`consultations\` | Atención asociada a una cita |
| 11 | \`consultation_addenda\` | Aclaraciones posteriores inmutables |
| 12 | \`account_tokens\` | Tokens de verificación y recuperación |
| 13 | \`whatsapp_conversations\` | Estado temporal de conversaciones iniciadas por pacientes |
| 14 | \`notification_outbox\` | Entregas pendientes y resultado de notificaciones |
| 15 | \`audit_logs\` | Registro de acciones sensibles y su responsable |

## Columnas propuestas

Los campos marcados como opcionales aceptan \`NULL\`. Las marcas de tiempo de auditoría y negocio usan \`DATETIME(3)\`, salvo las fechas civiles y horas recurrentes, que usan \`DATE\` y \`TIME\`.

### 1. \`users\`

La propuesta ya usada por el registro de pacientes se mantiene como referencia.

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK, autoincremental |
| \`document_type\` | \`ENUM('CC','CE','PASSPORT')\` | Obligatorio |
| \`document_number\` | \`VARCHAR(30)\` | Obligatorio; normalizado |
| \`first_name\` | \`VARCHAR(100)\` | Obligatorio |
| \`last_name\` | \`VARCHAR(100)\` | Obligatorio |
| \`email\` | \`VARCHAR(254)\` | Obligatorio; minúsculas y único |
| \`phone\` | \`VARCHAR(30)\` | Obligatorio |
| \`password_hash\` | \`VARCHAR(255)\` | Obligatorio |
| \`role\` | \`ENUM('PATIENT','DOCTOR','ADMIN')\` | Obligatorio |
| \`status\` | \`ENUM('PENDING_VERIFICATION','ACTIVE','INACTIVE')\` | Obligatorio |
| \`email_verified_at\` | \`DATETIME(3)\` | Opcional |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

Restricciones: único por (\`document_type\`, \`document_number\`) y por \`email\`.

### 2. \`patients\`

La vista de registro muestra fecha de nacimiento y aceptación de términos/privacidad. La vista del perfil también muestra ciudad opcional y permite cambiar el contacto.

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`user_id\` | \`BIGINT UNSIGNED\` | FK único a \`users.id\` |
| \`date_of_birth\` | \`DATE\` | Obligatoria; edad mínima validada en servidor |
| \`city\` | \`VARCHAR(100)\` | Opcional; visible en el mockup |
| \`terms_accepted_at\`, \`privacy_accepted_at\` | \`DATETIME(3)\` | Evidencia de aceptación |
| \`terms_version\`, \`privacy_version\` | \`VARCHAR(32)\` | Versión presentada |
| \`whatsapp_phone\` | \`VARCHAR(30)\` | Opcional; único si existe |
| \`whatsapp_consent_at\` | \`DATETIME(3)\` | Opcional |
| \`whatsapp_verified_at\` | \`DATETIME(3)\` | Opcional |
| \`whatsapp_verification_code_hash\` | \`CHAR(64)\` | Opcional; nunca el código original |
| \`whatsapp_verification_expires_at\` | \`DATETIME(3)\` | Opcional |
| \`whatsapp_verification_attempts\` | \`TINYINT UNSIGNED\` | Propuesta: contador limitado por regla |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

La relación paciente-usuario es uno a uno. El teléfono de contacto general vive en \`users.phone\`; el número de WhatsApp puede ser distinto.

### 3. \`doctors\`

El mockup de perfil muestra registro profesional, descripción y fotografía; nombre, correo y teléfono se obtienen de \`users\`.

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`user_id\` | \`BIGINT UNSIGNED\` | FK único a \`users.id\` |
| \`specialty_id\` | \`BIGINT UNSIGNED\` | FK a \`specialties.id\` |
| \`professional_registration\` | \`VARCHAR(80)\` | Obligatorio y único |
| \`professional_description\` | \`TEXT\` | Opcional |
| \`profile_photo_url\` | \`VARCHAR(2048)\` | Opcional; guardar referencia, no binario |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

El estado activo/inactivo se toma de \`users.status\` para evitar dos fuentes de verdad. Confirmar si se necesita un estado profesional independiente.

### 4. \`specialties\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`name\` | \`VARCHAR(100)\` | Obligatorio y único |
| \`description\` | \`VARCHAR(500)\` | Opcional |
| \`status\` | \`ENUM('ACTIVE','INACTIVE')\` | Obligatorio |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

### 5–6. \`doctor_weekly_schedules\` y \`doctor_weekly_schedule_blocks\`

Se separa la vigencia de la configuración de sus bloques semanales. Así se puede conservar la configuración anterior cuando cambie el horario.

**\`doctor_weekly_schedules\`**

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`doctor_id\` | \`BIGINT UNSIGNED\` | FK a \`doctors.id\` |
| \`effective_from\` | \`DATE\` | Inicio de vigencia |
| \`effective_to\` | \`DATE\` | Opcional; fin inclusivo |
| \`status\` | \`ENUM('ACTIVE','INACTIVE')\` | Obligatorio |
| \`created_by_user_id\` | \`BIGINT UNSIGNED\` | FK a \`users.id\` |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

**\`doctor_weekly_schedule_blocks\`**

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`weekly_schedule_id\` | \`BIGINT UNSIGNED\` | FK a \`doctor_weekly_schedules.id\` |
| \`weekday\` | \`TINYINT UNSIGNED\` | Propuesta: 1=lunes a 7=domingo |
| \`starts_at\`, \`ends_at\` | \`TIME\` | Obligatorios; fin posterior al inicio |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

Los bloques no pueden cruzar medianoche ni superponerse para el mismo médico y día. Las comprobaciones de solapamiento requieren lógica transaccional en la aplicación.

### 7–8. \`doctor_schedule_exceptions\` y \`doctor_schedule_exception_blocks\`

La cabecera representa una excepción de uno o varios días; el detalle guarda los intervalos concretos de cada fecha. Un detalle con horas nulas se propone como bloqueo de día completo.

**\`doctor_schedule_exceptions\`**

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`doctor_id\` | \`BIGINT UNSIGNED\` | FK a \`doctors.id\` |
| \`starts_on\`, \`ends_on\` | \`DATE\` | Rango inclusivo |
| \`reason\` | \`VARCHAR(255)\` | Obligatorio |
| \`status\` | \`ENUM('ACTIVE','CANCELLED')\` | Obligatorio |
| \`created_by_user_id\` | \`BIGINT UNSIGNED\` | FK a \`users.id\` |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

**\`doctor_schedule_exception_blocks\`**

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`exception_id\` | \`BIGINT UNSIGNED\` | FK a \`doctor_schedule_exceptions.id\` |
| \`exception_date\` | \`DATE\` | Debe caer dentro del rango |
| \`starts_at\`, \`ends_at\` | \`TIME\` | Ambos nulos para día completo; si no, intervalo válido |
| \`created_at\` | \`DATETIME(3)\` | Obligatorio |

### 9. \`appointments\`

Cada cita conserva los datos necesarios para mostrar su historial aunque cambien después la especialidad o el horario del médico.

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`patient_id\` | \`BIGINT UNSIGNED\` | FK a \`patients.id\` |
| \`doctor_id\` | \`BIGINT UNSIGNED\` | FK a \`doctors.id\` |
| \`specialty_id\` | \`BIGINT UNSIGNED\` | FK a \`specialties.id\`; valor al reservar |
| \`starts_at\`, \`ends_at\` | \`DATETIME(3)\` | Instantes UTC; duración propuesta de 30 min |
| \`status\` | \`ENUM('CONFIRMED','IN_PROGRESS','ATTENDED','CANCELLED','NO_SHOW')\` | Estado actual |
| \`created_by_user_id\` | \`BIGINT UNSIGNED\` | FK opcional a \`users.id\`; nulo para reserva del paciente si no se desea duplicar actor |
| \`cancelled_at\` | \`DATETIME(3)\` | Opcional |
| \`cancellation_reason\` | \`VARCHAR(255)\` | Opcional |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

Índices propuestos: (\`doctor_id\`, \`starts_at\`, \`status\`) y (\`patient_id\`, \`starts_at\`, \`status\`). La reserva y reprogramación deben validar disponibilidad y concurrencia en una transacción. La regla de una cita futura confirmada por paciente depende de la hora actual y se comprueba bajo bloqueo transaccional; no se expresa como índice único estático. Los cambios de fecha, estado y actor se reflejan en \`audit_logs\` para conservar trazabilidad sin agregar una tabla número 16.

### 10. \`consultations\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`appointment_id\` | \`BIGINT UNSIGNED\` | FK único a \`appointments.id\` |
| \`doctor_id\` | \`BIGINT UNSIGNED\` | FK a \`doctors.id\`; médico asignado |
| \`status\` | \`ENUM('IN_PROGRESS','COMPLETED')\` | Obligatorio |
| \`notes\` | \`TEXT\` | Opcional; observación, sin historia clínica completa |
| \`started_at\`, \`completed_at\` | \`DATETIME(3)\` | \`completed_at\` opcional |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

Una cita tiene como máximo una consulta. La observación original queda inmutable después de completar.

### 11. \`consultation_addenda\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`consultation_id\` | \`BIGINT UNSIGNED\` | FK a \`consultations.id\` |
| \`doctor_id\` | \`BIGINT UNSIGNED\` | FK a \`doctors.id\`; autor |
| \`content\` | \`TEXT\` | Obligatorio |
| \`created_at\` | \`DATETIME(3)\` | Obligatorio; registro inmutable |

### 12. \`account_tokens\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`user_id\` | \`BIGINT UNSIGNED\` | FK a \`users.id\` |
| \`purpose\` | \`ENUM('EMAIL_VERIFICATION','PASSWORD_RESET','DOCTOR_INVITATION')\` | Obligatorio |
| \`token_hash\` | \`CHAR(64)\` | Único; SHA-256 |
| \`expires_at\` | \`DATETIME(3)\` | Obligatorio |
| \`used_at\` | \`DATETIME(3)\` | Opcional |
| \`created_at\` | \`DATETIME(3)\` | Obligatorio |

Índice propuesto: (\`user_id\`, \`purpose\`, \`created_at\`) para límites de reenvío. Confirmar que invitaciones médicas comparten la tabla y propósitos.

### 13. \`whatsapp_conversations\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`patient_id\` | \`BIGINT UNSIGNED\` | FK a \`patients.id\` |
| \`provider_conversation_id\` | \`VARCHAR(120)\` | Opcional; identificador del proveedor |
| \`state\` | \`VARCHAR(50)\` | Paso actual del flujo |
| \`state_data\` | \`JSON\` | Opcional; datos temporales mínimos, sin secretos |
| \`last_activity_at\` | \`DATETIME(3)\` | Obligatorio |
| \`expires_at\` | \`DATETIME(3)\` | Obligatorio; 15 min de inactividad según regla |
| \`closed_at\` | \`DATETIME(3)\` | Opcional |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

Se guarda el estado de conversación, no una copia permanente del contenido de mensajes.

### 14. \`notification_outbox\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`account_token_id\` | \`BIGINT UNSIGNED\` | FK opcional y único a \`account_tokens.id\` |
| \`recipient\` | \`VARCHAR(254)\` | Obligatorio |
| \`notification_type\` | \`VARCHAR(50)\` | Obligatorio |
| \`channel\` | \`ENUM('EMAIL','WHATSAPP')\` | Obligatorio |
| \`status\` | \`ENUM('PENDING','SENT','FAILED')\` | Obligatorio |
| \`attempts\` | \`TINYINT UNSIGNED\` | Obligatorio; valor inicial 0 |
| \`last_error_code\` | \`VARCHAR(80)\` | Opcional; genérico, sin secretos |
| \`next_attempt_at\` | \`DATETIME(3)\` | Opcional |
| \`sent_at\` | \`DATETIME(3)\` | Opcional |
| \`created_at\`, \`updated_at\` | \`DATETIME(3)\` | Obligatorios |

No se almacena el enlace, token ni código original. Confirmar si el outbox cubrirá WhatsApp o solo correo.

### 15. \`audit_logs\`

| Columna | Tipo propuesto | Regla |
|---|---|---|
| \`id\` | \`BIGINT UNSIGNED\` | PK |
| \`actor_user_id\` | \`BIGINT UNSIGNED\` | FK opcional; nulo para tareas automáticas |
| \`action\` | \`VARCHAR(80)\` | Obligatorio, por ejemplo \`APPOINTMENT_RESCHEDULED\` |
| \`entity_type\` | \`VARCHAR(60)\` | Obligatorio |
| \`entity_id\` | \`BIGINT UNSIGNED\` | Identificador de entidad afectada |
| \`before_data\`, \`after_data\` | \`JSON\` | Opcionales; lista permitida de cambios |
| \`created_at\` | \`DATETIME(3)\` | Obligatorio |
| \`request_id\` | \`VARCHAR(64)\` | Opcional; correlación técnica |

Índice propuesto: (\`entity_type\`, \`entity_id\`, \`created_at\`) y (\`actor_user_id\`, \`created_at\`). No registrar contraseñas, tokens, códigos, observaciones clínicas ni datos sensibles que no sean necesarios para demostrar la acción.

## Relaciones principales

- \`users\` 1:0..1 \`patients\`; \`users\` 1:0..1 \`doctors\`.
- \`specialties\` 1:N \`doctors\`; \`specialties\` 1:N \`appointments\`.
- \`doctors\` 1:N \`doctor_weekly_schedules\` y \`doctor_schedule_exceptions\`.
- \`doctor_weekly_schedules\` 1:N \`doctor_weekly_schedule_blocks\`.
- \`doctor_schedule_exceptions\` 1:N \`doctor_schedule_exception_blocks\`.
- \`patients\` y \`doctors\` 1:N \`appointments\`.
- \`appointments\` 1:0..1 \`consultations\`; \`consultations\` 1:N \`consultation_addenda\`.
- \`users\` 1:N \`account_tokens\`; \`patients\` 1:N \`whatsapp_conversations\`.
- \`account_tokens\` 1:0..1 \`notification_outbox\`; \`users\` 1:N \`audit_logs\`.

## Decisiones para aprobación

1. Aprobar o cambiar los cuatro nombres propuestos para horarios/excepciones y \`audit_logs\`.
2. Confirmar si \`city\` y los campos de aceptación/versionado van en \`patients\`; aparecen en las vistas o formularios, pero las historias pueden no definirlos todos.
3. Confirmar si los datos de WhatsApp viven en \`patients\` y si se reutiliza \`notification_outbox\` para ese canal.
4. Confirmar si los cambios de cita se auditan en \`audit_logs\` como historial, sin crear una tabla adicional.
5. Confirmar convención de UTC/\`America/Bogota\`, motor y versión mínima de MySQL.
6. Confirmar si \`doctors.specialty_id\` puede cambiar y si se debe conservar la especialidad histórica en cada cita (esta propuesta la conserva).
7. Aprobar límites/longitudes y vocabularios de estados; los valores de \`ENUM\` son propuestos para el modelo técnico.

## Relación con las vistas recibidas

- \`auth/patient-registration.jpg\`: nombres, apellidos, tipo/número de documento, fecha de nacimiento, correo, teléfono y aceptación de términos/privacidad.
- \`patient/profile.jpg\`: identidad, documento, fecha de nacimiento, contacto y ciudad opcional.
- \`doctor/profile.jpg\`: registro profesional, descripción, fotografía y especialidad; identidad y teléfono provienen de \`users\`.
- Paneles de paciente, médico y administrador: muestran citas, conteos y accesos; no justifican almacenar datos clínicos adicionales.

Las imágenes no definen relaciones, estados, índices ni reglas de concurrencia. Esos elementos se proponen desde las historias y reglas de negocio y quedan sujetos a aprobación.

## Paso posterior

Después de aprobar esta propuesta, se puede actualizar \`DATABASE_DESIGN.md\` con el esquema acordado y planificar migraciones mediante issues separados. Este PR solo documenta una propuesta; no crea tablas ni altera historias.
