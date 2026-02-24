import type {
  VectorStoreAdapter,
  VectorDocument,
  VectorSearchRequest,
  VectorSearchResponse,
  VectorSearchHit
} from "./types";

function score(query: string, content: string): number {
  const q = query.toLowerCase();
  const c = content.toLowerCase();

  let s = 0;
  const tokens = q.split(/\s+/).filter((x) => x.length > 0);
  for (const t of tokens) {
    if (c.includes(t)) {
      s += 100 + t.length;
    }
  }

  s += Math.max(0, 20 - Math.abs(c.length - q.length));
  return s;
}

export class MockVectorStoreAdapter implements VectorStoreAdapter {
  public readonly adapterId = "mock-vector-v1";
  private readonly docs: Map<string, VectorDocument>;

  public constructor(seedDocs?: VectorDocument[]) {
    this.docs = new Map<string, VectorDocument>();
    const defaults: VectorDocument[] = [
      { id: "doc-001", content: "deterministic execution trace replay and auditability" },
      { id: "doc-002", content: "vector search adapter mock for portable integration contracts" },
      { id: "doc-003", content: "streaming events and bounded autonomous behavior" },
    ];

    const initDocs = Array.isArray(seedDocs) && seedDocs.length > 0 ? seedDocs : defaults;
    this.upsert(initDocs);
  }

  public upsert(documents: VectorDocument[]): { inserted: number } {
    let inserted = 0;
    for (const d of documents) {
      const id = String(d.id);
      const content = String(d.content);
      this.docs.set(id, { id, content, metadata: d.metadata });
      inserted += 1;
    }
    return { inserted };
  }

  public search(request: VectorSearchRequest): VectorSearchResponse {
    const query = String(request.query);
    const topK = Math.max(1, Math.floor(Number(request.topK)));

    const hits: VectorSearchHit[] = Array.from(this.docs.values())
      .map((d) => ({
        id: d.id,
        content: d.content,
        score: score(query, d.content),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      })
      .slice(0, topK);

    return {
      hits,
      deterministic: true,
    };
  }
}