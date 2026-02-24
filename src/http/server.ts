import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
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

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const host = options.host ?? "127.0.0.1";
  const port = typeof options.port === "number" ? options.port : 3000;

  const server = createServer((req, res) => {
    void routeRequest(req, res);
  });

  // Hardening básico HTTP (Node server-level)
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