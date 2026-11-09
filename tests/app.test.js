const request = require("supertest");
const { createApp } = require("../src/app");

describe("MediGo web app", () => {
  it("renders the initial page in Spanish", async () => {
    const response = await request(createApp()).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Tu salud, en buenas manos");
    expect(response.text).toContain("lang=\"es\"");
  });
});

