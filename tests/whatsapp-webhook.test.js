const crypto = require("node:crypto");
const express = require("express");
const http = require("node:http");
const { createWhatsAppWebhookRouter } = require("../src/modules/whatsapp/routes");

describe("WhatsApp Meta webhook", () => {
  let server;
  let origin;

  beforeAll(async () => {
    const app = express();
    app.use("/webhooks/whatsapp", createWhatsAppWebhookRouter({
      environment: {
        META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-test-token",
        META_WHATSAPP_APP_SECRET: "app-secret-test",
        META_WHATSAPP_ACCESS_TOKEN: "api-test-token",
        META_WHATSAPP_PHONE_NUMBER_ID: "123"
      }
    }));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = "http://127.0.0.1:" + server.address().port;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  test("devuelve el challenge cuando Meta presenta el token correcto", async () => {
    const response = await fetch(origin + "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-test-token&hub.challenge=challenge-123");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-123");
  });

  test("rechaza un token de verificación incorrecto", async () => {
    const response = await fetch(origin + "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge-123");
    expect(response.status).toBe(403);
  });

  test("rechaza un POST con firma inválida y acepta un evento firmado válido", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const invalid = await fetch(origin + "/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=" + "0".repeat(64) },
      body
    });
    expect(invalid.status).toBe(401);

    const signature = "sha256=" + crypto.createHmac("sha256", "app-secret-test").update(body).digest("hex");
    const valid = await fetch(origin + "/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
      body
    });
    expect(valid.status).toBe(200);
  });
});
