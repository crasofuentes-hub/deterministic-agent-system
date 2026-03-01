export type SandboxErrorCode =
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "AUTH_FAILED"
  | "OVERLOADED"
  | "PARSE_FAILED"
  | "INVALID_REQUEST";

export interface SandboxError {
  code: SandboxErrorCode;
  message: string;
  retryable: boolean;
}

export type SandboxResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SandboxError };

export interface SandboxOptions {
  sessionId: string;
  proxy?: { server: string };
  auth?: { username: string; password: string };
  traceId?: string;
}

export interface SandboxSession {
  open(url: string): Promise<SandboxResult<{ url: string }>>;
  click(selector: string): Promise<SandboxResult<{ selector: string }>>;
  type(selector: string, text: string): Promise<SandboxResult<{ selector: string; textLen: number }>>;
  extract(selector: string): Promise<SandboxResult<{ selector: string; text: string }>>;
  close(): Promise<void>;
}

export interface SandboxFactory {
  create(options: SandboxOptions): SandboxSession;
}

type OpenStep = { op: "open"; url: string; result: SandboxResult<{ url: string }> };
type ClickStep = { op: "click"; selector: string; result: SandboxResult<{ selector: string }> };
type TypeStep = {
  op: "type";
  selector: string;
  text: string;
  result: SandboxResult<{ selector: string; textLen: number }>;
};
type ExtractStep = { op: "extract"; selector: string; result: SandboxResult<{ selector: string; text: string }> };

type Step = OpenStep | ClickStep | TypeStep | ExtractStep;

function invalid(message: string): SandboxResult<never> {
  return { ok: false, error: { code: "INVALID_REQUEST", message, retryable: false } };
}

function isOpenStep(step: Step | undefined): step is OpenStep {
  return !!step && step.op === "open";
}
function isClickStep(step: Step | undefined): step is ClickStep {
  return !!step && step.op === "click";
}
function isTypeStep(step: Step | undefined): step is TypeStep {
  return !!step && step.op === "type";
}
function isExtractStep(step: Step | undefined): step is ExtractStep {
  return !!step && step.op === "extract";
}

export class MockSandbox implements SandboxFactory {
  private readonly scripts = new Map<string, Step[]>();

  setScript(sessionId: string, steps: Step[]): void {
    this.scripts.set(sessionId, steps.map((s) => ({ ...s })));
  }

  create(options: SandboxOptions): SandboxSession {
    const sessionId = options.sessionId;
    const steps = this.scripts.get(sessionId) ?? [];
    let cursor = 0;
    let closed = false;

    const next = (): Step | undefined => {
      if (closed) return undefined;
      const s = steps[cursor];
      cursor += 1;
      return s;
    };

    return {
      async open(url: string) {
        const step = next();
        if (!isOpenStep(step)) return invalid(`MockSandbox script mismatch: expected open(${url})`);
        if (step.url !== url) return invalid(`MockSandbox open url mismatch: expected ${step.url} got ${url}`);
        return step.result;
      },

      async click(selector: string) {
        const step = next();
        if (!isClickStep(step)) return invalid(`MockSandbox script mismatch: expected click(${selector})`);
        if (step.selector !== selector) {
          return invalid(`MockSandbox click selector mismatch: expected ${step.selector} got ${selector}`);
        }
        return step.result;
      },

      async type(selector: string, text: string) {
        const step = next();
        if (!isTypeStep(step)) return invalid(`MockSandbox script mismatch: expected type(${selector})`);
        if (step.selector !== selector) {
          return invalid(`MockSandbox type selector mismatch: expected ${step.selector} got ${selector}`);
        }
        if (step.text !== text) return invalid(`MockSandbox type text mismatch`);
        return step.result;
      },

      async extract(selector: string) {
        const step = next();
        if (!isExtractStep(step)) return invalid(`MockSandbox script mismatch: expected extract(${selector})`);
        if (step.selector !== selector) {
          return invalid(`MockSandbox extract selector mismatch: expected ${step.selector} got ${selector}`);
        }
        return step.result;
      },

      async close() {
        closed = true;
      },
    };
  }
}
