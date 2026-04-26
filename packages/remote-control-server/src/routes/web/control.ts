import { log } from "../../logger";
import { Hono } from "hono";
import { uuidAuth } from "../../auth/middleware";
import { sessionRuntimeFacade } from "../../services/session-runtime-facade";

const app = new Hono();

function closedSessionResponse(message: string) {
  return { error: { type: "session_closed", message } };
}

/** POST /web/sessions/:id/events — Send user message to session */
app.post("/sessions/:id/events", uuidAuth, async (c) => {
  const requestedSessionId = c.req.param("id")!;
  const ownerUuid = c.get("uuid")!;
  const body = await c.req.json();
  const result = sessionRuntimeFacade.sendInput(ownerUuid, requestedSessionId, body);
  if (result.kind === "forbidden") {
    return c.json({ error: { type: "forbidden", message: "Not your session" } }, 403);
  }
  if (result.kind === "not_found") {
    return c.json({ error: { type: "not_found", message: "Session not found" } }, 404);
  }
  if (result.kind === "session_closed") {
    return c.json(closedSessionResponse(`Session is ${result.status}`), 409);
  }
  const eventType = body.type || "user";
  log(
    `[RC-DEBUG] web -> server: POST /web/sessions/${result.sessionId}/events type=${eventType} content=${JSON.stringify(body).slice(0, 200)}`,
  );
  return c.json({ status: "ok", event: result.event }, 200);
});

/** POST /web/sessions/:id/control — Send control request (permission approval etc) */
app.post("/sessions/:id/control", uuidAuth, async (c) => {
  const requestedSessionId = c.req.param("id")!;
  const ownerUuid = c.get("uuid")!;
  const body = await c.req.json();
  const result = sessionRuntimeFacade.sendControl(ownerUuid, requestedSessionId, body);
  if (result.kind === "forbidden") {
    return c.json({ error: { type: "forbidden", message: "Not your session" } }, 403);
  }
  if (result.kind === "not_found") {
    return c.json({ error: { type: "not_found", message: "Session not found" } }, 404);
  }
  if (result.kind === "session_closed") {
    return c.json(closedSessionResponse(`Session is ${result.status}`), 409);
  }
  return c.json({ status: "ok", event: result.event }, 200);
});

/** POST /web/sessions/:id/interrupt — Interrupt session */
app.post("/sessions/:id/interrupt", uuidAuth, async (c) => {
  const requestedSessionId = c.req.param("id")!;
  const ownerUuid = c.get("uuid")!;
  const result = sessionRuntimeFacade.interrupt(ownerUuid, requestedSessionId);
  if (result.kind === "forbidden") {
    return c.json({ error: { type: "forbidden", message: "Not your session" } }, 403);
  }
  if (result.kind === "not_found") {
    return c.json({ error: { type: "not_found", message: "Session not found" } }, 404);
  }
  if (result.kind === "session_closed") {
    return c.json(closedSessionResponse(`Session is ${result.status}`), 409);
  }
  return c.json({ status: "ok" }, 200);
});

export default app;
