const crypto = require("node:crypto");

function isValidMetaSignature(rawBody, signature, appSecret) {
  if (!rawBody || !signature || !appSecret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signature.toLowerCase());
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getMetaWhatsAppConfig(environment) {
  return {
    accessToken: environment.META_WHATSAPP_ACCESS_TOKEN || environment.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: environment.META_WHATSAPP_PHONE_NUMBER_ID || environment.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: environment.META_WHATSAPP_API_VERSION || environment.WHATSAPP_GRAPH_API_VERSION || "v25.0",
    templateLanguage: environment.META_WHATSAPP_TEMPLATE_LANGUAGE
      || environment.WHATSAPP_VERIFICATION_TEMPLATE_LANGUAGE || "es_CO"
  };
}

function createMetaWhatsAppCloudApi({
  environment = process.env,
  fetchImpl = global.fetch
} = {}) {
  const config = getMetaWhatsAppConfig(environment);

  async function sendTemplateMessage({ to, templateName, language, parameters = [], includeMessageId = false } = {}) {
    if (!config.accessToken || !config.phoneNumberId || !templateName || !fetchImpl || !to || !Array.isArray(parameters)) {
      return { status: "unavailable" };
    }

    try {
      const response = await fetchImpl(
        "https://graph.facebook.com/" + config.apiVersion + "/" + encodeURIComponent(config.phoneNumberId) + "/messages",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + config.accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: String(to).replace(/^\+/, ""),
            type: "template",
            template: {
              name: templateName,
              language: { code: language || config.templateLanguage },
              ...(parameters.length ? {
                components: [{
                  type: "body",
                  parameters: parameters.map((value) => ({ type: "text", text: String(value) }))
                }]
              } : {})
            }
          }),
          signal: AbortSignal.timeout(10000)
        }
      );
      if (!response.ok) return { status: "failed" };
      const payload = await response.json();
      return Array.isArray(payload.messages) && payload.messages[0]?.id
        ? (includeMessageId ? { status: "sent", messageId: payload.messages[0].id } : { status: "sent" })
        : { status: "failed" };
    } catch {
      return { status: "failed" };
    }
  }

  async function sendVerificationCode({ to, code }) {
    const templateName = environment.META_WHATSAPP_VERIFICATION_TEMPLATE_NAME
      || environment.WHATSAPP_VERIFICATION_TEMPLATE;
    if (!code) return { status: "unavailable" };
    return sendTemplateMessage({ to, templateName, parameters: [code] });
  }

  async function sendAppointmentTemplate({ to, kind, parameters = [] } = {}) {
    const templateEnvironmentKeys = {
      confirmation: "META_WHATSAPP_CONFIRMATION_TEMPLATE_NAME",
      reminder: "META_WHATSAPP_REMINDER_TEMPLATE_NAME",
      reschedule: "META_WHATSAPP_RESCHEDULE_TEMPLATE_NAME",
      cancellation: "META_WHATSAPP_CANCELLATION_TEMPLATE_NAME"
    };
    const environmentKey = templateEnvironmentKeys[kind];
    if (!environmentKey) return { status: "unavailable" };
    return sendTemplateMessage({
      to,
      templateName: environment[environmentKey],
      parameters,
      includeMessageId: true
    });
  }

  async function sendTextMessage({ to, text }) {
    if (!config.accessToken || !config.phoneNumberId || !fetchImpl || !to || !text) {
      return { status: "unavailable" };
    }
    try {
      const response = await fetchImpl(
        "https://graph.facebook.com/" + config.apiVersion + "/" + encodeURIComponent(config.phoneNumberId) + "/messages",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + config.accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: String(to).replace(/^\+/, ""),
            type: "text",
            text: { preview_url: false, body: String(text).slice(0, 4096) }
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

  return { sendVerificationCode, sendTemplateMessage, sendAppointmentTemplate, sendTextMessage };
}

module.exports = { createMetaWhatsAppCloudApi, getMetaWhatsAppConfig, isValidMetaSignature };
