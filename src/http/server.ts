import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolveWhatsAppRuntime, type WhatsAppRuntimeConfig } from "../channels/whatsapp/runtime";
import {
  resolveAsyncWhatsAppRuntime,
  type AsyncWhatsAppRuntimeConfig,
} from "../channels/whatsapp/runtime-async";
import { routeRequest } from "./routes";

export interface StartServerOptions {
  port?: number;
  host?: string;
}

export interface RunningServer {
  port: number;
  host: string;
  close(): Promise<void>;
}

function readRuntimeMode(): "sync" | "async" {
  const value = process.env.WHATSAPP_RUNTIME_MODE?.trim().toLowerCase();

  if (!value) {
    return "sync";
  }

  if (value === "sync" || value === "async") {
    return value;
  }

  throw new Error("WHATSAPP_RUNTIME_MODE must be one of: sync, async");
}

async function tryResolveWhatsAppRuntimes(): Promise<{
  whatsappRuntime?: WhatsAppRuntimeConfig;
  asyncWhatsAppRuntime?: AsyncWhatsAppRuntimeConfig;
}> {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (typeof verifyToken !== "string" || verifyToken.trim().length === 0) {
    return {};
  }

  const fetchImpl = async (input: string, init?: RequestInit) => {
    const response = await fetch(input, init);

    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    };
  };

  if (readRuntimeMode() === "async") {
    return {
      asyncWhatsAppRuntime: await resolveAsyncWhatsAppRuntime({
        env: process.env as Record<string, string | undefined>,
        fetchImpl,
      }),
    };
  }

  return {
    whatsappRuntime: resolveWhatsAppRuntime({
      env: process.env as Record<string, string | undefined>,
      fetchImpl,
    }),
  };
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const host = options.host ?? "127.0.0.1";
  const port = typeof options.port === "number" ? options.port : 3000;

  const { whatsappRuntime, asyncWhatsAppRuntime } = await tryResolveWhatsAppRuntimes();

  const server = createServer((req, res) => {
    void routeRequest(req, res, {
      whatsappRuntime,
      whatsappStore: whatsappRuntime?.store,
      asyncWhatsAppRuntime,
      asyncWhatsAppStore: asyncWhatsAppRuntime?.store,
    });
  });

  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => {
      server.removeListener("listening", onListening);
      reject(err);
    };

    const onListening = (): void => {
      server.removeListener("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine bound server address");
  }

  const info = address as AddressInfo;

  return {
    port: info.port,
    host,
    close(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) {
            reject(err);
            return;
          }

          if (asyncWhatsAppRuntime) {
            void asyncWhatsAppRuntime.close().then(() => {
              resolve();
            }, reject);
            return;
          }

          if (
            whatsappRuntime?.store &&
            "close" in whatsappRuntime.store &&
            typeof whatsappRuntime.store.close === "function"
          ) {
            whatsappRuntime.store.close();
          }

          resolve();
        });
      });
    },
  };
}
