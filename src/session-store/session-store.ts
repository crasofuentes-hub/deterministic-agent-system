import type { SessionState } from "../session-state/session-state";

const sessionStore = new Map<string, SessionState>();

function buildKey(sessionId: string, businessContextId: string): string {
  return businessContextId + "::" + sessionId;
}

export function getStoredSession(
  sessionId: string,
  businessContextId: string
): SessionState | undefined {
  return sessionStore.get(buildKey(sessionId, businessContextId));
}

export function saveStoredSession(state: SessionState): void {
  sessionStore.set(buildKey(state.sessionId, state.businessContextId), state);
}

export function clearStoredSession(
  sessionId: string,
  businessContextId: string
): void {
  sessionStore.delete(buildKey(sessionId, businessContextId));
}

export function clearAllStoredSessions(): void {
  sessionStore.clear();
}