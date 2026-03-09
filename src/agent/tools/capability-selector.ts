import type { ToolCapability, ToolId } from "./types";
import { AGENT_TOOL_DEFS } from "./catalog";

export function resolveToolIdForCapability(capability: ToolCapability): ToolId {
  const matches = AGENT_TOOL_DEFS
    .filter((tool) => tool.meta.capabilities.includes(capability))
    .map((tool) => tool.id)
    .sort();

  const selected = matches[0];
  if (typeof selected !== "string") {
    throw new Error("tool_capability_not_found: " + capability);
  }

  return selected;
}

export function listToolIdsForCapability(capability: ToolCapability): ToolId[] {
  return AGENT_TOOL_DEFS
    .filter((tool) => tool.meta.capabilities.includes(capability))
    .map((tool) => tool.id)
    .sort();
}