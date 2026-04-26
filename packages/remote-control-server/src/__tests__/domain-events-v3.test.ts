import { beforeEach, describe, expect, mock, test } from "bun:test";
import { toDomainEvent } from "../routes/v3/session-domain-events";
import { storeReset } from "../store";
import { getAllEventBuses, removeEventBus, type SessionEvent } from "../transport/event-bus";

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

describe("v3 domain event stream", () => {
  beforeEach(() => {
    storeReset();
    for (const [key] of getAllEventBuses()) {
      removeEventBus(key);
    }
  });

  test("maps raw tool_use to tool.requested", async () => {
    const mapped = toDomainEvent({
      id: "e1",
      sessionId: "session_1",
      type: "tool_use",
      payload: { tool_name: "Bash", tool_input: { command: "echo hi" } },
      direction: "inbound",
      seqNum: 1,
      createdAt: Date.now(),
    } satisfies SessionEvent);

    expect(mapped.type).toBe("tool.requested");
    expect(mapped.payload.tool_name).toBe("Bash");
  });
});

