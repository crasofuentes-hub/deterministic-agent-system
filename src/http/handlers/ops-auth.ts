import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../responses";

function readHeaderToken(request: IncomingMessage, headerName: string): string | undefined {
  const value = request.headers[headerName];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function requireOpsToken(
  request: IncomingMessage,
  response: ServerResponse,
  expectedToken: string | undefined
): boolean {
  if (typeof expectedToken !== "string" || expectedToken.trim().length === 0) {
    sendJson(response, 500, {
      ok: false,
      error: "ops api token is not configured",
    });
    return false;
  }

  const providedToken = readHeaderToken(request, "x-ops-token");

  if (!providedToken) {
    sendJson(response, 401, {
      ok: false,
      error: "x-ops-token header is required",
    });
    return false;
  }

  if (providedToken !== expectedToken.trim()) {
    sendJson(response, 403, {
      ok: false,
      error: "invalid ops api token",
    });
    return false;
  }

  return true;
}