import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { SandboxFactory, SandboxOptions, SandboxResult, SandboxSession } from "./sandbox-utils";

function ok<T>(value: T): SandboxResult<T> {
  return { ok: true, value };
}

function fail(
  code: "TIMEOUT" | "NETWORK_ERROR" | "AUTH_FAILED" | "OVERLOADED" | "PARSE_FAILED" | "INVALID_REQUEST",
  message: string,
  retryable: boolean
): SandboxResult<never> {
  return { ok: false, error: { code, message, retryable } };
}

function debugLog(sessionId: string, msg: string, extra?: Record<string, unknown>): void {
  if (sessionId.includes("sess") || sessionId.includes("demo")) {
    const payload = { ts: new Date().toISOString(), subsystem: "sandbox", sessionId, msg, ...(extra ?? {}) };
    console.log(JSON.stringify(payload));
  }
}

function mapError(err: unknown): SandboxResult<never> {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(msg)) return fail("TIMEOUT", msg, true);
  if (/net::|network/i.test(msg)) return fail("NETWORK_ERROR", msg, true);
  if (/auth|unauthorized|forbidden/i.test(msg)) return fail("AUTH_FAILED", msg, false);
  return fail("OVERLOADED", msg, true);
}

export interface PlaywrightSandboxConfig {
  headless?: boolean;
}

type SessionRuntime = {
  context: BrowserContext;
  page: Page;
};

export class PlaywrightSandbox implements SandboxFactory {
  private browser: Browser | undefined;
  private readonly sessions = new Map<string, SessionRuntime>();
  private readonly config: PlaywrightSandboxConfig;

  constructor(config: PlaywrightSandboxConfig = {}) {
    this.config = config;
  }

  private async ensureBrowser(options: SandboxOptions): Promise<Browser> {
    if (this.browser) return this.browser;

    this.browser = await chromium.launch({
      headless: this.config.headless !== false,
      proxy: options.proxy ? { server: options.proxy.server } : undefined,
    });

    return this.browser;
  }

  private async getOrCreateSession(sessionId: string, options: SandboxOptions): Promise<SessionRuntime> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const browser = await this.ensureBrowser(options);
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);

    const rt: SessionRuntime = { context, page };
    this.sessions.set(sessionId, rt);
    return rt;
  }

  create(options: SandboxOptions): SandboxSession {
    const sessionId = options.sessionId;

    return {
      open: async (url: string) => {
        try {
          const rt = await this.getOrCreateSession(sessionId, options);
          await rt.page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
          const finalUrl = rt.page.url();
          const title = await rt.page.title();
          debugLog(sessionId, "open.done", { requestedUrl: url, finalUrl, title });
          return ok({ url });
        } catch (err) {
          return mapError(err);
        }
      },

      click: async (selector: string) => {
        try {
          const rt = await this.getOrCreateSession(sessionId, options);
          await rt.page.click(selector);
          return ok({ selector });
        } catch (err) {
          return mapError(err);
        }
      },

      type: async (selector: string, text: string) => {
        try {
          const rt = await this.getOrCreateSession(sessionId, options);
          await rt.page.fill(selector, text);
          return ok({ selector, textLen: text.length });
        } catch (err) {
          return mapError(err);
        }
      },

      extract: async (selector: string) => {
        try {
          const rt = await this.getOrCreateSession(sessionId, options);
          debugLog(sessionId, "extract.start", { selector, url: rt.page.url(), title: await rt.page.title() });
          await rt.page.waitForSelector(selector, { timeout: 15000, state: "attached" });
          const text = await rt.page.textContent(selector);
          if (text === null) {
            return fail("PARSE_FAILED", "Selector returned null textContent: " + selector, false);
          }
          return ok({ selector, text });
        } catch (err) {
          return mapError(err);
        }
      },

      close: async () => {
        const rt = this.sessions.get(sessionId);
        if (rt) {
          this.sessions.delete(sessionId);
          try { await rt.page.close(); } catch { /* ignore */ }
          try { await rt.context.close(); } catch { /* ignore */ }
        }
      },
    };
  }

  async shutdown(): Promise<void> {
    for (const rt of this.sessions.values()) {
      try { await rt.page.close(); } catch { /* ignore */ }
      try { await rt.context.close(); } catch { /* ignore */ }
    }
    this.sessions.clear();

    if (this.browser) {
      try { await this.browser.close(); } catch { /* ignore */ }
      this.browser = undefined;
    }
  }
}


