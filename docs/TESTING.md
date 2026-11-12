# Pruebas

## Estado

La aplicación incluye Jest y pruebas HTTP de humo para la página inicial y los flujos de autenticación disponibles. `npm test` ejecuta la suite.

## Enfoque previsto

- Jest para pruebas unitarias de servicios/reglas y pruebas de integración pequeñas.
- CI básico con GitHub Actions en PRs dirigidos a `develop`; instala dependencias y ejecuta `npm test`.
- Separar `tests/unit` y `tests/integration` cuando se cree la estructura aprobada.
- Nombres descriptivos en inglés; datos ficticios, sin información de pacientes reales.
- No probar funciones que todavía no existen ni declarar resultados sin ejecutar los comandos.

## Casos iniciales sugeridos

| Área | Casos |
|---|---|
| Registro | Registro válido; menor de 18 rechazado; documento duplicado rechazado. |
| Recuperación de contraseña | Mensaje genérico para correos desconocidos; hash y vencimiento de 30 minutos; token de un solo uso; límites de reenvío; contraseña y confirmación; enlaces usados o vencidos; protección CSRF. |
| Cambio de contraseña | Confirmación de contraseña actual; mínimo de ocho caracteres; confirmación coincidente; autorización por rol; invalidación de enlaces pendientes; no exposición de contraseñas en mensajes. |
| Panel principal del paciente | Cita futura más cercana del paciente autenticado; estado vacío si todavía no hay modelo o citas; error de consulta; datos de paciente y médico. |
| Panel principal del médico | Citas del día y resumen por estado, próxima cita, aislamiento por médico y rango diario de America/Bogota; estados vacío y error. |
| Pacientes asociados al médico | Pacientes únicos con citas del médico autenticado; búsqueda por campos básicos; detalle de paciente asociado; acceso por rol; no exposición de historia clínica ni observaciones. |
| Agenda y perfil del médico | Agenda semanal de solo lectura; perfil propio; teléfono validado; descripción con límite; fotografía solo por URL HTTPS; especialidad y registro de solo lectura; autorización por rol y estados de agenda vacía/no configurada. |
| Citas asignadas del médico | Filtros válidos de fecha y estado; aislamiento por médico; detalle autorizado; acción de inicio solo dentro del bloque confirmado; sin cancelar ni reprogramar. |
| Panel principal del administrador | Conteo de pacientes y médicos activos; citas de hoy y atendidas; resumen semanal agregado; accesos de administración; autorización ADMIN; estados vacío, error y no disponible; sin acceso a notas clínicas. |
| Gestión de pacientes y médicos por administrador | Listado y cambios de estado con autorización ADMIN; confirmación del impacto; transacción y auditoría; cancelar solo citas futuras confirmadas al desactivar; conservar citas pasadas, en curso y atendidas; notificar a las personas involucradas; las cuentas inactivas no pueden iniciar sesión. |
| Registro de médicos | Validación de datos, especialidad activa, unicidad de correo/documento/registro, creación transaccional, contraseña nula antes de configurar, invitación de 24 horas de un solo uso, activación y rechazo de enlaces vencidos o usados. |
| Gestión de médicos por administrador | Búsqueda, filtro por estado/especialidad y paginación; detalle del estado de cuenta e invitación; edición validada de los campos permitidos; confirmación de cambio de especialidad; auditoría; autorización ADMIN. |
| Cuenta de administrador | Edición de campos propios; identificación y rol de solo lectura; correo pendiente hasta verificar; contraseña actual y nueva; autorización ADMIN; confirmación de correo de un solo uso; sin creación de administradores desde la cuenta. |
| Cambio de contraseña de médico | Verificación de contraseña actual; nueva clave mínima; confirmación; autorización exclusiva para médicos; conservación del rol; errores sin datos sensibles; protección CSRF. |
| Perfil de paciente | Acceso autenticado; identificación no editable; campos de contacto validados; correo vigente conservado hasta verificar el nuevo; tokens de cambio usados o vencidos rechazados. |
| Verificación de correo | Token enviado y almacenado como hash; activación válida; enlace vencido o usado; límites de reenvío. |
| Citas | Reserva libre; horario ocupado rechazado; anticipación menor de 30 minutos rechazada; segunda cita futura confirmada rechazada; cancelación según ventana. |
| Inicio de sesión por rol | Paciente, médico y administrador activos con correo verificado; redirección a página permitida (panel de administrador para ADMIN); cuenta inactiva o no verificada rechazada. |
| Seguridad | Credenciales inválidas con respuesta genérica; cuenta no verificada rechazada; sesión protegida; CSRF obligatorio; cierre de sesión y rutas por rol. |
| Consulta | Inicio dentro de horario permitido; rechazo fuera de ventana; observación original preservada tras finalizar. |
| WhatsApp | Código incorrecto/vencido; número no vinculado rechazado. |

## Criterios de calidad

Probar resultados esperados y límites temporales; fijar reloj en casos dependientes de hora; asegurar transacciones y concurrencia en integración; mantener mensajes visibles en español y nombres técnicos en inglés. El repositorio incluye Jest y `package-lock.json`. CI usa `npm ci` para instalar las mismas versiones en cada ejecución y luego ejecuta `npm test`. Para repetir estos pasos localmente, ejecuta `npm ci` y después `npm test`.


