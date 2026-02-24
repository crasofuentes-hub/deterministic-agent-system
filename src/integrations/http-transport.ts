export interface HttpRequest {
  method: "POST" | "GET";
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

export interface HttpTransport {
  request(req: HttpRequest): Promise<HttpResponse>;
}

function normalizeHeaders(input: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  input.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

export class FetchHttpTransport implements HttpTransport {
  public async request(req: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutMs = typeof req.timeoutMs === "number" && req.timeoutMs > 0 ? req.timeoutMs : 30000;

    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
      });

      const bodyText = await res.text();

      return {
        status: res.status,
        headers: normalizeHeaders(res.headers),
        bodyText,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}