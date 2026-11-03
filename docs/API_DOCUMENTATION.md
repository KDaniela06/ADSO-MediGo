# API y rutas previstas

## Estado

No hay servidor Express, rutas, controladores ni contratos HTTP en el repositorio. Por ello este documento define dominios y reglas para diseñarlos después; no es una especificación de endpoints ya implementados.

## Dominios de rutas previstos

| Dominio | Operaciones funcionales previstas | Acceso general |
|---|---|---|
| Autenticación | Registro paciente, login/logout, verificación de correo, recuperación y cambio de contraseña | Público con límites; sesión autenticada para cambios |
| Perfil | Lectura/actualización permitida, cambio de correo con verificación | Propietario; médico/admin según permisos |
| Catálogo | Consultar especialidades y médicos activos | Paciente/visitante según la pantalla |
| Disponibilidad | Consultar horarios; administración configura bloques y excepciones | Consulta pública/autenticada; escritura admin |
| Citas | Crear/listar/detallar/cancelar/reprogramar | Paciente propietario; médico asignado consulta; admin autorizado |
| Consultas | Iniciar, guardar/finalizar atención, añadir aclaración | Médico asignado; autorización estricta |
| Administración | Gestión de usuarios, especialidades, agenda y ausencias | Admin autorizado |
| WhatsApp | Webhook/procesamiento de mensajes y vinculación | Proveedor verificado/paciente vinculado |

Los verbos, URLs, formatos de payload y códigos HTTP se decidirán junto con las vistas Pug y el proveedor de integración. No inventar endpoints hasta definir si cada flujo usa formularios web, API JSON o ambos.

## Requisitos transversales

- Autenticación y autorización por rol y propiedad del recurso en servidor.
- Validación de entrada, protección CSRF cuando se usen sesiones/formularios, escape de salida y errores en español.
- Transacción para mutaciones de cita y disponibilidad.
- Respuestas de recuperación de contraseña que no confirmen existencia del correo.
- Límite de solicitudes y tokens de un solo uso.
- Webhook de WhatsApp debe validar firma del proveedor oficial.
- No devolver información clínica en historial del paciente ni detalles no autorizados.

## Plantilla para documentar endpoint real

Cuando se implemente, registrar método y ruta, rol, objetivo, parámetros/cuerpo, respuesta, errores, validaciones, reglas de negocio y pruebas asociadas. Mantener ejemplos ficticios y sin datos personales reales.

