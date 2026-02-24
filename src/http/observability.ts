let requestCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function nextCounter(): number {
  requestCounter += 1;
  if (requestCounter > 9_999_999) {
    requestCounter = 1;
  }
  return requestCounter;
}

export function createRequestId(): string {
  const c = String(nextCounter()).padStart(7, "0");
  return "req-" + Date.now().toString(36) + "-" + c;
}

export function logHttpEvent(event: Record<string, unknown>): void {
  const line = {
    ts: nowIso(),
    subsystem: "http",
    ...event,
  };
  try {
    process.stdout.write(JSON.stringify(line) + "\n");
  } catch {
    // no-op: logging must never break request handling
  }
}
