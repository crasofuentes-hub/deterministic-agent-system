import { describe, expect, it } from "vitest";
import { resolveIntentFromText } from "../../src/intent-resolver/intent-resolver";

describe("intent-resolver", () => {
  it("resolves human handoff deterministically", () => {
    expect(resolveIntentFromText("Quiero hablar con un humano")).toEqual({
      intentId: "request-human-handoff",
      confidence: "rule",
    });
  });

  it("resolves close conversation deterministically", () => {
    expect(resolveIntentFromText("Quiero cerrar la conversación")).toEqual({
      intentId: "close-conversation",
      confidence: "rule",
    });
  });

  it("resolves order status deterministically", () => {
    expect(resolveIntentFromText("Quiero saber el estado de mi pedido")).toEqual({
      intentId: "consult-order-status",
      confidence: "rule",
    });
  });

  it("resolves availability deterministically", () => {
    expect(resolveIntentFromText("Tienen disponibilidad de la laptop x")).toEqual({
      intentId: "consult-availability",
      confidence: "rule",
    });
  });

  it("resolves price deterministically", () => {
    expect(resolveIntentFromText("Cual es el precio de la laptop x")).toEqual({
      intentId: "consult-price",
      confidence: "rule",
    });
  });

  it("falls back to consult-product deterministically", () => {
    expect(resolveIntentFromText("Necesito informacion del producto laptop x")).toEqual({
      intentId: "consult-product",
      confidence: "rule",
    });
  });
});