export type PromptRole = "system" | "user" | "assistant";

export interface PromptMessage {
  readonly role: PromptRole;
  readonly content: string;
}

export interface PromptInputVariable {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface PromptValidationError {
  readonly code: "PROMPT_OUTPUT_INVALID";
  readonly message: string;
  readonly path?: string;
}

export interface PromptValidationSuccess<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

export interface PromptValidationFailure {
  readonly ok: false;
  readonly error: PromptValidationError;
}

export type PromptValidationResult<TValue> =
  | PromptValidationSuccess<TValue>
  | PromptValidationFailure;

export interface VersionedPromptContract<
  TOutput = unknown,
  TInput extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly id: string;
  readonly version: string;
  readonly purpose: string;
  readonly inputVariables: readonly PromptInputVariable[];
  readonly outputSchemaName: string;
  render(input: TInput): readonly PromptMessage[];
  validateOutput(output: unknown): PromptValidationResult<TOutput>;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function failPromptValidation(message: string, path?: string): PromptValidationFailure {
  return {
    ok: false,
    error: {
      code: "PROMPT_OUTPUT_INVALID",
      message,
      ...(typeof path === "string" && path.length > 0 ? { path } : {}),
    },
  };
}

export function passPromptValidation<TValue>(value: TValue): PromptValidationSuccess<TValue> {
  return {
    ok: true,
    value,
  };
}