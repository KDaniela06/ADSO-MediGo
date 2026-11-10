# Interfaz e identidad visual

## Paleta aprobada

| Uso | Color |
|---|---|
| Azul principal: encabezados, navegación y acción primaria | `#163D70` |
| Azul secundario: enlaces, activo y acciones secundarias | `#2387D1` |
| Turquesa: estados positivos y destacados | `#16A6A1` |
| Fondo general | `#F3F7FA` |
| Texto principal | `#243447` |

No cambiar la paleta aprobada sin autorización del proyecto.

## Principios visuales

Interfaz minimalista, limpia, profesional y moderna; formularios claros, espacio suficiente, bordes suaves, tarjetas sencillas e iconografía coherente. Evitar decoración que compita con tareas de salud.

## Adaptación

- Escritorio: barra lateral izquierda, área principal y encabezado con información de usuario.
- Móvil: menú compacto, formularios de una columna, tarjetas en lugar de tablas extensas y controles táctiles accesibles.
- Usar Pug para vistas y Tailwind CSS para estilos. No incorporar frameworks frontend adicionales.

## Pantallas previstas

Autenticación; dashboard por rol; exploración/reserva de citas; citas e historial; agenda y consulta médica; perfiles; gestión administrativa de pacientes, médicos, especialidades, horarios y citas; flujos de verificación de correo y WhatsApp.

Los mockups recibidos están organizados en `design/mockups/` y se revisaron visualmente durante el Sprint 0:

- `auth/login.jpg` y `auth/patient-registration.jpg`
- `patient/dashboard.jpg` y `patient/profile.jpg`
- `doctor/dashboard.jpg` y `doctor/profile.jpg`
- `admin/dashboard.jpg`

La revisión confirma pantallas para autenticación, registro, paneles por rol y perfiles de paciente y médico. Los campos visibles de registro/perfil se relacionan con el modelo de datos aprobado en [DATABASE_PHYSICAL_PROPOSAL.md](DATABASE_PHYSICAL_PROPOSAL.md). El mockup de inicio de sesión incluye acceso con Google; esta opción queda fuera del alcance aprobado y no se implementará por ahora. Las imágenes se conservan como referencia visual para comparar la interfaz implementada.

## Accesibilidad y contenido

Etiquetas visibles en formularios, foco perceptible, contraste legible, navegación por teclado, botones con verbos claros y errores en español junto al campo y/o resumen del formulario. No usar color como único indicador de estado.

