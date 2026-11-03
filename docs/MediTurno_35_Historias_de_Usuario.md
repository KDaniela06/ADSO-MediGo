# MediTurno — Historias de usuario (35)

**Proyecto:** MediTurno — Sistema minimalista de gestión de citas médicas  
**Autor:** Juan Esteban Montoya Marín  
**Etapa:** Sprint 0 — Planificación y diseño  
**Estado:** Documento consolidado para revisión y uso con Codex; **sin programación iniciada**  
**Idioma de interfaz:** español. **Código y documentación técnica del proyecto:** inglés.

> **Nota de fidelidad:** Este archivo consolida las 35 historias y las reglas confirmadas en la planificación de MediTurno. Los criterios están redactados y normalizados para entregar un documento completo a Codex; no se presentan como transcripción literal de una versión anterior. Antes de implementar, revisar y aprobar el texto consolidado.

## Alcance y reglas generales

- **Roles:** Paciente, Médico y Administrador; además, bot de WhatsApp para pacientes verificados.
- **Tecnologías previstas:** Node.js, Express, Pug, Tailwind CSS, MySQL, Sequelize, Jest y Supertest.
- **Diseño:** minimalista, responsive, accesible; colores `#163D70`, `#2387D1`, `#16A6A1`, `#F3F7FA`, `#243447`.
- **Citas:** 30 minutos; anticipación mínima de 30 minutos; reserva hasta 30 días; máximo una cita futura Confirmada por paciente; cancelación/reprogramación manual al menos 24 horas antes; reprogramación con el mismo médico.
- **Estados:** Confirmada, En curso, Atendida, Cancelada, No asistió.
- **Disponibilidad:** validación atómica para evitar doble reserva; horarios semanales sin turnos nocturnos y excepciones; zona horaria de presentación `America/Bogota`, instantes almacenados en UTC.
- **Seguridad:** autenticación, autorización por rol, contraseñas con hash, validación, protección CSRF, tokens de un solo uso almacenados mediante hash, auditoría sin datos sensibles.
- **Notificaciones:** correo mediante outbox con hasta tres intentos. WhatsApp solo para conversaciones iniciadas por el paciente, no para mensajes proactivos.
- **Límites de alcance:** no incluir diagnósticos, prescripciones ni historia clínica completa; el administrador no accede a observaciones de consulta.

## Índice

