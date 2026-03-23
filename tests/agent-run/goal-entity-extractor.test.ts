import { describe, expect, it } from "vitest";
import { extractGoalEntities } from "../../src/agent-run/goal-entity-extractor";

describe("goal-entity-extractor", () => {
  it("extracts productName from price goal", () => {
    expect(extractGoalEntities("What is the price of Wireless Mouse M1?")).toEqual({
      productName: "Wireless Mouse M1",
      orderId: undefined,
    });
  });

  it("extracts orderId from order-status goal", () => {
    expect(extractGoalEntities("What is the status of order ORDER-55555?")).toEqual({
      productName: undefined,
      orderId: "ORDER-55555",
    });
  });

  it("extracts productName from stock question", () => {
    expect(extractGoalEntities("Is Keyboard K100 in stock?")).toEqual({
      productName: "Keyboard K100",
      orderId: undefined,
    });
  });
});