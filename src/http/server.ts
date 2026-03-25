import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolveWhatsAppRuntime, type WhatsAppRuntimeConfig } from "../channels/whatsapp/runtime";
import { createInMemoryWhatsAppStore } from "../channels/whatsapp/store";
import type { WhatsAppStore } from "../channels/whatsapp/store";
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

function tryResolveWhatsAppRuntime():
  | { whatsappRuntime: WhatsAppRuntimeConfig; whatsappStore: WhatsAppStore }
  | undefined {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (typeof verifyToken !== "string" || verifyToken.trim().length === 0) {
    return undefined;
  }

  const whatsappRuntime = resolveWhatsAppRuntime({
    env: process.env as Record<string, string | undefined>,
    fetchImpl: async (input, init) => {
      const response = await fetch(input, init);

      return {
        ok: response.ok,
        status: response.status,
        json: async () => (await response.json()) as unknown,
      };
    },
  });

  const whatsappStore = createInMemoryWhatsAppStore({
    businessContextId: "customer-service-core-v2",
  });

  return {
    whatsappRuntime,
    whatsappStore,
  };
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const host = options.host ?? "127.0.0.1";
  const port = typeof options.port === "number" ? options.port : 3000;

  const whatsapp = tryResolveWhatsAppRuntime();

  const server = createServer((req, res) => {
    void routeRequest(req, res, {
      whatsappRuntime: whatsapp?.whatsappRuntime,
      whatsappStore: whatsapp?.whatsappStore,
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
          resolve();
        });
      });
    },
  };
}
