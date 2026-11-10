# API y rutas

## Estado

La aplicación usa rutas Express con formularios Pug. Las rutas se documentan como se implementan; las rutas futuras siguen siendo alcance previsto, no funcionalidad disponible.

## Registro de paciente — issue #12

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /registro` | Público | Renderiza el formulario de registro de paciente. |
| `POST /registro` | Público | Valida en servidor y crea `users` + `patients` en una transacción. La cuenta queda `PENDING_VERIFICATION`. Devuelve `422` para campos inválidos, `409` para correo o documento duplicado, `201` al crear y `503` si la persistencia no está disponible. |

La contraseña se guarda como hash scrypt con sal aleatoria. Las tablas base se crean con `npm run db:migrate`. El registro no inicia sesión.

## Verificación de correo — issue #13

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /verificar-correo/:token` | Público, token requerido | Verifica y activa la cuenta si el token es válido, no usado y no vencido. Presenta estados para éxito, vencimiento, uso previo o token inválido. |
| `POST /verificar-correo/reenviar` | Público | Solicita un nuevo enlace sin revelar si el correo pertenece a una cuenta pendiente. Aplica espera de 60 segundos y máximo cinco solicitudes por hora. |

Los tokens son aleatorios, vencen en 24 horas y solo su hash SHA-256 se persiste. SMTP se configura con las variables `SMTP_*`. El registro de notificación se crea en `notification_outbox` antes de enviar; el transporte hace hasta tres intentos y los reenvíos fallidos también consumen el límite.

## Inicio y cierre de sesión — issue #14

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /iniciar-sesion` | Público | Muestra el formulario de correo y contraseña. |
| `POST /iniciar-sesion` | Público | Acepta pacientes activos con correo verificado; los errores usan un mensaje genérico y el éxito redirige a `/paciente`. |
| `GET /paciente` | Paciente autenticado | Comprueba la sesión y el estado actual de la cuenta antes de mostrar el espacio inicial del paciente. |
| `POST /cerrar-sesion` | Sesión autenticada | Invalida la sesión del servidor y elimina la cookie. |

Los formularios POST están protegidos con token CSRF. La cookie de sesión es HttpOnly y SameSite=Lax; en producción exige HTTPS, un secreto propio y una tienda persistente configurada. El almacenamiento en memoria se limita al desarrollo local.

## Dominios previstos

| Dominio | Operaciones previstas | Acceso general |
|---|---|---|
| Autenticación | Inicio/cierre de sesión, verificación de correo, recuperación y cambio de contraseña | Público con límites; sesión para cambios |
| Perfil | Lectura y actualización permitida, cambio de correo con verificación | Propietario según rol |
| Catálogo | Consultar especialidades y médicos activos | Visitante/paciente |
| Disponibilidad | Consultar horarios; administración configura bloques y excepciones | Consulta pública; escritura admin |
| Citas | Crear/listar/detallar/cancelar/reprogramar | Paciente propietario, médico asignado o admin autorizado |
| Consultas | Iniciar/finalizar atención y añadir aclaración | Médico asignado |
| Administración | Gestionar usuarios, especialidades, agenda y ausencias | Admin autorizado |
| WhatsApp | Webhook y vinculación | Proveedor verificado/paciente vinculado |

## Requisitos transversales

- Autenticación y autorización por rol y propiedad del recurso en servidor.
- Validación de entrada, protección CSRF cuando se usen sesiones/formularios, escape de salida y errores en español.
- Transacciones para mutaciones de cita y disponibilidad.
- Respuestas de recuperación de contraseña que no confirmen si el correo existe.
- Límites de solicitud y tokens de un solo uso.
- El webhook de WhatsApp debe validar la firma del proveedor oficial.
- No devolver información clínica en el historial del paciente ni detalles no autorizados.

