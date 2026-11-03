# Requisitos

Este documento registra requisitos aprobados en el contexto maestro. “Previsto” indica alcance, no implementación comprobada.

## Requisitos funcionales

### Acceso y cuentas

- El paciente puede registrarse si cumple edad mínima, documento único, correo válido y contraseña válida.
- El paciente verifica el correo antes de reservar y puede iniciar/cerrar sesión, recuperar contraseña y administrar datos permitidos de su perfil.
- El correo nuevo se activa solo tras verificarlo; el anterior sigue vigente mientras tanto.
- Médico y administrador acceden a funciones autorizadas por su rol. No hay registro público de administradores.
- El médico recibe una invitación segura para crear su contraseña.

### Paciente y citas

- Consultar especialidades, médicos y horarios disponibles.
- Reservar, consultar, ver detalle, cancelar y reprogramar citas; consultar historial sin información clínica.
- Reprogramar con el mismo médico y actualizar la cita conservando registro del cambio.
- Vincular, verificar o desvincular WhatsApp con consentimiento.

### Médico

- Consultar dashboard, agenda, citas y pacientes asignados.
- Iniciar una atención dentro de la ventana permitida, guardar observaciones opcionales y finalizarla.
- Añadir aclaraciones inmutables a una atención finalizada; no reemplazar la observación original.
- Consultar perfil y cambiar contraseña. No administra su disponibilidad ni cancela o reprograma.

### Administración

- Consultar dashboard, pacientes y médicos; crear y gestionar médicos.
- Crear, editar, activar y desactivar especialidades.
- Configurar disponibilidad, bloques y excepciones.
- Consultar, crear administrativamente, cancelar o reprogramar citas y registrar ausencias una vez terminado el horario.
- Previsualizar citas afectadas por desactivaciones o cambios de horario antes de confirmar; conservar el historial y notificar cuando corresponda.
- Registrar las operaciones administrativas sensibles en auditoría.

### Comunicación

- Gestionar mensajes de correo con outbox, estados, intentos y control de duplicación.
- El chatbot ofrece reservar, consultar, cancelar y reprogramar; debe aplicar las mismas reglas que la web.
- WhatsApp requiere proveedor oficial y credenciales configuradas. No se envían mensajes proactivos por WhatsApp.

## Requisitos no funcionales

- Interfaz minimalista, profesional, adaptable a escritorio y móvil y en español.
- Arquitectura modular, legible y mantenible para un equipo en formación.
- Integridad referencial y operaciones críticas transaccionales.
- Autenticación y autorización del lado servidor; manejo seguro de secretos y tokens.
- No exponer datos clínicos a roles que no los necesiten ni datos de un paciente a otro.
- Mensajes comprensibles y sin detalles internos; formularios conservan datos no sensibles ante errores cuando sea apropiado.
- Pruebas Jest pequeñas y enfocadas en reglas relevantes, sin datos reales.

## Criterios de aceptación generales

1. Toda regla crítica se valida en el servidor y, donde corresponda, en la base de datos o transacción.
2. Un usuario solo ejecuta acciones permitidas para su rol y sus relaciones.
3. Los errores se presentan en español y no exponen stack traces ni secretos.
4. Las modificaciones de citas, horarios o estados preservan historial y consistencia.
5. La documentación distingue requisitos definidos de comportamiento implementado y probado.

## Pendientes de especificación

- Criterios originales y mockups vinculados a las 35 historias.
- Diseño físico aprobado con nombres y columnas exactos para tablas de disponibilidad, excepciones y auditoría.
- Proveedor de correo y proveedor oficial de WhatsApp, credenciales y configuración de despliegue.
- Política concreta de sesiones, formato de documentos permitidos y catálogo final de estados de usuario.

