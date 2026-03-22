import { runCustomerServiceAgent } from "../customer-service-agent/customer-service-agent";
import {
  appendSessionTurn,
} from "../session-state/session-state";
import type { SessionState } from "../session-state/session-state";

export interface CustomerServiceApiWithSessionInput {
  session: SessionState;
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

export interface CustomerServiceApiWithSessionResult {
  session: SessionState;
  output: CustomerServiceApiOutput;
}

export function runCustomerServiceApiWithSession(
  input: CustomerServiceApiWithSessionInput
): CustomerServiceApiWithSessionResult {
  let session = appendSessionTurn(input.session, {
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
    session: result.session,
    output: {
      sessionId: result.session.sessionId,
      businessContextId: result.session.businessContextId,
      resolvedIntentId: result.resolvedIntentId,
      responseId: result.responseId,
      responseText: result.responseText,
      stage: result.stage,
      status: result.status,
    },
  };
}