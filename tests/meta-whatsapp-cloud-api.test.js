const crypto = require("node:crypto");
const { createMetaWhatsAppCloudApi, isValidMetaSignature } = require("../src/modules/whatsapp/meta-cloud-api");

describe("Meta WhatsApp Cloud API", () => {
  test("sends a verification code with a configured template", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.test" }] }) });
    const api = createMetaWhatsAppCloudApi({ environment: {
      WHATSAPP_ACCESS_TOKEN: "token-test", WHATSAPP_PHONE_NUMBER_ID: "123456",
      WHATSAPP_VERIFICATION_TEMPLATE: "medigo_code", WHATSAPP_VERIFICATION_TEMPLATE_LANGUAGE: "es"
    }, fetchImpl });
    const result = await api.sendVerificationCode({ to: "+573001234567", code: "123456" });
    expect(result.status).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/123456/messages"), expect.objectContaining({ method: "POST" }));
  });

  test("does not pretend delivery when credentials are missing", async () => {
    const fetchImpl = jest.fn();
    const api = createMetaWhatsAppCloudApi({ environment: {}, fetchImpl });
    await expect(api.sendVerificationCode({ to: "+573001234567", code: "123456" })).resolves.toEqual({ status: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("sends a text reply to a user-initiated chat", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.reply" }] }) });
    const api = createMetaWhatsAppCloudApi({ environment: { WHATSAPP_ACCESS_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "123" }, fetchImpl });
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
