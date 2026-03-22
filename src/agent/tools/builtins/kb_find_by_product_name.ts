import { findKnowledgeByProductName } from "../../../data-layer/knowledge-base-repository";
import type { Tool } from "../types";

type KbFindIn = Readonly<{
  productName: string;
}>;

type KbFindOut = Readonly<{
  found: boolean;
  record: null | {
    topicId: string;
    productName: string;
    summary: string;
  };
}>;

export const toolKbFindByProductName: Tool<KbFindIn, KbFindOut> = {
  id: "kb/find-by-product-name",
  version: 1,
  meta: {
    pluginId: "builtin.kb-find-by-product-name",
    pluginVersion: 1,
    displayName: "Knowledge Base Find By Product Name",
    description: "Finds product knowledge by exact normalized product name.",
    capabilities: ["kb.find-by-product-name"],
    inputSchemaHint: {
      type: "object",
      required: ["productName"]
    }
  },
  validateInput: (x: unknown): x is KbFindIn => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.productName === "string";
  },
  run: (_ctx, input) => {
    const productName = String(input.productName).normalize("NFC").trim();
    const record = findKnowledgeByProductName(productName);

    if (!record) {
      return {
        found: false,
        record: null,
      };
    }

    return {
      found: true,
      record: {
        topicId: record.topicId,
        productName: record.productName,
        summary: record.summary,
      },
    };
  },
} as const;