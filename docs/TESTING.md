# Pruebas

## Estado

El esqueleto de la aplicación incluye Jest y una prueba de humo HTTP para la página inicial. `npm test` ejecuta la suite.

## Enfoque previsto

- Jest para pruebas unitarias de servicios/reglas y pruebas de integración pequeñas.
- CI básico con GitHub Actions en PRs dirigidos a `develop`; instala dependencias y ejecuta `npm test`.
- Separar `tests/unit` y `tests/integration` cuando se cree la estructura aprobada.
- Nombres descriptivos en inglés; datos ficticios, sin información de pacientes reales.
- No probar funciones que todavía no existen ni declarar resultados sin ejecutar los comandos.

## Casos iniciales sugeridos

| Área | Casos |
|---|---|
| Registro | Registro válido; menor de 18 rechazado; documento duplicado rechazado. |
| Verificación de correo | Token enviado y almacenado como hash; activación válida; enlace vencido o usado; límites de reenvío. |
| Citas | Reserva libre; horario ocupado rechazado; anticipación menor de 30 minutos rechazada; segunda cita futura confirmada rechazada; cancelación según ventana. |
| Seguridad | Credenciales inválidas; token vencido o usado rechazado. |
| Consulta | Inicio dentro de horario permitido; rechazo fuera de ventana; observación original preservada tras finalizar. |
| WhatsApp | Código incorrecto/vencido; número no vinculado rechazado. |

## Criterios de calidad

Probar resultados esperados y límites temporales; fijar reloj en casos dependientes de hora; asegurar transacciones y concurrencia en integración; mantener mensajes visibles en español y nombres técnicos en inglés. El repositorio incluye `package.json` y Jest; el workflow básico se agrega en el issue #11. El proyecto aún no tiene `package-lock.json`, así que CI instala las versiones compatibles definidas en `package.json`.


