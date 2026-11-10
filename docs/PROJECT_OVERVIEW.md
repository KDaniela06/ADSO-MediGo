# Resumen del proyecto

## Propósito

MediGo busca facilitar la administración de citas médicas desde una plataforma web. El paciente podrá gestionar su cuenta y sus citas; el médico atenderá las citas asignadas; y el administrador gestionará la operación. Se prevé complementar la experiencia del paciente con operaciones conversacionales por WhatsApp.

## Alcance funcional previsto

- Cuentas, inicio y cierre de sesión, verificación de correo y recuperación de contraseña.
- Gestión de pacientes, médicos y especialidades.
- Disponibilidad por bloques, días y excepciones.
- Reserva, consulta, cancelación y reprogramación de citas.
- Registro de atención médica y aclaraciones posteriores.
- Notificaciones por correo mediante una cola de salida (outbox) y auditoría administrativa.
- Vinculación de WhatsApp y chatbot para operaciones del paciente, mediante proveedor oficial.

Este es el alcance definido, no una afirmación de que dichos módulos estén implementados.

## Roles

| Rol | Responsabilidad principal |
|---|---|
| Paciente | Gestionar su perfil y sus propias citas. |
| Médico | Consultar agenda y atender las citas asignadas. |
| Administrador | Gestionar usuarios operativos, especialidades, disponibilidad y citas. |

No se permite registro público de administradores. Las cuentas médicas son creadas por administración.

## Tecnologías aprobadas

| Tecnología | Uso previsto |
|---|---|
| Node.js y JavaScript | Entorno y lenguaje principal. La versión 24.15.0 se verificó en el entorno de desarrollo y quedó fijada en `.nvmrc` y en el requisito de `package.json`. |
| Express.js | Servidor HTTP y rutas. |
| Pug | Plantillas renderizadas en servidor. |
| Tailwind CSS | Estilos de la interfaz. |
| MySQL y Sequelize | Persistencia, modelos, relaciones y transacciones. |
| Jest | Pruebas automatizadas. |
| Git y GitHub | Control de versiones y seguimiento de trabajo. |

No agregar frameworks de frontend ni dependencias de arquitectura sin justificar su necesidad y obtener aprobación del proyecto.

## Convenciones

- Código, identificadores, comentarios y nombres técnicos en inglés.
- Interfaz, mensajes de error y documentación funcional en español.
- Separar rutas, controladores, servicios, modelos, middlewares y validadores. Añadir repositorios solo cuando aporten una separación útil.
- Validar toda entrada en el servidor. La validación del navegador es complementaria.
- No afirmar que una funcionalidad o prueba existe si no se verificó en el repositorio.

## Seguridad y privacidad

MediGo manejará datos personales y datos asociados a atención médica. Aplicar mínimo privilegio, autorización en servidor, contraseñas con hash seguro, tokens almacenados solo como hashes, sesiones y cookies protegidas, consultas parametrizadas, secretos en variables de entorno y registros sin información sensible innecesaria. Un paciente solo consulta sus propios datos y citas. No ampliar el alcance clínico sin aprobación.

## Acuerdos de trabajo

- Nombre oficial del producto: **MediGo**.
- Desarrollo organizado por issues pequeños, con una rama por issue.
- Commits pequeños y frecuentes, en inglés; la descripción funcional de cada cambio se documenta en español.
- Cada issue termina con un PR hacia `develop`; no se inicia el siguiente issue hasta que la autora revise y fusione el PR actual.
- Los PR ejecutan CI básico con GitHub Actions y Jest. Supertest queda fuera del alcance aprobado.
- No cambiar las historias de usuario sin consultar primero a la autora.

## Estado

En la inspección del 3 de noviembre de 2026, el repositorio tenía un único archivo (`README.md`) y un commit inicial. No se encontraron configuraciones ni código de aplicación. El contexto maestro aporta el alcance funcional descrito aquí; faltan el Documento Maestro original con los criterios de las 35 historias y el diseño físico detallado para cerrar algunas decisiones.

