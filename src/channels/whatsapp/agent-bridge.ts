import type { CustomerMessage } from "../../customer-messages/types";
import {
  runCustomerServiceAgent,
  type CustomerServiceAgentResult,
} from "../../customer-service-agent/customer-service-agent";
import type { SessionState } from "../../session-state/session-state";

export interface WhatsAppAgentBridgeResult {
  session: SessionState;
  output: {
    channel: "whatsapp";
    customerId: string;
    inboundMessageId: string;
    outboundText: string;
    responseId: string;
    resolvedIntentId: string;
    stage: string;
    status: string;
  };
  agent: CustomerServiceAgentResult;
}

export function runWhatsAppCustomerServiceBridge(params: {
  session: SessionState;
  message: CustomerMessage;
}): WhatsAppAgentBridgeResult {
  const agent = runCustomerServiceAgent({
    session: params.session,
    userMessageText: params.message.text,
  });

  return {
    session: agent.session,
    output: {
      channel: "whatsapp",
      customerId: params.message.customerId,
      inboundMessageId: params.message.channelMessageId,
      outboundText: agent.responseText,
      responseId: agent.responseId,
      resolvedIntentId: agent.resolvedIntentId,
      stage: agent.stage,
      status: agent.status,
    },
    agent,
  };
}
