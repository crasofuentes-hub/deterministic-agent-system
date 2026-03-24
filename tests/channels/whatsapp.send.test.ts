import { describe, expect, it } from "vitest";
import { buildWhatsAppTextOutbound } from "../../src/channels/whatsapp/send";

describe("whatsapp send", () => {
  it("builds a canonical outbound text payload", () => {
    const payload = buildWhatsAppTextOutbound({
      to: "5215512345678",
      body: "Product: Laptop X Pro | Price: 1499.99 USD",
    });

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "5215512345678",
      type: "text",
      text: {
        body: "Product: Laptop X Pro | Price: 1499.99 USD",
      },
    });
  });

  it("trims outbound fields deterministically", () => {
    const payload = buildWhatsAppTextOutbound({
      to: " 5215512345678 ",
      body: " Hello from agent ",
    });

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "5215512345678",
      type: "text",
      text: {
        body: "Hello from agent",
      },
    });
  });

  it("rejects empty recipient", () => {
    expect(() =>
      buildWhatsAppTextOutbound({
        to: "   ",
        body: "hello",
      })
    ).toThrow("to must be a non-empty string");
  });

  it("rejects empty body", () => {
    expect(() =>
      buildWhatsAppTextOutbound({
        to: "5215512345678",
        body: "   ",
      })
    ).toThrow("body must be a non-empty string");
  });
});
