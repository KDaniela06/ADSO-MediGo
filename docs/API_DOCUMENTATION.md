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

## Recuperación de contraseña — issue #15

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /recuperar-contrasena` | Público | Muestra el formulario de correo. |
| `POST /recuperar-contrasena` | Público | Responde con el mismo mensaje aunque la cuenta no exista, no esté activa, haya un límite o falle el correo. Aplica espera de 60 segundos y máximo cinco solicitudes por hora. |
| `GET /restablecer-contrasena/:token` | Público, token requerido | Muestra el formulario de nueva contraseña sin consumir el token. |
| `POST /restablecer-contrasena/:token` | Público, token requerido | Comprueba contraseña y confirmación, y actualiza la clave solo con un token válido, no usado y vigente. |

El token aleatorio se guarda solo como hash SHA-256, vence en 30 minutos y se invalida tras el cambio. Un cambio exitoso también invalida otros enlaces de recuperación pendientes de la cuenta. Los formularios mantienen protección CSRF y no se almacenan en caché.

## Cambio de contraseña del paciente — issue #23

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /cambiar-contrasena` | Paciente autenticado | Muestra el formulario protegido para cambiar la contraseña. |
| `POST /cambiar-contrasena` | Paciente autenticado | Valida contraseña actual, contraseña nueva de al menos ocho caracteres y confirmación. Solo guarda el cambio si la contraseña actual es correcta. Los errores no muestran datos sensibles. |

El cambio guarda una nueva clave scrypt con sal aleatoria e invalida enlaces pendientes de recuperación de esa cuenta. La ruta exige sesión y rol de paciente; el formulario POST usa protección CSRF y no se almacena en caché.

## Perfil del paciente — issue #22

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /perfil` | Paciente autenticado | Muestra los datos de identificación, fecha de nacimiento y contacto del paciente de la sesión. |
| `POST /perfil` | Paciente autenticado | Valida y guarda nombres, teléfono y ciudad opcional. La identificación no se recibe como dato editable. |
| `GET /confirmar-cambio-correo/:token` | Público, token requerido | Muestra una confirmación explícita; abrir el enlace no consume el token. |
| `POST /confirmar-cambio-correo/:token` | Público, token requerido y CSRF | Cambia el correo solo con un token vigente y de un solo uso. |

Al solicitar un correo nuevo, se conserva el correo vigente y se guarda la dirección nueva como pendiente. El paciente recibe allí un enlace que vence en 24 horas. El token se guarda como hash; al confirmarlo se actualiza el correo y se invalidan otros enlaces pendientes. Las rutas privadas validan sesión y rol en el servidor.



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

