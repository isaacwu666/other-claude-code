#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const bunExecutable = process.execPath;

type Proc = {
  name: string;
  command: string;
  args: string[];
  cwd?: string;
};

const workerCommand = process.env.RCS_AGENT_WORKER_CMD;
const includeWorker = process.env.RCS_START_WORKER !== "0";

const processes: Proc[] = [
  {
    name: "rcs-backend",
    command: bunExecutable,
    args: ["run", "scripts/rcs.ts"],
    cwd: projectRoot,
  },
  {
    name: "rcs-web",
    command: bunExecutable,
    args: ["run", "dev:web"],
    cwd: join(projectRoot, "packages/remote-control-server"),
  },
];

if (includeWorker) {
  if (workerCommand) {
    const [command, ...args] = workerCommand.split(" ").filter(Boolean);
    if (command) {
      processes.push({
        name: "agent-worker",
        command,
        args,
        cwd: projectRoot,
      });
    }
  } else {
    processes.push({
      name: "agent-worker",
      command: bunExecutable,
      args: ["run", "dev", "--", "--remote-control"],
      cwd: projectRoot,
    });
  }
}

const children = processes.map(proc =>
  spawn(proc.command, proc.args, {
    cwd: proc.cwd,
    stdio: "inherit",
    env: process.env,
  }),
);

function shutdown(signal: NodeJS.Signals) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of children) {
  child.on("exit", code => {
    if (code && code !== 0) {
      shutdown("SIGTERM");
      process.exit(code);
    }
  });
}

