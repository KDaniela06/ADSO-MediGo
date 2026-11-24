const { Router } = require("express");
const { createMetaWhatsAppCloudApi, isValidMetaSignature } = require("./meta-cloud-api");
const { handleIncomingWhatsAppMessage } = require("./conversation-service");

function createWhatsAppWebhookRouter({ models, sequelize, emailSender, sender, environment = process.env } = {}) {
  const router = Router();
  const api = sender || createMetaWhatsAppCloudApi({ environment });

  router.get("/", (request, response) => {
    const valid = request.query["hub.mode"] === "subscribe"
      && request.query["hub.verify_token"]
      && request.query["hub.verify_token"] === environment.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!valid) return response.sendStatus(403);
    return response.type("text/plain").status(200).send(request.query["hub.challenge"]);
  });

  router.post("/", require("express").raw({ type: "application/json", limit: "1mb" }), async (request, response) => {
    if (!isValidMetaSignature(request.body, request.get("x-hub-signature-256"), environment.WHATSAPP_APP_SECRET)) {
      return response.sendStatus(401);
    }
    let payload;
    try { payload = JSON.parse(request.body.toString("utf8")); }
    catch { return response.sendStatus(400); }
    if (payload.object !== "whatsapp_business_account") return response.sendStatus(404);
    const messages = (payload.entry || []).flatMap((entry) => entry.changes || [])
      .filter((change) => change.field === "messages")
      .flatMap((change) => change.value?.messages || []);
    for (const message of messages) {
      if (message.type !== "text" || !message.from || !message.id || !message.text?.body) continue;
      try {
        const result = await handleIncomingWhatsAppMessage({
          models, sequelize, emailSender, sender: message.from, text: message.text.body,
          messageId: message.id, now: new Date()
        });
        if (result.status === "ready") await api.sendTextMessage({ to: result.to, text: result.reply });
      } catch {
        // Acknowledge the webhook; Meta retries are deduplicated by the conversation message id.
      }
    }
    return response.sendStatus(200);
  });
  return router;
}

module.exports = { createWhatsAppWebhookRouter };
