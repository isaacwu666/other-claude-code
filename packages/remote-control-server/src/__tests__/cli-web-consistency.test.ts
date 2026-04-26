import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import webSessions from "../routes/web/sessions";
import webControl from "../routes/web/control";
import { storeReset } from "../store";
import { getAllEventBuses, removeEventBus } from "../transport/event-bus";
import { publishSessionEvent } from "../services/transport";

mock.module("../config", () => ({
  config: {
    port: 3000,
    host: "0.0.0.0",
    apiKeys: ["test-api-key"],
    baseUrl: "http://localhost:3000",
    pollTimeout: 1,
    heartbeatInterval: 20,
    jwtExpiresIn: 3600,
    disconnectTimeout: 300,
  },
  getBaseUrl: () => "http://localhost:3000",
}));

function createApp() {
  const app = new Hono();
  app.route("/web", webSessions);
  app.route("/web", webControl);
  return app;
}

describe("cli/web consistency regression", () => {
  let app: Hono;

  beforeEach(() => {
    storeReset();
    for (const [key] of getAllEventBuses()) {
      removeEventBus(key);
    }
    app = createApp();
  });

  test("end-to-end ask -> permission -> tool result flow", async () => {
    const uuid = "regression-user";

    const createRes = await app.request(`/web/sessions?uuid=${uuid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Regression Session" }),
    });
    expect(createRes.status).toBe(200);
    const session = await createRes.json();

    const t0 = Date.now();

    const askRes = await app.request(`/web/sessions/${session.id}/events?uuid=${uuid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        content: "创建前端项目",
      }),
    });
    expect(askRes.status).toBe(200);

    publishSessionEvent(
      session.id,
      "permission_request",
      {
        request_id: "req_1",
        request: {
          subtype: "tool_permission",
          tool_name: "Bash",
          tool_input: { command: "bun create vite" },
        },
      },
      "inbound",
    );
    publishSessionEvent(session.id, "tool_result", { content: "项目创建完成" }, "inbound");

    const historyRes = await app.request(`/web/sessions/${session.id}/history?uuid=${uuid}`);
    expect(historyRes.status).toBe(200);
    const history = await historyRes.json();
    const types = history.events.map((evt: { type: string }) => evt.type);
    expect(types).toContain("user");
    expect(types).toContain("permission_request");
    expect(types).toContain("tool_result");

    const elapsedMs = Date.now() - t0;
    expect(elapsedMs).toBeLessThan(1500);
  });
});

