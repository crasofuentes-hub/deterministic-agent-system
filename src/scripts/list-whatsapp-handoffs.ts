import { createSqliteWhatsAppStore } from "../channels/whatsapp/store-sqlite";

function readTrimmedNonEmpty(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function main(): void {
  const dbPath = readTrimmedNonEmpty(process.env as Record<string, string | undefined>, "WHATSAPP_SQLITE_PATH");
  if (!dbPath) {
    throw new Error("WHATSAPP_SQLITE_PATH is required");
  }

  const businessContextId =
    readTrimmedNonEmpty(process.env as Record<string, string | undefined>, "WHATSAPP_BUSINESS_CONTEXT_ID") ??
    "customer-service-core-v2";

  const onlyOpen = (readTrimmedNonEmpty(process.env as Record<string, string | undefined>, "WHATSAPP_HANDOFF_STATUS") ??
    "open") === "open";

  const store = createSqliteWhatsAppStore({
    dbPath,
    businessContextId,
  });

  try {
    const all = store.listHandoffs();
    const filtered = onlyOpen ? all.filter((item) => item.status === "open") : all;

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          count: filtered.length,
          items: filtered,
        },
        null,
        2
      ) + "\n"
    );
  } finally {
    store.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message + "\n");
  process.exit(1);
}