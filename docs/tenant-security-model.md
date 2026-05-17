# Tenant Security Model

This document records the current tenant ownership model and the remaining multi-tenancy gaps.

## Current Status

The project now has an explicit tenant ownership foundation for selected agent, journal, and replay paths.

Implemented:

- `TenantContext` foundation.
- `/agent/run` attaches tenant context to agent input.
- Verified planner journal events preserve tenant ownership.
- Replay tenant ownership guard.
- WhatsApp conversation replay rejects cross-tenant access.
- WhatsApp conversation journal reads reject cross-tenant access.

## TenantContext

Tenant context is represented by a validated tenant id.

Current behavior:

- Explicit `tenantId` is accepted when provided.
- Local development can use the controlled fallback tenant id: `local-dev`.
- Invalid tenant ids are rejected deterministically.
- Tenant ids are normalized and constrained to safe characters.

## Protected Paths

### Agent Run

`/agent/run` is tenant-aware.

The handler creates a tenant context and attaches the normalized tenant id to `AgentRunInput`.

### Verified Planner Journal Events

LLM-live verified planner events propagate tenant ownership through:

1. structured planner event,
2. journal mapper,
3. journal append payload.

This ensures verified planner observability can be correlated to tenant ownership.

### Replay Tenant Guard

Replay access can be checked with `checkReplayTenantOwnership(...)`.

The guard rejects:

- events missing tenant ownership,
- events owned by a different tenant.

### WhatsApp Replay

WhatsApp conversation replay validates tenant ownership before returning replay results.

Cross-tenant replay returns `403`.

### WhatsApp Journal Reads

WhatsApp conversation journal reads validate tenant ownership before returning raw journal events.

Cross-tenant journal reads return `403`.

## Remaining Gaps

The following areas are not fully closed yet and must not be represented as production-complete:

1. API authentication is still incomplete.
2. API authorization is not yet role-based.
3. Tenant context is not yet enforced globally across every storage path.
4. Tenant ownership is not yet enforced for all stores and all journal adapters.
5. There is no full organization/user/RBAC model.
6. There is no API key lifecycle model.
7. There is no tenant-scoped rate limiting.
8. There is no tenant-scoped quota or cost budget.
9. There is no tenant-scoped encryption/key management model.
10. Legacy local-dev fixtures still exist for development-only compatibility.

## Required Next Steps

Recommended order:

1. Add authenticated request identity.
2. Bind API keys or sessions to tenant ids.
3. Reject tenant spoofing from request bodies when authenticated identity exists.
4. Enforce tenant ownership at storage adapter boundaries.
5. Add cross-tenant denial tests for storage reads.
6. Add tenant-scoped rate limits.
7. Add tenant-scoped audit metadata to every persisted record.

## Security Position

Current status:

    tenant-aware foundation and selected cross-tenant protections implemented.

Not yet status:

    full production-grade multi-tenant SaaS security.

This distinction is intentional. The current implementation closes major direct journal/replay leakage risks but does not replace authentication, authorization, RBAC, or storage-level tenant isolation.