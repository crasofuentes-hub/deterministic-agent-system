import fs from "node:fs";
import path from "node:path";

export interface KnowledgeBaseRecord {
  topicId: string;
  productName: string;
  summary: string;
}

function normalizeText(value: string): string {
  return String(value).normalize("NFC").trim().toLowerCase();
}

function loadKnowledgeBase(): KnowledgeBaseRecord[] {
  const filePath = path.resolve(process.cwd(), "data/knowledge-base.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as KnowledgeBaseRecord[];
}

export function listKnowledgeBaseRecords(): KnowledgeBaseRecord[] {
  return loadKnowledgeBase();
}

export function findKnowledgeByProductName(productName: string): KnowledgeBaseRecord | undefined {
  const normalizedTarget = normalizeText(productName);

  return loadKnowledgeBase().find(
    (record) => normalizeText(record.productName) === normalizedTarget
  );
}