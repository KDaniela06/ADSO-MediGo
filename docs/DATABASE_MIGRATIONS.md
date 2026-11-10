# Migraciones y datos iniciales

## Estado actual

El issue #12 incluye una migración Sequelize para las tablas del flujo de registro de pacientes: `users`, `patients` y `account_tokens`. El runner registra cada migración aplicada en `schema_migrations`. Las otras tablas del inventario todavía no tienen migraciones.

El diseño físico propuesto para esas tres tablas está en [USER_REGISTRATION_SCHEMA.md](USER_REGISTRATION_SCHEMA.md), sujeto a revisión en el PR del issue #12.

## Ejecutar la migración

1. Configura `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `.env`.
2. Ejecuta `npm run db:migrate`.

El runner omite migraciones ya registradas. La migración exporta `down(queryInterface)` para rollback manual; el runner no aplica rollbacks. No se generan datos personales de pacientes en seeders y no se incluyen credenciales iniciales.

## Convenciones

- Una migración pequeña y reversible por cambio de esquema.
- Nombres técnicos en inglés y documentación funcional en español.
- No editar migraciones aplicadas para simular cambios; agregar una migración correctiva.
- Mantener claves foráneas, índices y restricciones únicas en la base de datos.
- No almacenar contraseñas, tokens originales ni secretos en fixtures o migraciones.
- Revisar cuidadosamente operaciones destructivas antes de ejecutarlas en un entorno compartido.

## Próximos pasos

Completar las migraciones restantes cuando se implementen sus historias y se definan las columnas físicas correspondientes. Crear seeders solo para catálogos aprobados. El usuario administrador inicial se configurará por un procedimiento seguro de despliegue, nunca con una contraseña fija publicada.
