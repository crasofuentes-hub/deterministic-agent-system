# Async Postgres WhatsApp local smoke

This smoke verifies the real async WhatsApp runtime path with Postgres-backed persistence.

It exercises:

```text
server.ts
-> WHATSAPP_RUNTIME_MODE=async
-> WHATSAPP_STORE_MODE=postgres
-> resolveAsyncWhatsAppRuntime(...)
-> createPostgresPool(...)
-> applyPostgresMigrations(...)
-> createPostgresWhatsAppStore(...)
-> routeRequest(...)
-> handleAsyncWhatsAppWebhook(...)
-> whatsapp_conversation_evidence persisted in Postgres
```

## Prerequisites

- Node.js 18 or newer.
- npm dependencies installed.
- A reachable Postgres database.
- `DATABASE_URL` pointing at that database.

Example using Docker:

```powershell
docker run --name deterministic-agent-postgres `
  -e POSTGRES_USER=det_agent `
  -e POSTGRES_PASSWORD=det_agent `
  -e POSTGRES_DB=deterministic_agent_system `
  -p 5432:5432 `
  -d postgres:16
```

Then set:

```powershell
$env:DATABASE_URL = "postgres://det_agent:det_agent@localhost:5432/deterministic_agent_system"
```

## Run the smoke

```powershell
Set-Location "C:\repos\deterministic-agent-system"
npm run smoke:whatsapp:postgres
```

The smoke builds the project, starts the local server with:

```env
WHATSAPP_VERIFY_TOKEN=local-smoke-token
WHATSAPP_RUNTIME_MODE=async
WHATSAPP_STORE_MODE=postgres
WHATSAPP_DELIVERY_MODE=skipped
```

It then:

1. Verifies the WhatsApp GET challenge endpoint.
2. Sends a WhatsApp POST webhook for `Coverage details for POL-AUTO-1001`.
3. Confirms the deterministic coverage response.
4. Queries Postgres directly and verifies persisted evidence in `whatsapp_conversation_evidence`.
5. Closes the local server cleanly.

Expected result:

```text
ASYNC POSTGRES WHATSAPP SMOKE PASSED
```

## Notes

- Delivery mode is `skipped`, so no external WhatsApp message is sent.
- Migrations are applied automatically by the async runtime path.
- Re-running the smoke is safe. It uses a unique webhook message id per run.