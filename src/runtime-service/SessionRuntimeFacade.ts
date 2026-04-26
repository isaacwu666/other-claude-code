import { QueryEngine, type QueryEngineConfig } from "src/QueryEngine.js";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs";

/**
 * SessionRuntimeFacade decouples callers from QueryEngine internals.
 * It provides a stable session runtime contract for CLI/ACP/Web callers.
 */
export class SessionRuntimeFacade {
  private readonly engine: QueryEngine;

  constructor(config: QueryEngineConfig) {
    this.engine = new QueryEngine(config);
  }

  submitMessage(prompt: string | ContentBlockParam[]) {
    return this.engine.submitMessage(prompt);
  }

  interrupt() {
    this.engine.interrupt();
  }

  resetAbortController() {
    this.engine.resetAbortController();
  }

  getAbortSignal() {
    return this.engine.getAbortSignal();
  }

  setModel(model: string) {
    this.engine.setModel(model);
  }

  getMessages() {
    return this.engine.getMessages();
  }
}

