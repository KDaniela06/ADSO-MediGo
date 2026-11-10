# Propuesta de esquema físico para registro de pacientes

## Alcance

Esta propuesta define las columnas necesarias para el registro de pacientes de US-PAT-01 y la verificación posterior de US-PAT-02. No cambia las historias de usuario. Separa la identidad de acceso (`users`), el perfil de paciente (`patients`) y los enlaces de un solo uso (`account_tokens`). No almacena información clínica.

Los nombres y tipos son una propuesta concreta para revisión dentro del PR del issue #12. El resto de las tablas del inventario de 15 entidades permanece pendiente de completar con sus historias correspondientes.

## `users`

| Columna | Tipo MySQL | Reglas |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `document_type` | `ENUM('CC','CE','PASSPORT')` | Obligatorio |
| `document_number` | `VARCHAR(30)` | Obligatorio; normalizado en servidor |
| `first_name` | `VARCHAR(100)` | Obligatorio |
| `last_name` | `VARCHAR(100)` | Obligatorio |
| `email` | `VARCHAR(254)` | Obligatorio; guardar en minúsculas y único |
| `pending_email` | `VARCHAR(254)` | Opcional y único; se activa al confirmar el enlace de cambio |
| `phone` | `VARCHAR(30)` | Obligatorio |
| `password_hash` | `VARCHAR(255)` | Obligatorio; nunca almacenar contraseña plana |
| `role` | `ENUM('PATIENT','DOCTOR','ADMIN')` | Obligatorio |
| `status` | `ENUM('PENDING_VERIFICATION','ACTIVE','INACTIVE')` | Obligatorio; registro público inicia pendiente |
| `email_verified_at` | `DATETIME(3)` | Nulo hasta completar verificación |
| `created_at` | `DATETIME(3)` | Obligatorio |
| `updated_at` | `DATETIME(3)` | Obligatorio |

Restricciones: `UNIQUE(document_type, document_number)` y `UNIQUE(email)`. La aplicación recorta espacios del documento, normaliza sus letras a mayúsculas y normaliza el correo a minúsculas antes de insertar. La unicidad también se protege en MySQL para evitar carreras concurrentes.

## `patients`

| Columna | Tipo MySQL | Reglas |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `user_id` | `BIGINT UNSIGNED` | Obligatorio, FK a `users.id`, único |
| `date_of_birth` | `DATE` | Obligatorio; mínimo 18 años validado en servidor |
| `city` | `VARCHAR(100)` | Opcional; editable desde el perfil |
| `terms_accepted_at` | `DATETIME(3)` | Obligatorio |
| `terms_version` | `VARCHAR(32)` | Obligatorio |
| `privacy_accepted_at` | `DATETIME(3)` | Obligatorio |
| `privacy_version` | `VARCHAR(32)` | Obligatorio |
| `created_at` | `DATETIME(3)` | Obligatorio |
| `updated_at` | `DATETIME(3)` | Obligatorio |

La aceptación de las condiciones y de la política se registra con fecha y versión para tener evidencia del consentimiento. `user_id` único implementa la relación uno a cero o uno entre usuario y perfil de paciente.

## `account_tokens`

| Columna | Tipo MySQL | Reglas |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `user_id` | `BIGINT UNSIGNED` | Obligatorio, FK a `users.id` |
| `purpose` | `ENUM('EMAIL_VERIFICATION','PASSWORD_RESET','EMAIL_CHANGE')` | Obligatorio |
| `token_hash` | `CHAR(64)` | Obligatorio, único; SHA-256 del token aleatorio |
| `expires_at` | `DATETIME(3)` | Obligatorio |
| `used_at` | `DATETIME(3)` | Nulo mientras no se use |
| `created_at` | `DATETIME(3)` | Obligatorio |

El token original se genera con un generador criptográfico, se entrega solo al usuario por el transporte SMTP configurado y no se guarda en la base de datos. La validez de 24 horas se controla con `expires_at`. El propósito `EMAIL_CHANGE` permite confirmar una nueva dirección sin reemplazar el correo actual antes de tiempo.

El índice compuesto `(user_id, purpose, created_at)` permite contar solicitudes de reenvío por propósito durante la última hora. El registro de token se escribe antes de enviar el correo; así un fallo de entrega tampoco reinicia el límite.

## Registro transaccional

La creación debe insertar `users` y `patients` dentro de una misma transacción. Se asigna rol `PATIENT`, estado `PENDING_VERIFICATION` y `email_verified_at = NULL`; por tanto no puede iniciar sesión ni reservar hasta verificar el correo. Un error en cualquiera de las inserciones revierte ambas. Las restricciones únicas son la defensa final ante dos registros simultáneos con el mismo correo o documento.

## `notification_outbox` para verificación

La migración del issue #13 crea una fila de notificación en la misma transacción que el token. `account_token_id` es único y referencia el token asociado; el registro conserva destinatario, tipo, canal, estado, intentos, fecha de envío y un código de error genérico. No almacena el enlace ni el token original. El transporte SMTP intenta entregar hasta tres veces y actualiza el estado del outbox.

## Decisiones para revisión

- Nombres de tablas y columnas en inglés, consistentes con el inventario existente.
- `BIGINT UNSIGNED` para IDs y claves foráneas.
- Se incluyen versiones de términos y privacidad para registrar el consentimiento que el formulario solicita.
- La historia no define formatos nacionales de documento o teléfono; la propuesta solo limita longitud y exige valor. No se agrega validación de formato más estricta sin una regla aprobada.
- No se incluyen aquí las columnas físicas de médicos, especialidades, citas, disponibilidad, consultas, WhatsApp, outbox ni auditoría.

