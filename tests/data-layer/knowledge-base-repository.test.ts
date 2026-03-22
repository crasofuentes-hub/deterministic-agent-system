import { describe, expect, it } from "vitest";
import {
  findKnowledgeByProductName,
  listKnowledgeBaseRecords,
} from "../../src/data-layer/knowledge-base-repository";

describe("knowledge-base-repository", () => {
  it("loads knowledge base deterministically", () => {
    expect(listKnowledgeBaseRecords()).toHaveLength(3);
  });

  it("finds knowledge by product name deterministically", () => {
    expect(findKnowledgeByProductName("Laptop X Pro")).toEqual({
      topicId: "product-laptop-x-pro",
      productName: "Laptop X Pro",
      summary: "Laptop X Pro is a high-performance laptop for productivity and advanced workloads."
    });
  });
});