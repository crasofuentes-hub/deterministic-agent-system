import type { SessionState } from "../session-state/session-state";

const sessionStore = new Map<string, SessionState>();
const customerSessionIndex = new Map<string, string>();

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim();
}

function buildKey(sessionId: string, businessContextId: string): string {
  return normalizeText(businessContextId) + "::" + normalizeText(sessionId);
}

function buildCustomerKey(customerId: string, businessContextId: string): string {
  return normalizeText(businessContextId) + "::" + normalizeText(customerId);
}

export function getStoredSession(
  sessionId: string,
  businessContextId: string
): SessionState | undefined {
  return sessionStore.get(buildKey(sessionId, businessContextId));
}

export function getStoredSessionIdForCustomer(
  customerId: string,
  businessContextId: string
): string | undefined {
  return customerSessionIndex.get(buildCustomerKey(customerId, businessContextId));
}

export function saveStoredSession(state: SessionState): void {
  sessionStore.set(buildKey(state.sessionId, state.businessContextId), state);

  const customerEntity = state.collectedEntities.find((item) => item.entityId === "customerId");
  if (customerEntity && customerEntity.value.trim().length > 0) {
    customerSessionIndex.set(
      buildCustomerKey(customerEntity.value, state.businessContextId),
      normalizeText(state.sessionId)
    );
  }
}

export function clearStoredSession(
  sessionId: string,
  businessContextId: string
): void {
  sessionStore.delete(buildKey(sessionId, businessContextId));
}

export function clearAllStoredSessions(): void {
  sessionStore.clear();
  customerSessionIndex.clear();
}