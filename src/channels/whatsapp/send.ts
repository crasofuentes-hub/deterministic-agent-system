export interface WhatsAppTextOutboundPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    body: string;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildWhatsAppTextOutbound(params: {
  to: string;
  body: string;
}): WhatsAppTextOutboundPayload {
  if (!isNonEmptyString(params.to)) {
    throw new Error("to must be a non-empty string");
  }

  if (!isNonEmptyString(params.body)) {
    throw new Error("body must be a non-empty string");
  }

  return {
    messaging_product: "whatsapp",
    to: params.to.trim(),
    type: "text",
    text: {
      body: params.body.trim(),
    },
  };
}
