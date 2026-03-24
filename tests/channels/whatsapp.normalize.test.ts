import { describe, expect, it } from "vitest";
import { normalizeWhatsAppWebhook } from "../../src/channels/whatsapp/normalize";

describe("whatsapp normalize", () => {
  it("normalizes a text webhook into a canonical customer message", () => {
    const result = normalizeWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-001",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "15551234567",
                  phone_number_id: "phone-number-id-001",
                },
                contacts: [
                  {
                    profile: {
                      name: "Oscar Cliente",
                    },
                    wa_id: "5215512345678",
                  },
                ],
                messages: [
                  {
                    from: "5215512345678",
                    id: "wamid.HBgLN...",
                    timestamp: "1774310400",
                    type: "text",
                    text: {
                      body: "Quiero saber el status de mi orden ORDER-55555",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok=true");
    }

    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      channel: "whatsapp",
      channelMessageId: "wamid.HBgLN...",
      customerId: "5215512345678",
      text: "Quiero saber el status de mi orden ORDER-55555",
      receivedAtIso: "2026-03-24T00:00:00.000Z",
      traceId: "whatsapp:wamid.HBgLN...",
      metadata: {
        whatsappPhoneNumberId: "phone-number-id-001",
        whatsappDisplayPhoneNumber: "15551234567",
        whatsappWaId: "5215512345678",
        profileName: "Oscar Cliente",
      },
    });
  });

  it("ignores non-text messages deterministically", () => {
    const result = normalizeWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-002",
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    from: "5215512345678",
                    id: "wamid.image.001",
                    timestamp: "1774310400",
                    type: "image",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok=true");
    }

    expect(result.value).toEqual([]);
  });

  it("rejects unsupported top-level objects", () => {
    const result = normalizeWhatsAppWebhook({
      object: "not-whatsapp",
      entry: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "unsupported webhook object",
    });
  });
});
