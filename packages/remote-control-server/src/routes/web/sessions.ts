import { error as logError } from "../../logger";
import { Hono } from "hono";
import { uuidAuth } from "../../auth/middleware";
import { getSession, isSessionClosedStatus } from "../../services/session";
import { createSSEStream } from "../../transport/sse-writer";
import { sessionRuntimeFacade } from "../../services/session-runtime-facade";

const app = new Hono();

/** POST /web/sessions — Create a session from web UI */
app.post("/sessions", uuidAuth, async (c) => {
  const uuid = c.get("uuid")!;
  const body = await c.req.json();
  if (body.environment_id) {
    try {
      const session = await sessionRuntimeFacade.createSession({
        ownerUuid: uuid,
        environmentId: body.environment_id || null,
        title: body.title || "New Session",
        permissionMode: body.permission_mode || "default",
      });
      return c.json(session, 200);
    } catch (err) {
      logError(`[RCS] Failed to create work item: ${(err as Error).message}`);
      return c.json(
        { error: { type: "internal_error", message: "Failed to create session work item" } },
        500,
      );
    }
  }
  const session = await sessionRuntimeFacade.createSession({
    ownerUuid: uuid,
    title: body.title || "New Session",
    permissionMode: body.permission_mode || "default",
  });
  return c.json(session, 200);
});

/** GET /web/sessions — List sessions owned by the requesting UUID */
app.get("/sessions", uuidAuth, async (c) => {
  const uuid = c.get("uuid")!;
  const sessions = sessionRuntimeFacade.listSessions(uuid);
  return c.json(sessions, 200);
});

/** GET /web/sessions/all — List sessions owned by the requesting UUID (unowned sessions excluded) */
app.get("/sessions/all", uuidAuth, async (c) => {
  const uuid = c.get("uuid")!;
  const sessions = sessionRuntimeFacade.listSessionSummaries(uuid);
  return c.json(sessions, 200);
});

/** GET /web/sessions/:id — Session detail */
app.get("/sessions/:id", uuidAuth, async (c) => {
  const uuid = c.get("uuid")!;
  const details = sessionRuntimeFacade.getSessionDetails(uuid, c.req.param("id")!);
  if (!details) {
    return c.json({ error: { type: "forbidden", message: "Not your session" } }, 403);
  }
  return c.json(details, 200);
});

/** GET /web/sessions/:id/history — Historical events for session */
app.get("/sessions/:id/history", uuidAuth, async (c) => {
  const uuid = c.get("uuid")!;
  const history = sessionRuntimeFacade.getSessionHistory(uuid, c.req.param("id")!);
  if (!history) {
    return c.json({ error: { type: "forbidden", message: "Not your session" } }, 403);
  }
  return c.json({ events: history.events }, 200);
});

/** SSE /web/sessions/:id/events — Real-time event stream */
app.get("/sessions/:id/events", uuidAuth, async (c) => {
  const uuid = c.get("uuid")!;
  const subscription = sessionRuntimeFacade.subscribeEvents(uuid, c.req.param("id")!);
  if (!subscription) {
    return c.json({ error: { type: "forbidden", message: "Not your session" } }, 403);
  }
  const { sessionId } = subscription;
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ error: { type: "not_found", message: "Session not found" } }, 404);
  }
  if (isSessionClosedStatus(session.status)) {
    return c.json({ error: { type: "session_closed", message: `Session is ${session.status}` } }, 409);
  }

  const lastEventId = c.req.header("Last-Event-ID");
  const fromSeqNum = lastEventId ? parseInt(lastEventId) : 0;
  return createSSEStream(c, sessionId, fromSeqNum);
});

export default app;
