import type { EventStreamSink, StreamEvent, StreamWriteResult } from "./types";

export class MemoryEventStreamSink implements EventStreamSink {
  public readonly sinkId = "memory-stream-v1";
  private readonly eventsStore: StreamEvent[] = [];

  public write(events: StreamEvent[]): StreamWriteResult {
    for (const e of events) {
      this.eventsStore.push({
        seq: Number(e.seq),
        type: e.type,
        data: String(e.data),
      });
    }
    return {
      accepted: true,
      count: events.length,
    };
  }

  public snapshot(): StreamEvent[] {
    return this.eventsStore.map((e) => ({ ...e }));
  }

  public reset(): void {
    this.eventsStore.length = 0;
  }
}
