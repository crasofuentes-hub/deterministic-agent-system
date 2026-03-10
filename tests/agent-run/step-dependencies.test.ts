import { describe, expect, it } from "vitest";
import type { AgentStep } from "../../src/agent/plan-types";
import {
  analyzeStepDependencies,
  bindStepInputRef,
  collectStepDependencyRefs,
  makeStepStateRef,
  validateStepDependencies,
} from "../../src/agent-run/step-dependencies";

describe("step-dependencies", () => {
  it("collects refs from nested tool input", () => {
    const refs = collectStepDependencyRefs({
      text: { $ref: "state.values.normalizedJson.text" },
      meta: {
        left: { __valueFromState: "selected.value" },
      },
    });

    expect(refs).toEqual([
      {
        refKind: "$ref",
        refExpr: "state.values.normalizedJson.text",
        outputKey: "normalizedJson",
        nestedPath: "text",
      },
      {
        refKind: "__valueFromState",
        refExpr: "selected.value",
        outputKey: "selected",
        nestedPath: "value",
      },
    ]);
  });

  it("creates canonical state ref", () => {
    expect(makeStepStateRef("normalizedJson", "text")).toEqual({
      $ref: "state.values.normalizedJson.text",
    });
  });

  it("binds raw value when producer is not yet present", () => {
    expect(
      bindStepInputRef({
        steps: [],
        outputKey: "normalizedJson",
        nestedPath: "text",
        fallbackValue: "raw-json",
      })
    ).toBe("raw-json");
  });

  it("binds ref when producer already exists", () => {
    const steps: AgentStep[] = [
      {
        id: "a",
        kind: "tool.call",
        toolId: "tool.normalize",
        input: { text: "x" },
        outputKey: "normalizedJson",
      },
    ];

    expect(
      bindStepInputRef({
        steps,
        outputKey: "normalizedJson",
        nestedPath: "text",
        fallbackValue: "raw-json",
      })
    ).toEqual({
      $ref: "state.values.normalizedJson.text",
    });
  });

  it("analyzes producer and consumer edges deterministically", () => {
    const steps: AgentStep[] = [
      {
        id: "a",
        kind: "tool.call",
        toolId: "tool.normalize",
        input: { text: "x" },
        outputKey: "normalizedJson",
      },
      {
        id: "b",
        kind: "tool.call",
        toolId: "tool.extract",
        input: { text: { $ref: "state.values.normalizedJson.text" } },
        outputKey: "extractedUser",
      },
      {
        id: "c",
        kind: "tool.call",
        toolId: "tool.select",
        input: { text: { $ref: "state.values.extractedUser.value" } },
        outputKey: "selected",
      },
    ];

    expect(analyzeStepDependencies(steps)).toEqual({
      producedOutputKeys: ["normalizedJson", "extractedUser", "selected"],
      edges: [
        {
          consumerStepId: "b",
          consumerStepIndex: 1,
          producerOutputKey: "normalizedJson",
          producerStepId: "a",
          producerStepIndex: 0,
          refKind: "$ref",
          refExpr: "state.values.normalizedJson.text",
          nestedPath: "text",
        },
        {
          consumerStepId: "c",
          consumerStepIndex: 2,
          producerOutputKey: "extractedUser",
          producerStepId: "b",
          producerStepIndex: 1,
          refKind: "$ref",
          refExpr: "state.values.extractedUser.value",
          nestedPath: "value",
        },
      ],
    });
  });

  it("accepts producer before consumer", () => {
    const steps: AgentStep[] = [
      {
        id: "a",
        kind: "tool.call",
        toolId: "tool.normalize",
        input: { text: "x" },
        outputKey: "normalizedJson",
      },
      {
        id: "b",
        kind: "tool.call",
        toolId: "tool.extract",
        input: { text: { $ref: "state.values.normalizedJson.text" } },
        outputKey: "extractedUser",
      },
    ];

    expect(validateStepDependencies(steps)).toEqual({ ok: true });
  });

  it("rejects missing producer", () => {
    const steps: AgentStep[] = [
      {
        id: "b",
        kind: "tool.call",
        toolId: "tool.extract",
        input: { text: { $ref: "state.values.normalizedJson.text" } },
        outputKey: "extractedUser",
      },
    ];

    expect(validateStepDependencies(steps)).toEqual({
      ok: false,
      code: "STEP_DEPENDENCY_PRODUCER_NOT_FOUND",
      message:
        'step "b" references missing outputKey "normalizedJson" via $ref = "state.values.normalizedJson.text"',
    });
  });

  it("rejects out-of-order dependency", () => {
    const steps: AgentStep[] = [
      {
        id: "b",
        kind: "tool.call",
        toolId: "tool.extract",
        input: { text: { $ref: "state.values.normalizedJson.text" } },
        outputKey: "extractedUser",
      },
      {
        id: "a",
        kind: "tool.call",
        toolId: "tool.normalize",
        input: { text: "x" },
        outputKey: "normalizedJson",
      },
    ];

    expect(validateStepDependencies(steps)).toEqual({
      ok: false,
      code: "STEP_DEPENDENCY_OUT_OF_ORDER",
      message:
        'step "b" references outputKey "normalizedJson" before it is produced',
    });
  });

  it("rejects duplicate outputKey", () => {
    const steps: AgentStep[] = [
      {
        id: "a",
        kind: "tool.call",
        toolId: "tool.normalize",
        input: { text: "x" },
        outputKey: "normalizedJson",
      },
      {
        id: "b",
        kind: "tool.call",
        toolId: "tool.normalize-again",
        input: { text: "y" },
        outputKey: "normalizedJson",
      },
    ];

    expect(validateStepDependencies(steps)).toEqual({
      ok: false,
      code: "DUPLICATE_STEP_OUTPUT_KEY",
      message:
        'outputKey "normalizedJson" is produced more than once (step indices 0 and 1)',
    });
  });
});