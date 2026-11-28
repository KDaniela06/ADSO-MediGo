# Configurar Meta WhatsApp Cloud API

Esta guía conecta el webhook de MediGo con Meta y deja configurado el envío de mensajes mediante WhatsApp Cloud API.

## 1. Preparar las credenciales

En Meta for Developers, crea o abre la aplicación que tiene el producto WhatsApp y copia los valores en el archivo local `.env` de MediGo:

| Variable | Dónde se obtiene |
|---|---|
| `META_WHATSAPP_ACCESS_TOKEN` | Token de acceso de WhatsApp Cloud API. Para producción, configura un token de sistema con los permisos requeridos. |
| `META_WHATSAPP_APP_SECRET` | App Secret, en la configuración básica de la aplicación. Se usa para verificar las firmas de los POST. |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Identificador del número en WhatsApp > Configuración de API. Se usa en la ruta de envío de mensajes. |
| `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | Identificador de la cuenta de WhatsApp Business, útil para administrar y revisar plantillas. |
| `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Cadena privada que eliges tú; debe ser idéntica en `.env` y en la configuración del webhook de Meta. |
| `META_WHATSAPP_API_VERSION` | Versión de Graph API que se usará al enviar mensajes. El ejemplo del proyecto usa `v25.0`. |

No pegues tokens ni secretos en el repositorio, en issues o en mensajes. Usa `.env.example` como lista de nombres y mantén los valores reales solo en tu `.env`.

## 2. Publicar el callback

Meta requiere que el callback sea una dirección HTTPS accesible desde Internet. Para desarrollo local, publica temporalmente el puerto 3000 mediante un túnel HTTPS; `localhost` por sí solo no es accesible por Meta.

La ruta configurada por MediGo es:

```text
https://TU-DOMINIO/webhooks/whatsapp
```

En Meta for Developers, abre el producto Webhooks de la aplicación, elige el objeto WhatsApp Business Account y configura:

- **Callback URL:** la dirección HTTPS anterior.
- **Verify token:** el mismo valor de `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Campo suscrito:** `messages`.

Meta verifica la URL con un GET que incluye `hub.mode`, `hub.verify_token` y `hub.challenge`. MediGo compara el token y devuelve el challenge solo si coincide. Para los POST, MediGo valida `X-Hub-Signature-256` con `META_WHATSAPP_APP_SECRET` antes de leer el evento.

Si Meta solicita una suscripción de la aplicación a la cuenta de WhatsApp Business, confirma la conexión en el panel de WhatsApp/API Setup y suscribe el campo `messages`.

## 3. Configurar plantillas

Crea y espera la aprobación de plantillas en WhatsApp Manager. El idioma configurado por defecto es `es_CO`. Copia en el entorno los nombres exactos, respetando minúsculas y guiones bajos:

- `META_WHATSAPP_VERIFICATION_TEMPLATE_NAME`: plantilla de código para vincular WhatsApp; debe tener una variable de cuerpo.
- `META_WHATSAPP_CONFIRMATION_TEMPLATE_NAME`: confirmación de cita.
- `META_WHATSAPP_REMINDER_TEMPLATE_NAME`: recordatorio de cita.
- `META_WHATSAPP_RESCHEDULE_TEMPLATE_NAME`: cita reprogramada.
- `META_WHATSAPP_CANCELLATION_TEMPLATE_NAME`: cita cancelada.

El código envía estas plantillas mediante `sendAppointmentTemplate({ to, kind, parameters })`. Los valores de `kind` son `confirmation`, `reminder`, `reschedule` y `cancellation`; `parameters` sigue el orden de las variables del cuerpo.\n\nPara `META_WHATSAPP_REMINDER_TEMPLATE_NAME`, crea y espera la aprobación de una plantilla de utilidad en español con dos variables de cuerpo, por ejemplo: `Te recordamos tu cita en MediGo para el {{1}} a las {{2}}. Responde a este mensaje si necesitas cancelarla o reprogramarla.` La aplicación envía la fecha y la hora en America/Bogota.\n\nEl paciente solicita el aviso desde el menú de WhatsApp eligiendo una cita con al menos 24 horas de anticipación. MediGo registra su consentimiento y número verificado, programa el mensaje para 24 horas antes y lo envía con la plantilla aprobada. Si cancela la cita, el aviso pendiente se cancela; si la reprograma, el horario del aviso se recalcula. El servidor comprueba los avisos pendientes cada minuto, guarda el identificador que devuelve Meta y reintenta fallos hasta tres veces.

## 4. Aplicar y comprobar

1. Completa las variables en `.env` y reinicia MediGo.
2. Confirma que `GET /webhooks/whatsapp` devuelve 403 si el token no coincide.
3. Configura el callback en Meta y espera que el panel indique que la verificación terminó.
4. Envía un mensaje de prueba al número de WhatsApp y revisa que Meta invoque `POST /webhooks/whatsapp`.
5. Si el envío o la recepción fallan, confirma el token, el número de teléfono ID, la versión, los permisos del token y que la plantilla esté aprobada en el idioma esperado.

La ruta está montada en `src/app.js` antes del parser JSON para conservar el cuerpo original que necesita la validación de firma.

## Referencias oficiales

- [Configuración de webhooks de Meta](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
- [Referencia de plantillas de WhatsApp Business](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/)
