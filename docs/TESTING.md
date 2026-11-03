# Pruebas

## Estado

No se encontraron pruebas, Jest ni scripts de test. No se ejecutaron pruebas en esta documentación porque no existe aplicación/configuración que probar.

## Enfoque previsto

- Jest para pruebas unitarias de servicios/reglas y pruebas de integración pequeñas.
- CI básico con GitHub Actions al abrir y actualizar PRs dirigidos a `develop`; como mínimo instalar dependencias y ejecutar `npm test` una vez esté configurado.
- Supertest aparece en el documento de historias, pero no en la lista tecnológica aprobada original; confirmar antes de agregarlo como dependencia.
- Separar `tests/unit` y `tests/integration` cuando se cree la estructura aprobada.
- Nombres descriptivos en inglés; datos ficticios, sin información de pacientes reales.
- No probar funciones que todavía no existen ni declarar resultados sin ejecutar los comandos.

## Casos iniciales sugeridos

| Área | Casos |
|---|---|
| Registro | Registro válido; menor de 18 rechazado; documento duplicado rechazado. |
| Citas | Reserva libre; horario ocupado rechazado; anticipación menor de 30 minutos rechazada; segunda cita futura confirmada rechazada; cancelación según ventana. |
| Seguridad | Credenciales inválidas; token vencido o usado rechazado. |
| Consulta | Inicio dentro de horario permitido; rechazo fuera de ventana; observación original preservada tras finalizar. |
| WhatsApp | Código incorrecto/vencido; número no vinculado rechazado. |

## Criterios de calidad

Probar resultados esperados y límites temporales; fijar reloj en casos dependientes de hora; asegurar transacciones y concurrencia en integración; mantener mensajes visibles en español y nombres técnicos en inglés. Definir configuración y comandos reales después de incorporar `package.json` y Jest. La configuración CI es un issue de Sprint 1; todavía no hay pruebas automáticas ejecutándose en GitHub.

