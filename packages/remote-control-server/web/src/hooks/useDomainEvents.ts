import { useEffect, useState } from "react";
import { getUuid } from "../api/client";

export type DomainEventType =
  | "session.created"
  | "turn.started"
  | "assistant.delta"
  | "tool.requested"
  | "permission.required"
  | "tool.finished"
  | "turn.completed"
  | "session.updated";

export type DomainEvent = {
  id: string;
  session_id: string;
  seq_num: number;
  created_at: string;
  type: DomainEventType;
  payload: Record<string, unknown>;
};

export function useDomainEvents(sessionId: string) {
  const [events, setEvents] = useState<DomainEvent[]>([]);

  useEffect(() => {
    const uuid = getUuid();
    const url = `/web/v3/sessions/${sessionId}/events?uuid=${encodeURIComponent(uuid)}`;
    const source = new EventSource(url);

    source.addEventListener("domain_event", (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as DomainEvent;
        setEvents(prev => {
          if (prev.some(existing => existing.id === event.id)) return prev;
          const next = [...prev, event];
          return next.length > 300 ? next.slice(-300) : next;
        });
      } catch {
        // ignore malformed frames
      }
    });

    source.onerror = () => {
      // rely on native EventSource auto reconnect
    };

    return () => {
      source.close();
    };
  }, [sessionId]);

  return events;
}

