# Reglas de negocio

## Pacientes y cuentas

- Edad mínima: 18 años cumplidos.
- Identificación centralizada en `users`; combinación tipo/número única. Tipos previstos: `CC`, `CE`, `PASSPORT`.
- Correo único y verificado para acceder a reservas.
- El paciente solo ve sus propios datos y citas; no puede modificar libremente su identificación.
- Desactivar un paciente requiere mostrar las futuras citas confirmadas y confirmar; luego se cancelan, se notifica cuando corresponda y se conserva el historial.

## Médicos, especialidades y horarios

- Las cuentas médicas solo las crea administración; invitación para definir contraseña válida por 24 horas.
- Un médico tiene una especialidad principal. Administración configura horarios.
- Una especialidad inactiva no se ofrece en nuevas reservas; no cancela citas existentes y se conserva en el historial.
- Al desactivar un médico se previsualizan las citas futuras confirmadas; tras confirmar, se cancelan, notifican y conservan.
- Disponibilidad no puede cruzar medianoche ni tener bloques superpuestos. Se contemplan excepciones por horas y por varios días.
- Un cambio de horario debe previsualizar las citas afectadas y cancelar solo las que dejen de ser válidas.

## Citas

- Duración exacta: 30 minutos.
- Ventana de reserva: desde 30 minutos antes hasta 30 días hacia el futuro.
- Un paciente puede tener como máximo una cita futura en estado `Confirmed`.
- Cita debe coincidir con disponibilidad y requerir paciente, médico y especialidad activos, correo verificado y horario libre.
- `Confirmed` e `In Progress` ocupan el horario. `Attended`, `Cancelled` y `No Show` lo liberan.
- Paciente puede cancelar o reprogramar hasta 24 horas antes. Administración aplica también el mínimo de 24 horas en operaciones manuales.
- Médico no cancela ni reprograma. Reprogramación conserva el médico, actualiza la cita y registra historial.
- Cancelaciones automáticas por desactivación o cambios de horario son excepciones al límite de 24 horas.
- No registrar ausencia antes del fin del horario; las citas vencidas no se convierten automáticamente a `No Show`.
- Las reservas simultáneas deben protegerse en base de datos/transacción además de validarse en Sequelize.

## Atención médica

- Solo el médico asignado puede iniciar una consulta de cita `Confirmed`.
- Inicio no antes de la hora programada y antes de terminar el bloque. Al iniciar: `In Progress`; al terminar: `Attended`.
- Observaciones opcionales. Una consulta finalizada no permite editar su observación original.
- Aclaraciones posteriores se agregan como registros independientes con consulta, médico autor, contenido y fecha/hora.

## Verificación, contraseñas y límites

- Verificación de correo: enlace de un solo uso, válido 24 horas; guardar solo hash del token.
- Recuperación: token de un uso válido 30 minutos; respuesta no revela si el correo existe.
- Espera mínima 60 segundos por propósito y máximo cinco solicitudes por hora y propósito; hasta tres intentos automáticos de entrega de correo. Fallos no reinician los límites.
- Contraseña nunca en texto plano, validación en servidor y nunca enviada por correo.

## WhatsApp

- Vinculación requiere consentimiento y código de seis dígitos, válido cinco minutos, máximo cinco intentos.
- Número verificado único por cuenta. Conversación inactiva expira tras 15 minutos.
- Solo pacientes vinculados y verificados; las operaciones se vuelven a validar en servidor y siguen las reglas web.
- No enviar mensajes proactivos por WhatsApp; responder en el chat a una operación iniciada ahí. Usar proveedor oficial.

## Auditoría y notificaciones

- Auditoría para creación de médicos, cambios de estado/horario/especialidad, cancelaciones, reprogramaciones y ausencias.
- Nunca registrar contraseñas, tokens originales ni códigos de verificación.
- Outbox conserva destinatario, tipo, canal, estado, número de intentos, marcas de tiempo y último error. Los reintentos deben controlarse y evitar duplicados.

