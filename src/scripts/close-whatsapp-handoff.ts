import { createSqliteWhatsAppStore } from "../channels/whatsapp/store-sqlite";

function readTrimmedNonEmpty(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredArg(name: string, index: number): string {
  const value = process.argv[index];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(name + " is required");
  }

  return value.trim();
}

function main(): void {
  const dbPath = readTrimmedNonEmpty(process.env as Record<string, string | undefined>, "WHATSAPP_SQLITE_PATH");
  if (!dbPath) {
    throw new Error("WHATSAPP_SQLITE_PATH is required");
  }

  const businessContextId =
    readTrimmedNonEmpty(process.env as Record<string, string | undefined>, "WHATSAPP_BUSINESS_CONTEXT_ID") ??
    "customer-service-core-v2";

  const handoffId = readRequiredArg("handoffId", 2);

  const store = createSqliteWhatsAppStore({
    dbPath,
    businessContextId,
  });

  try {
    const existing = store.listHandoffs().find((item) => item.handoffId === handoffId);

    if (!existing) {
      throw new Error("handoff not found: " + handoffId);
    }

    const updated = {
      ...existing,
      status: "closed" as const,
      updatedAtIso: new Date().toISOString(),
    };

    store.saveHandoff(updated);

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          item: updated,
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