import { runCustomerServiceAgent } from "../customer-service-agent/customer-service-agent";
import {
  appendSessionTurn,
  createInitialSessionState,
} from "../session-state/session-state";

export interface CustomerServiceApiInput {
  sessionId: string;
  businessContextId: string;
  userMessageText: string;
  userTurnId?: string;
  userCreatedAtIso?: string;
}

export interface CustomerServiceApiOutput {
  sessionId: string;
  businessContextId: string;
  resolvedIntentId: string;
  responseId: string;
  responseText: string;
  stage: string;
  status: string;
}

export function runCustomerServiceApi(
  input: CustomerServiceApiInput
): CustomerServiceApiOutput {
  let session = createInitialSessionState({
    sessionId: input.sessionId,
    businessContextId: input.businessContextId,
  });

  session = appendSessionTurn(session, {
    turnId: input.userTurnId ?? "user-turn-1",
    speaker: "user",
    messageText: input.userMessageText,
    createdAtIso: input.userCreatedAtIso ?? "2026-03-10T00:00:00Z",
  });

  const result = runCustomerServiceAgent({
    session,
    userMessageText: input.userMessageText,
  });

  return {
    sessionId: result.session.sessionId,
    businessContextId: result.session.businessContextId,
    resolvedIntentId: result.resolvedIntentId,
    responseId: result.responseId,
    responseText: result.responseText,
    stage: result.stage,
    status: result.status,
  };
}