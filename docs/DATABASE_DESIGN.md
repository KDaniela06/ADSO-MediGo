# Diseño de datos

## Estado de la especificación

El contexto maestro declara un diseño físico inicial aprobado de 15 tablas, pero no proporciona el diagrama ni nombres/columnas físicos completos. Esta documentación registra las entidades confirmadas y las reglas conocidas; no es un DDL definitivo. En particular, no inventa los nombres de las cuatro tablas de disponibilidad/excepciones ni el nombre de la tabla de auditoría.

## Inventario declarado

1. `users`
2. `patients`
3. `doctors`
4. `specialties`
5. Tabla de bloques de disponibilidad semanal (nombre por recuperar)
6. Tabla de detalle/días de disponibilidad (nombre por recuperar)
7. Tabla de excepciones de horario (nombre por recuperar)
8. Tabla de detalle de excepciones (nombre por recuperar)
9. `appointments`
10. `consultations`
11. `consultation_addenda`
12. `account_tokens`
13. `whatsapp_conversations`
14. `notification_outbox`
15. Tabla de auditoría (nombre por recuperar)

## Entidades y datos confirmados

| Entidad | Datos/propósito conocidos |
|---|---|
| `users` | Identidad compartida, tipo/número de documento, nombres/apellidos, correo/teléfono, hash de contraseña, rol, estado, verificación de correo y fechas. Documento compuesto único y correo único. |
| `patients` | Información específica y relación con un usuario. El contexto no detalla columnas adicionales. |
| `doctors` | Perfil profesional relacionado con usuario y especialidad: registro profesional y descripción/fotografía opcionales, estado. |
| `specialties` | Catálogo de especialidades y estado. |
| Disponibilidad (4 tablas) | Bloques semanales, días/detalles y excepciones por periodo. Nombres y columnas exactos pendientes. |
| `appointments` | Cita y relaciones con paciente, médico y horario; estado y fechas de atención requeridos por reglas. Columnas exactas pendientes. |
| `consultations` | Atención ligada a cita; observación original y ciclo de atención. |
| `consultation_addenda` | Aclaraciones inmutables relacionadas a consulta, autor, contenido y fecha/hora. |
| `account_tokens` | Hash del token, propósito, expiración, uso y control de límites. Nunca token original. |
| `whatsapp_conversations` | Estado conversacional con vencimiento por inactividad. |
| `notification_outbox` | Destinatario, tipo, canal, estado, intentos, creación/envío y último error. |
| Auditoría | Acción sensible y responsable. Tabla y columnas exactas pendientes. |

## Relaciones confirmadas

- `users` 1:0..1 `patients` y `users` 1:0..1 `doctors`.
- `specialties` 1:N `doctors`.
- `patients` 1:N `appointments`; `doctors` 1:N `appointments`.
- `appointments` 1:0..1 `consultations`; `consultations` 1:N `consultation_addenda`.
- Usuario y tokens de cuenta; paciente y conversaciones WhatsApp.
- Usuarios relacionados con notificaciones y registros de auditoría.
- Citas relacionadas con disponibilidad e historial de cambios.

Las cardinalidades opcionales y nombres de FK deben confirmarse en el diseño físico original.

## Integridad y persistencia

- Claves foráneas y restricciones únicas para correo e identificación compuesta.
- Índices para búsquedas frecuentes, con diseño final basado en consultas reales.
- Validación centralizada de estados y valores permitidos.
- Transacciones para reservar/reprogramar/cancelar y operaciones administrativas multi-registro.
- Protección contra doble reserva concurrente en la base de datos, no solo en lógica de aplicación.
- No confiar únicamente en validaciones ORM para invariantes críticas.

## Decisiones pendientes antes de migrar

Recuperar el documento físico aprobado, confirmar cuatro nombres de tablas de horarios, tabla de auditoría, campos/FK/índices, estrategia para historial de cambios de citas y constraints que MySQL soportará. No generar migraciones finales hasta resolverlos.

