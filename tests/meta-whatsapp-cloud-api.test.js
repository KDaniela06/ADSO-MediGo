const crypto = require("node:crypto");
const { createMetaWhatsAppCloudApi, getMetaWhatsAppConfig, isValidMetaSignature } = require("../src/modules/whatsapp/meta-cloud-api");

describe("Meta WhatsApp Cloud API", () => {
  test("usa las variables META_WHATSAPP para enviar el código de verificación", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.test" }] }) });
    const api = createMetaWhatsAppCloudApi({ environment: {
      META_WHATSAPP_ACCESS_TOKEN: "token-test",
      META_WHATSAPP_PHONE_NUMBER_ID: "123456",
      META_WHATSAPP_API_VERSION: "v25.0",
      META_WHATSAPP_TEMPLATE_LANGUAGE: "es_CO",
      META_WHATSAPP_VERIFICATION_TEMPLATE_NAME: "medigo_code"
    }, fetchImpl });
    const result = await api.sendVerificationCode({ to: "+573001234567", code: "123456" });
    expect(result.status).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://graph.facebook.com/v25.0/123456/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-test" }),
        body: expect.stringContaining('"code":"es_CO"')
      })
    );
  });

  test("mantiene compatibilidad con las variables WHATSAPP antiguas", () => {
    expect(getMetaWhatsAppConfig({
      WHATSAPP_ACCESS_TOKEN: "legacy-token",
      WHATSAPP_PHONE_NUMBER_ID: "321",
      WHATSAPP_GRAPH_API_VERSION: "v24.0"
    })).toEqual({
      accessToken: "legacy-token",
      phoneNumberId: "321",
      apiVersion: "v24.0",
      templateLanguage: "es_CO"
    });
  });

  test("envía una plantilla de recordatorio con sus parámetros", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.reminder" }] }) });
    const api = createMetaWhatsAppCloudApi({ environment: {
      META_WHATSAPP_ACCESS_TOKEN: "token",
      META_WHATSAPP_PHONE_NUMBER_ID: "123",
      META_WHATSAPP_REMINDER_TEMPLATE_NAME: "medigo_recordatorio",
      META_WHATSAPP_TEMPLATE_LANGUAGE: "es_CO"
    }, fetchImpl });
    await expect(api.sendAppointmentTemplate({
      to: "+573001234567",
      kind: "reminder",
      parameters: ["Karen", "27/11/2026", "10:00"]
    })).resolves.toEqual({ status: "sent", messageId: "wamid.reminder" });
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.template.name).toBe("medigo_recordatorio");
    expect(requestBody.template.components[0].parameters.map((item) => item.text)).toEqual(["Karen", "27/11/2026", "10:00"]);
  });

  test("does not pretend delivery when credentials or template are missing", async () => {
    const fetchImpl = jest.fn();
    const api = createMetaWhatsAppCloudApi({ environment: {}, fetchImpl });
    await expect(api.sendVerificationCode({ to: "+573001234567", code: "123456" })).resolves.toEqual({ status: "unavailable" });
    await expect(api.sendAppointmentTemplate({ to: "+573001234567", kind: "reminder" })).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("sends a text reply to a user-initiated chat", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.reply" }] }) });
    const api = createMetaWhatsAppCloudApi({ environment: { META_WHATSAPP_ACCESS_TOKEN: "token", META_WHATSAPP_PHONE_NUMBER_ID: "123" }, fetchImpl });
    await expect(api.sendTextMessage({ to: "+573001234567", text: "Hola" })).resolves.toEqual({ status: "sent" });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/123/messages"), expect.objectContaining({ body: expect.stringContaining('"body":"Hola"') }));
  });

  test("checks the Meta webhook signature", () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = "sha256=" + crypto.createHmac("sha256", "secret").update(body).digest("hex");
    expect(isValidMetaSignature(body, signature, "secret")).toBe(true);
    expect(isValidMetaSignature(body, signature, "wrong-secret")).toBe(false);
  });
});
