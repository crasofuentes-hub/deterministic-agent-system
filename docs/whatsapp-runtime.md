# WhatsApp Runtime

## Estado actual

La línea WhatsApp del proyecto ya soporta:

- webhook real montado en el servidor HTTP
- verificación GET /webhooks/whatsapp
- recepción POST /webhooks/whatsapp
- normalización inbound a CustomerMessage
- bridge hacia customer-service-agent
- respuesta canónica
- payload outbound para WhatsApp
- delivery configurable: skipped, mock, http
- store configurable: memory, sqlite
- persistencia de sesión
- idempotencia por channelMessageId

---

## Variables de entorno

- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_DELIVERY_MODE = skipped | mock | http
- WHATSAPP_API_VERSION
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_STORE_MODE = memory | sqlite
- WHATSAPP_SQLITE_PATH
- WHATSAPP_BUSINESS_CONTEXT_ID
- WHATSAPP_SESSION_ID_PREFIX

---

## Ejemplo local con SQLite

PowerShell:
$env:WHATSAPP_VERIFY_TOKEN = "verify-token-001"
$env:WHATSAPP_DELIVERY_MODE = "skipped"
$env:WHATSAPP_STORE_MODE = "sqlite"
$env:WHATSAPP_SQLITE_PATH = "C:\repos\deterministic-agent-system\.runtime-data\whatsapp-runtime.sqlite"
$env:WHATSAPP_BUSINESS_CONTEXT_ID = "customer-service-core-v2"
$env:WHATSAPP_SESSION_ID_PREFIX = "whatsapp-session"
node .\dist\src\index.js serve

---

## Verificación del webhook

GET:
/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token-001&hub.challenge=abc123

Resultado esperado:
- status 200
- body abc123

---

## Prueba operativa recomendada

Flujo validado:
1. iniciar servidor con WHATSAPP_STORE_MODE=sqlite
2. enviar un primer mensaje que deje la conversación en missing-entity
3. reiniciar el servidor
4. enviar un segundo mensaje que complete la entidad faltante
5. reenviar exactamente el mismo segundo mensaje

Resultado esperado:
- la sesión sobrevive al reinicio
- el segundo mensaje resuelve correctamente
- el replay del mismo channelMessageId se marca como duplicado

---

## Nota sobre SQLite

La implementación actual usa node:sqlite.
Node sigue mostrando un warning experimental, así que esta capa ya es funcional para persistencia local, pero todavía conviene tratarla como dependiente de una API experimental.

---

## Recomendación operativa

- Para trabajo local serio: usar WHATSAPP_STORE_MODE=sqlite
- Para pruebas sin red: usar WHATSAPP_DELIVERY_MODE=skipped o mock
- Para integración real: usar WHATSAPP_DELIVERY_MODE=http con credenciales reales