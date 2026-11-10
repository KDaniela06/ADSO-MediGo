# Pruebas

## Estado

La aplicación incluye Jest y pruebas HTTP de humo para la página inicial y los flujos de autenticación disponibles. `npm test` ejecuta la suite.

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
| Recuperación de contraseña | Mensaje genérico para correos desconocidos; hash y vencimiento de 30 minutos; token de un solo uso; límites de reenvío; contraseña y confirmación; enlaces usados o vencidos; protección CSRF. |\n| Verificación de correo | Token enviado y almacenado como hash; activación válida; enlace vencido o usado; límites de reenvío. |
| Citas | Reserva libre; horario ocupado rechazado; anticipación menor de 30 minutos rechazada; segunda cita futura confirmada rechazada; cancelación según ventana. |
| Seguridad | Credenciales inválidas con respuesta genérica; cuenta no verificada rechazada; sesión protegida; CSRF obligatorio; cierre de sesión y rutas por rol. |
| Consulta | Inicio dentro de horario permitido; rechazo fuera de ventana; observación original preservada tras finalizar. |
| WhatsApp | Código incorrecto/vencido; número no vinculado rechazado. |

## Criterios de calidad

Probar resultados esperados y límites temporales; fijar reloj en casos dependientes de hora; asegurar transacciones y concurrencia en integración; mantener mensajes visibles en español y nombres técnicos en inglés. El repositorio incluye Jest y `package-lock.json`. CI usa `npm ci` para instalar las mismas versiones en cada ejecución y luego ejecuta `npm test`. Para repetir estos pasos localmente, ejecuta `npm ci` y después `npm test`.


