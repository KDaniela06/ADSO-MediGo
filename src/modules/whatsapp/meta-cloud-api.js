const crypto = require("node:crypto");

function isValidMetaSignature(rawBody, signature, appSecret) {
  if (!rawBody || !signature || !appSecret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function createMetaWhatsAppCloudApi({
  environment = process.env,
  fetchImpl = global.fetch
} = {}) {
  async function sendVerificationCode({ to, code }) {
    const accessToken = environment.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = environment.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = environment.WHATSAPP_VERIFICATION_TEMPLATE;
    const templateLanguage = environment.WHATSAPP_VERIFICATION_TEMPLATE_LANGUAGE || "es";
    const apiVersion = environment.WHATSAPP_GRAPH_API_VERSION || "v27.0";

    if (!accessToken || !phoneNumberId || !templateName || !fetchImpl) {
      return { status: "unavailable" };
    }

    try {
      const response = await fetchImpl(
        "https://graph.facebook.com/" + apiVersion + "/" + encodeURIComponent(phoneNumberId) + "/messages",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: String(to).replace(/^\+/, ""),
            type: "template",
            template: {
              name: templateName,
              language: { code: templateLanguage },
              components: [{
                type: "body",
                parameters: [{ type: "text", text: code }]
              }]
            }
          }),
          signal: AbortSignal.timeout(10000)
        }
      );
      if (!response.ok) return { status: "failed" };
      const payload = await response.json();
      return Array.isArray(payload.messages) && payload.messages[0]?.id
        ? { status: "sent" }
        : { status: "failed" };
    } catch {
      return { status: "failed" };
    }
  }

  async function sendTextMessage({ to, text }) {
    const accessToken = environment.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = environment.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = environment.WHATSAPP_GRAPH_API_VERSION || "v27.0";
    if (!accessToken || !phoneNumberId || !fetchImpl || !to || !text) return { status: "unavailable" };
    try {
      const response = await fetchImpl(
        "https://graph.facebook.com/" + apiVersion + "/" + encodeURIComponent(phoneNumberId) + "/messages",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", recipient_type: "individual",
            to: String(to).replace(/^\+/, ""), type: "text", text: { preview_url: false, body: String(text).slice(0, 4096) }
          }),
          signal: AbortSignal.timeout(10000)
        }
      );
      if (!response.ok) return { status: "failed" };
      const payload = await response.json();
      return Array.isArray(payload.messages) && payload.messages[0]?.id ? { status: "sent" } : { status: "failed" };
    } catch {
      return { status: "failed" };
    }
  }

  return { sendVerificationCode, sendTextMessage };
}

module.exports = { createMetaWhatsAppCloudApi, isValidMetaSignature };
