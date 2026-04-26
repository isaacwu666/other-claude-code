import { createWorkItem } from "./work-dispatch";
import {
  createSession,
  getSession,
  isSessionClosedStatus,
  listWebSessionSummariesByOwnerUuid,
  listWebSessionsByOwnerUuid,
  resolveOwnedWebSessionId,
  toWebSessionResponse,
  touchSession,
  updateSessionStatus,
} from "./session";
import { storeBindSession, storeGetSessionWorker } from "../store";
import { getAutomationStateSnapshot } from "./automationState";
import { getEventBus } from "../transport/event-bus";
import { publishSessionEvent } from "./transport";

export type RuntimeSessionState = {
  sessionId: string;
  status: string;
  environmentId: string | null;
  title: string | null;
  automationState?: unknown;
};

export class SessionRuntimeFacade {
  async createSession(args: {
    ownerUuid: string;
    environmentId?: string | null;
    title?: string;
    permissionMode?: string;
  }) {
    const session = createSession({
      environment_id: args.environmentId ?? null,
      title: args.title || "New Session",
      source: "web",
      permission_mode: args.permissionMode || "default",
    });

    storeBindSession(session.id, args.ownerUuid);

    if (args.environmentId) {
      await createWorkItem(args.environmentId, session.id);
    }

    return session;
  }

  listSessions(ownerUuid: string) {
    return listWebSessionsByOwnerUuid(ownerUuid);
  }

  listSessionSummaries(ownerUuid: string) {
    return listWebSessionSummariesByOwnerUuid(ownerUuid);
  }

  resolveOwnedSession(ownerUuid: string, sessionId: string) {
    return resolveOwnedWebSessionId(sessionId, ownerUuid);
  }

  getSessionState(ownerUuid: string, sessionId: string): RuntimeSessionState | null {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return null;
    const session = getSession(resolved);
    if (!session) return null;
    const worker = storeGetSessionWorker(resolved);
    const automationState = getAutomationStateSnapshot(worker?.externalMetadata);
    return {
      sessionId: resolved,
      status: session.status,
      environmentId: session.environment_id,
      title: session.title,
      ...(automationState !== undefined ? { automationState } : {}),
    };
  }

  getSessionDetails(ownerUuid: string, sessionId: string) {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return null;
    const session = getSession(resolved);
    if (!session) return null;
    const worker = storeGetSessionWorker(resolved);
    const automationState = getAutomationStateSnapshot(worker?.externalMetadata);
    const response = toWebSessionResponse(session);
    if (automationState === undefined) return response;
    return { ...response, automation_state: automationState };
  }

  getSessionHistory(ownerUuid: string, sessionId: string) {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return null;
    const session = getSession(resolved);
    if (!session) return null;
    const bus = getEventBus(resolved);
    return { sessionId: resolved, events: bus.getEventsSince(0) };
  }

  sendInput(ownerUuid: string, sessionId: string, payload: Record<string, unknown>) {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return { kind: "forbidden" as const };
    const session = getSession(resolved);
    if (!session) return { kind: "not_found" as const };
    if (isSessionClosedStatus(session.status)) {
      return { kind: "session_closed" as const, status: session.status };
    }
    const event = publishSessionEvent(
      resolved,
      (payload.type as string) || "user",
      payload,
      "outbound",
    );
    return { kind: "ok" as const, event, sessionId: resolved };
  }

  sendControl(ownerUuid: string, sessionId: string, payload: Record<string, unknown>) {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return { kind: "forbidden" as const };
    const session = getSession(resolved);
    if (!session) return { kind: "not_found" as const };
    if (isSessionClosedStatus(session.status)) {
      return { kind: "session_closed" as const, status: session.status };
    }
    const event = publishSessionEvent(
      resolved,
      (payload.type as string) || "control_request",
      payload,
      "outbound",
    );
    return { kind: "ok" as const, event, sessionId: resolved };
  }

  interrupt(ownerUuid: string, sessionId: string) {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return { kind: "forbidden" as const };
    const session = getSession(resolved);
    if (!session) return { kind: "not_found" as const };
    if (isSessionClosedStatus(session.status)) {
      return { kind: "session_closed" as const, status: session.status };
    }
    publishSessionEvent(resolved, "interrupt", { action: "interrupt" }, "outbound");
    updateSessionStatus(resolved, "idle");
    return { kind: "ok" as const, sessionId: resolved };
  }

  subscribeEvents(ownerUuid: string, sessionId: string) {
    const resolved = this.resolveOwnedSession(ownerUuid, sessionId);
    if (!resolved) return null;
    const session = getSession(resolved);
    if (!session || isSessionClosedStatus(session.status)) return null;
    touchSession(resolved);
    return { sessionId: resolved };
  }
}

export const sessionRuntimeFacade = new SessionRuntimeFacade();

