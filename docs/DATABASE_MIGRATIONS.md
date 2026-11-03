# Migraciones y datos iniciales

## Estado

No se encontraron Sequelize, configuración MySQL, modelos, migraciones o seeders en el repositorio inspeccionado. Este documento establece el procedimiento previsto; no indica que haya migraciones ejecutables.

## Orden de implementación sugerido

1. Confirmar el diseño físico completo y los nombres pendientes de tablas.
2. Crear tablas base: `users`, `specialties`.
3. Crear perfiles `patients` y `doctors` con claves foráneas.
4. Crear disponibilidad semanal, detalles y excepciones según el diseño aprobado.
5. Crear `appointments` e índices/constraints para consistencia y concurrencia.
6. Crear `consultations` y `consultation_addenda`.
7. Crear `account_tokens`, `whatsapp_conversations`, `notification_outbox` y auditoría.
8. Crear seeders exclusivamente para catálogos seguros; definir bootstrap administrativo sin credenciales predeterminadas publicadas.

El orden definitivo depende de las claves foráneas del esquema original.

## Prácticas

- Una migración pequeña y reversible por cambio de esquema.
- Nombres de archivos y código en inglés; descripciones de documentación en español.
- No modificar migraciones ya aplicadas para simular cambios; añadir migración correctiva.
- Mantener claves foráneas, unicidad, índices y tipos consistentes con MySQL.
- No almacenar datos reales de pacientes en seeders.
- No incluir contraseñas, tokens, códigos ni secretos en migraciones o fixtures.
- Revisar cuidadosamente operaciones destructivas sobre datos antes de aplicar en cualquier entorno compartido.

## Datos iniciales

Las especialidades de catálogo podrán sembrarse solo cuando exista una lista aprobada. El usuario administrador inicial debe crearse por procedimiento seguro de despliegue/configuración, no mediante registro público ni con una contraseña fija documentada.

## Ejecución

Los comandos se documentarán aquí cuando exista `package.json` y se haya elegido/configurado Sequelize CLI. Actualmente no hay comandos de migración disponibles.

