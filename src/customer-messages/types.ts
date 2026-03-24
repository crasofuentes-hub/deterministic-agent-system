export type CustomerMessageChannel = "whatsapp";

export interface CustomerMessage {
  channel: CustomerMessageChannel;
  channelMessageId: string;
  customerId: string;
  text: string;
  receivedAtIso: string;
  traceId?: string;
  metadata: {
    whatsappPhoneNumberId?: string;
    whatsappDisplayPhoneNumber?: string;
    whatsappWaId?: string;
    profileName?: string;
  };
}
