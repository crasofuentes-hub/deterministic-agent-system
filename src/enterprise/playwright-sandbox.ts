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

export class PlaywrightSandbox implements SandboxFactory {
  private browser: Browser | undefined;
  private readonly contexts = new Map<string, BrowserContext>();
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

  private async getContext(sessionId: string, options: SandboxOptions): Promise<BrowserContext> {
    const existing = this.contexts.get(sessionId);
    if (existing) return existing;

    const browser = await this.ensureBrowser(options);
    const ctx = await browser.newContext();
    this.contexts.set(sessionId, ctx);
    return ctx;
  }

  private async withPage<T>(
    sessionId: string,
    options: SandboxOptions,
    fn: (page: Page) => Promise<T>
  ): Promise<SandboxResult<T>> {
    try {
      const ctx = await this.getContext(sessionId, options);
      const page = await ctx.newPage();
      try {
        const v = await fn(page);
        return ok(v);
      } finally {
        await page.close();
      }
    } catch (err) {
      return mapError(err);
    }
  }

  create(options: SandboxOptions): SandboxSession {
    const sessionId = options.sessionId;

    return {
      open: async (url: string) =>
        this.withPage(sessionId, options, async (page) => {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          return { url };
        }),

      click: async (selector: string) =>
        this.withPage(sessionId, options, async (page) => {
          await page.click(selector);
          return { selector };
        }),

      type: async (selector: string, text: string) =>
        this.withPage(sessionId, options, async (page) => {
          await page.fill(selector, text);
          return { selector, textLen: text.length };
        }),

      extract: async (selector: string) =>
        this.withPage(sessionId, options, async (page) => {
          const text = await page.textContent(selector);
          return { selector, text: text ?? "" };
        }),

      close: async () => {
        const ctx = this.contexts.get(sessionId);
        if (ctx) {
          this.contexts.delete(sessionId);
          await ctx.close();
        }
      },
    };
  }

  async shutdown(): Promise<void> {
    for (const ctx of this.contexts.values()) {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
    this.contexts.clear();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore
      }
      this.browser = undefined;
    }
  }
}
