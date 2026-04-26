import { Hono } from "hono";
import { getSession } from "../../services/session";
import { getEventBus, type SessionEvent } from "../../transport/event-bus";

type DomainEventType =
  | "session.created"
  | "turn.started"
  | "assistant.delta"
  | "tool.requested"
  | "permission.required"
  | "tool.finished"
  | "turn.completed"
  | "session.updated";

type DomainEvent = {
  id: string;
  session_id: string;
  seq_num: number;
  created_at: string;
  type: DomainEventType;
  payload: Record<string, unknown>;
};

const app = new Hono();

export function toDomainEvent(event: SessionEvent): DomainEvent {
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : { value: event.payload };

  switch (event.type) {
    case "session_created":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "session.created",
        payload,
      };
    case "assistant":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "assistant.delta",
        payload,
      };
    case "tool_use":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "tool.requested",
        payload,
      };
    case "permission_request":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "permission.required",
        payload,
      };
    case "tool_result":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "tool.finished",
        payload,
      };
    case "user":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "turn.started",
        payload,
      };
    case "status":
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "turn.completed",
        payload,
      };
    default:
      return {
        id: event.id,
        session_id: event.sessionId,
        seq_num: event.seqNum,
        created_at: new Date(event.createdAt).toISOString(),
        type: "session.updated",
        payload: {
          source_type: event.type,
          ...payload,
        },
      };
  }
}

function createDomainEventStream(sessionId: string, fromSeqNum = 0): Response {
  const bus = getEventBus(sessionId);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      if (fromSeqNum > 0) {
        const missed = bus.getEventsSince(fromSeqNum);
        for (const event of missed) {
          const domainEvent = toDomainEvent(event);
          controller.enqueue(
            encoder.encode(
              `id: ${domainEvent.seq_num}\nevent: domain_event\ndata: ${JSON.stringify(domainEvent)}\n\n`,
            ),
          );
        }
      }

      controller.enqueue(encoder.encode(": keepalive\n\n"));

      const unsub = bus.subscribe(event => {
        try {
          const domainEvent = toDomainEvent(event);
          controller.enqueue(
            encoder.encode(
              `id: ${domainEvent.seq_num}\nevent: domain_event\ndata: ${JSON.stringify(domainEvent)}\n\n`,
            ),
          );
        } catch {
          unsub();
        }
      });

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          unsub();
        }
      }, 15000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

app.get("/sessions/:id/events", c => {
  const sessionId = c.req.param("id")!;
  const session = getSession(sessionId);
  if (!session) {
    return c.json(
      { error: { type: "not_found", message: "Session not found" } },
      404,
    );
  }
  const lastEventId = c.req.header("Last-Event-ID");
  const fromSeq = c.req.query("from_sequence_num");
  const fromSeqNum = fromSeq
    ? parseInt(fromSeq, 10)
    : lastEventId
      ? parseInt(lastEventId, 10)
      : 0;
  return createDomainEventStream(sessionId, fromSeqNum);
});

export default app;