- [Paciente — 14 historias](#paciente--14-historias)
- [Médico — 8 historias](#médico--8-historias)
- [Administrador — 13 historias](#administrador--13-historias)
- [Criterios de cierre y organización GitHub](#criterios-de-cierre-y-organización-github)

## Paciente — 14 historias

### US-PAT-01 — Registro de paciente

**Historia de usuario:** Como visitante, quiero registrarme como paciente para acceder a MediTurno.

**Criterios de aceptación:**

1. El formulario público solicita nombres, apellidos, tipo y número de documento (CC, CE o pasaporte), fecha de nacimiento, teléfono, correo y contraseña con confirmación.
2. La fecha de nacimiento debe corresponder a una persona de 18 años o más.
3. El par tipo/número de documento y el correo deben ser únicos; se validan formatos y campos obligatorios.
4. La contraseña tiene al menos ocho caracteres y coincide con su confirmación; se exige aceptación de privacidad.
5. La cuenta se crea sin acceso habilitado hasta verificar el correo; no se solicitan datos clínicos.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-02 — Verificar correo electrónico

**Historia de usuario:** Como paciente recién registrado, quiero verificar mi correo para activar el acceso.

**Criterios de aceptación:**

1. Se envía un enlace de verificación de un solo uso con vigencia de 24 horas.
2. El enlace válido verifica la cuenta y presenta confirmación; el inválido, vencido o utilizado presenta un estado comprensible.
3. El reenvío respeta 60 segundos entre solicitudes y máximo cinco por hora y propósito.
4. Los tokens se almacenan mediante hash, nunca en texto plano.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-03 — Iniciar y cerrar sesión

**Historia de usuario:** Como paciente, quiero acceder a mi cuenta y cerrarla de manera segura.

**Criterios de aceptación:**

1. El inicio de sesión utiliza correo y contraseña.
2. Solo pueden acceder cuentas activas y con correo verificado.
3. Los errores no revelan si existe un correo registrado.
4. El acceso dirige al dashboard del paciente y protege rutas por rol.
5. Cerrar sesión invalida el acceso y evita volver a áreas privadas sin autenticación.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-04 — Recuperar contraseña

**Historia de usuario:** Como paciente, quiero recuperar el acceso cuando olvide mi contraseña.

**Criterios de aceptación:**

1. El formulario solicita correo y responde de forma genérica sin confirmar si existe.
2. El enlace de recuperación es de un solo uso y expira en 30 minutos.
3. La nueva contraseña cumple las reglas y debe confirmarse.
4. El token utilizado, inválido o vencido no permite modificar la contraseña.
5. El reenvío respeta el límite de cinco solicitudes por hora y espera de 60 segundos.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-05 — Panel principal del paciente

**Historia de usuario:** Como paciente autenticado, quiero ver mi próxima cita y acceder rápidamente a las funciones principales.

**Criterios de aceptación:**

1. Se muestra la próxima cita cuando existe, con médico, especialidad, fecha, hora y estado.
2. Se ofrecen accesos a reservar, mis citas, historial, perfil y WhatsApp.
3. La información pertenece únicamente al paciente autenticado.
4. Se contemplan estados de carga, vacío y error; diseño responsive.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-06 — Reservar cita médica

**Historia de usuario:** Como paciente, quiero reservar una cita disponible en cuatro pasos.

**Criterios de aceptación:**

1. El flujo consta de especialidad, médico, fecha/hora y revisión/confirmación.
2. Solo se muestran especialidades y médicos activos con disponibilidad real.
3. Las citas duran 30 minutos; se reservan con al menos 30 minutos de anticipación y máximo 30 días hacia adelante.
4. El paciente no puede tener más de una cita futura Confirmada.
5. Al confirmar, la disponibilidad se revalida de forma atómica para impedir doble reserva.
6. Se muestra resultado y se registra notificación por correo.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-07 — Consultar mis citas

**Historia de usuario:** Como paciente, quiero consultar el estado y los detalles de mis citas.

**Criterios de aceptación:**

1. Se listan únicamente las citas del paciente autenticado.
2. Se permite filtrar por próximas, anteriores y todas.
3. Cada cita muestra médico, especialidad, fecha, hora y estado en español.
4. Las acciones disponibles dependen del estado y de las reglas de tiempo.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-08 — Cancelar una cita

**Historia de usuario:** Como paciente, quiero cancelar una cita que ya no puedo atender.

**Criterios de aceptación:**

1. Solo se pueden cancelar manualmente citas Confirmadas con al menos 24 horas antes de su inicio.
2. Antes de confirmar se muestra un diálogo con los detalles y las consecuencias.
3. La cancelación cambia el estado a Cancelada, libera el cupo y registra historial y actor.
4. No se permite cancelar citas En curso, Atendidas, Canceladas o fuera del plazo.
5. Se registra la notificación correspondiente.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-09 — Reprogramar una cita

**Historia de usuario:** Como paciente, quiero cambiar fecha y hora de una cita manteniendo el médico.

**Criterios de aceptación:**

1. Solo se puede reprogramar una cita Confirmada con al menos 24 horas de anticipación.
2. El médico y la especialidad permanecen fijos.
3. El nuevo horario cumple duración de 30 minutos, mínimo 30 minutos de anticipación y máximo 30 días.
4. La operación valida disponibilidad atómicamente; si falla, se conserva la cita original.
5. Se registra el cambio en historial y se notifica por correo.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-10 — Historial de citas

**Historia de usuario:** Como paciente, quiero consultar mis citas anteriores.

**Criterios de aceptación:**

1. El historial muestra citas pasadas y sus estados, con fecha, médico y especialidad.
2. No muestra diagnósticos, recetas ni historias clínicas.
3. No se puede acceder al historial de otros pacientes.
4. La lista se adapta a escritorio y móvil, con estado vacío.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-11 — Administrar mi perfil

**Historia de usuario:** Como paciente, quiero consultar y actualizar mis datos de contacto.

**Criterios de aceptación:**

1. El paciente ve sus datos de identificación y contacto.
2. La identificación no puede cambiarse libremente desde el perfil.
3. Se validan los campos editables y se limita el acceso a la cuenta propia.
4. El cambio de correo exige verificar el nuevo antes de reemplazar el anterior.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-12 — Cambiar mi contraseña

**Historia de usuario:** Como paciente, quiero actualizar mi contraseña desde mi cuenta.

**Criterios de aceptación:**

1. Se exige contraseña actual, nueva y confirmación.
2. Se verifica la contraseña actual y la nueva cumple mínimo ocho caracteres.
3. La confirmación debe coincidir y no se muestran contraseñas en mensajes o registros.
4. Se informa éxito o error sin revelar información sensible.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-13 — Vincular WhatsApp

**Historia de usuario:** Como paciente, quiero verificar y vincular mi número de WhatsApp.

**Criterios de aceptación:**

1. Se solicita número, consentimiento y verificación del remitente.
2. Se envía código de seis dígitos que vence en cinco minutos y admite máximo cinco intentos.
3. Un número no puede estar vinculado a más de un paciente.
4. Se muestran estados de número vinculado, código vencido, intentos agotados y error.
5. El paciente puede desvincular su número con confirmación.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-PAT-14 — Gestionar citas por WhatsApp

**Historia de usuario:** Como paciente con número vinculado, quiero pedir, consultar, cancelar y reprogramar citas mediante un chatbot.

**Criterios de aceptación:**

1. El bot atiende conversaciones iniciadas desde números vinculados y autorizados.
2. Permite reservar, consultar, cancelar y reprogramar citas con el mismo conjunto de reglas de la web.
3. Verifica la identidad mediante documento dentro del flujo definido.
4. La conversación caduca tras 15 minutos de inactividad.
5. Confirma las operaciones en el chat y maneja errores o cupos agotados.
6. No envía mensajes proactivos de WhatsApp.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

## Médico — 8 historias

### US-DOC-01 — Panel principal del médico

**Historia de usuario:** Como médico, quiero ver un resumen de mi jornada.

**Criterios de aceptación:**

1. Muestra citas del día, En curso, Atendidas y próxima cita.
2. Solo presenta información asignada al médico autenticado.
3. Incluye accesos a citas, pacientes, agenda y perfil.
4. Muestra estados vacíos y es responsive.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-02 — Consultar mis citas asignadas

**Historia de usuario:** Como médico, quiero consultar las citas que tengo programadas.

**Criterios de aceptación:**

1. Lista solo citas del médico autenticado.
2. Permite filtros por fecha y estado y consulta de detalles necesarios para atender.
3. Las acciones para iniciar atención dependen del horario y estado.
4. No permite cancelar ni reprogramar citas.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-03 — Consultar mis pacientes

**Historia de usuario:** Como médico, quiero ver pacientes asociados a mis citas.

**Criterios de aceptación:**

1. Solo se muestran pacientes con citas asignadas al médico.
2. Permite búsqueda y consulta de información mínima necesaria.
3. No expone datos de pacientes ajenos.
4. No muestra historia clínica completa fuera del alcance minimalista.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-04 — Iniciar consulta médica

**Historia de usuario:** Como médico, quiero iniciar una atención programada.

**Criterios de aceptación:**

1. Solo puede iniciarse una cita Confirmada asignada al médico.
2. El inicio se permite desde la hora programada y antes de finalizar el bloque.
3. El estado pasa a En curso y se registra hora de inicio.
4. Se impide el inicio repetido o fuera del intervalo.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-05 — Registrar observaciones y aclaraciones

**Historia de usuario:** Como médico, quiero registrar observaciones y añadir aclaraciones posteriores sin alterar el original.

**Criterios de aceptación:**

1. Las observaciones de la consulta son opcionales y editables mientras está En curso.
2. Una vez Atendida, las observaciones originales quedan inmutables.
3. Las correcciones posteriores se guardan como aclaraciones adicionales independientes.
4. Cada aclaración registra autor y fecha y no permite sobrescribir las anteriores.
5. Solo el médico autorizado puede escribir en sus consultas.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-06 — Finalizar consulta

**Historia de usuario:** Como médico, quiero marcar una atención como finalizada.

**Criterios de aceptación:**

1. Solo se finaliza una consulta En curso asignada al médico.
2. La cita pasa a Atendida y se registra la hora de finalización.
3. No se exige escribir observaciones para finalizar.
4. No se puede finalizar dos veces ni modificar el texto original posteriormente.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-07 — Consultar agenda y administrar perfil

**Historia de usuario:** Como médico, quiero ver mi disponibilidad y actualizar datos permitidos.

**Criterios de aceptación:**

1. La agenda presenta días y horarios asignados en modo solo lectura.
2. El médico no puede crear ni modificar horarios o excepciones.
3. Puede consultar especialidad y licencia como datos de solo lectura.
4. Puede editar teléfono, descripción y fotografía si están habilitados y validados.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-DOC-08 — Cambiar contraseña de médico

**Historia de usuario:** Como médico, quiero actualizar mi contraseña de acceso.

**Criterios de aceptación:**

1. Solicita contraseña actual, nueva y confirmación.
2. Valida la contraseña actual y mínimo ocho caracteres para la nueva.
3. No modifica el rol ni los permisos del médico.
4. Presenta mensajes seguros de éxito y error.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

## Administrador — 13 historias

### US-ADM-01 — Panel principal del administrador

**Historia de usuario:** Como administrador, quiero ver indicadores y accesos a la gestión del sistema.

**Criterios de aceptación:**

1. Muestra conteos de pacientes, médicos activos, citas del día y atendidas.
2. Incluye accesos a usuarios, médicos, especialidades, horarios, excepciones y citas.
3. Los indicadores usan datos autorizados y contemplan carga, vacío y error.
4. No expone notas privadas de consulta.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-02 — Gestionar pacientes

**Historia de usuario:** Como administrador, quiero buscar pacientes y administrar datos permitidos.

**Criterios de aceptación:**

1. Permite listar, buscar y filtrar pacientes.
2. Permite consultar datos administrativos y editar únicamente campos autorizados.
3. No permite acceder a observaciones médicas.
4. Las acciones de cambio de estado requieren confirmación y se auditan.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-03 — Registrar médico

**Historia de usuario:** Como administrador, quiero crear una cuenta de médico mediante invitación segura.

**Criterios de aceptación:**

1. Solicita nombres, apellidos, documento, correo, teléfono, especialidad y registro profesional.
2. La especialidad debe estar activa y el registro profesional ser único.
3. No se establece contraseña manualmente: se envía invitación de un solo uso por 24 horas.
4. La cuenta tiene password_hash nulo hasta completar la configuración inicial.
5. Se registra la fecha de configuración y se manejan enlaces vencidos o utilizados.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-04 — Gestionar médicos

**Historia de usuario:** Como administrador, quiero consultar y actualizar profesionales registrados.

**Criterios de aceptación:**

1. Permite listar, buscar, filtrar y ver detalles de médicos.
2. Permite editar datos administrativos y especialidad de acuerdo con las validaciones.
3. Muestra estados de cuenta y de invitación.
4. Las acciones sensibles se auditan y requieren confirmación cuando corresponda.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-05 — Gestionar especialidades

**Historia de usuario:** Como administrador, quiero crear y mantener especialidades médicas.

**Criterios de aceptación:**

1. Permite crear, buscar, editar, activar y desactivar especialidades.
2. El nombre es único y la descripción es opcional.
3. Una especialidad inactiva no aparece para nuevas reservas.
4. La desactivación conserva el historial y no cancela automáticamente citas existentes.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-06 — Configurar horarios médicos

**Historia de usuario:** Como administrador, quiero administrar la disponibilidad semanal de médicos.

**Criterios de aceptación:**

1. Permite asignar bloques por día de la semana.
2. Los bloques no se superponen, se alinean a 30 minutos y no cruzan medianoche.
3. Antes de guardar cambios se muestran las citas futuras Confirmadas que resultarían inválidas.
4. Tras confirmación, la actualización y cancelaciones necesarias son transaccionales.
5. Se registran historial, auditoría y notificaciones.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-07 — Gestionar excepciones de agenda

**Historia de usuario:** Como administrador, quiero bloquear intervalos específicos de disponibilidad.

**Criterios de aceptación:**

1. Permite crear excepciones por horas o varios días con motivo.
2. Valida que inicio sea anterior al fin.
3. Muestra vista previa de citas futuras Confirmadas afectadas.
4. Después de confirmar, cancela solo las citas afectadas que correspondan.
5. Registra la operación y sus notificaciones.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-08 — Consultar y buscar citas

**Historia de usuario:** Como administrador, quiero consultar citas del sistema con filtros.

**Criterios de aceptación:**

1. Permite buscar por paciente o médico y filtrar por fecha, estado y especialidad.
2. Muestra detalles administrativos, paginación y estados en español.
3. No muestra observaciones de consultas.
4. Respeta control de acceso de administrador.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-09 — Crear cita administrativa

**Historia de usuario:** Como administrador, quiero reservar una cita en nombre de un paciente.

**Criterios de aceptación:**

1. Permite seleccionar paciente, especialidad, médico, fecha y horario.
2. Aplica las mismas reglas que al paciente: 30 minutos, 30 minutos de anticipación, 30 días de ventana y máximo una futura Confirmada.
3. La disponibilidad se revalida atómicamente para evitar dobles reservas.
4. Se registra quién creó la cita y se notifica.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-10 — Cancelar o reprogramar citas

**Historia de usuario:** Como administrador, quiero modificar citas manualmente según las reglas establecidas.

**Criterios de aceptación:**

1. La cancelación o reprogramación manual requiere cita Confirmada y al menos 24 horas de anticipación.
2. La reprogramación mantiene el mismo médico.
3. Se confirma la operación antes de aplicarla y se registra motivo y actor.
4. Si la nueva disponibilidad falla, se conserva la cita original.
5. Las cancelaciones automáticas por desactivación o cambio de horario se gestionan mediante sus reglas específicas.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-11 — Registrar inasistencia

**Historia de usuario:** Como administrador, quiero marcar una cita como No asistió cuando el paciente no se presente.

**Criterios de aceptación:**

1. Solo se puede marcar No asistió si la cita continúa Confirmada.
2. La hora de finalización programada debe haber transcurrido.
3. Se solicita confirmación antes de cambiar el estado.
4. Se registra el actor, momento y cambio en el historial.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-12 — Activar y desactivar cuentas

**Historia de usuario:** Como administrador, quiero administrar el estado de pacientes y médicos.

**Criterios de aceptación:**

1. Permite activar o desactivar cuentas de paciente y médico con confirmación.
2. Antes de desactivar se muestra el impacto en citas futuras Confirmadas.
3. La desactivación cancela esas citas, sin alterar citas pasadas, En curso o Atendidas.
4. La operación es consistente, auditable y genera notificaciones.
5. La cuenta inactiva no puede iniciar sesión.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

### US-ADM-13 — Administrar mi cuenta

**Historia de usuario:** Como administrador, quiero consultar y actualizar mis datos y contraseña.

**Criterios de aceptación:**

1. Permite ver y editar únicamente campos propios autorizados.
2. El cambio de correo requiere verificar la nueva dirección antes de reemplazar la anterior.
3. El cambio de contraseña solicita contraseña actual, nueva y confirmación.
4. No permite crear otros administradores desde la interfaz.

**Pruebas mínimas:** verificar caso exitoso, validaciones, autorización por rol, casos límite y errores relevantes según los criterios anteriores.

## Criterios de cierre y organización GitHub

Cada historia debe contar con una issue individual, rama `feature/<numero-issue>-<descripcion-corta>`, commits descriptivos y pull request hacia `develop` con revisión. Antes de marcarla como terminada:

1. Los criterios de aceptación están cubiertos y probados.
2. Se han ejecutado las pruebas unitarias/integración pertinentes con Jest y Supertest.
3. Los permisos y la validación de datos se aplican también en el servidor.
4. La interfaz es responsive, accesible y usa textos en español.
5. Las migraciones y cambios de datos son consistentes, si aplican.
6. La documentación y la trazabilidad se actualizan.
7. No se fusiona a `main` directamente.

**Importante:** El Sprint 0 continúa abierto por pendientes de auditoría visual. Codex debe revisar este documento junto con los anexos de base de datos y mockups antes de implementar; no debe asumir que todos los diseños ya están cerrados.

