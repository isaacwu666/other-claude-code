import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import type {
  ThreadEntry,
  PendingPermission,
  ToolCallEntry,
} from "../lib/types";
import type { DomainEvent } from "../hooks/useDomainEvents";

type Props = {
  entries: ThreadEntry[];
  pendingPermissions: PendingPermission[];
  domainEvents: DomainEvent[];
};

function shortText(value: unknown, fallback = "N/A") {
  if (typeof value !== "string") return fallback;
  if (value.length <= 72) return value;
  return `${value.slice(0, 72)}...`;
}

export function SideConsolePanel({
  entries,
  pendingPermissions,
  domainEvents,
}: Props) {
  const workspaceHints = useMemo(() => {
    const collected = new Set<string>();
    for (const entry of entries) {
      if (entry.type !== "tool_call") continue;
      const raw = entry.toolCall.rawInput || {};
      const candidate = [
        raw.file_path,
        raw.path,
        raw.target_directory,
      ].find(v => typeof v === "string");
      if (typeof candidate === "string" && candidate.length > 0) {
        collected.add(candidate);
      }
    }
    return Array.from(collected).slice(-20);
  }, [entries]);

  const runningTasks = useMemo(
    () =>
      entries.filter(
        (entry): entry is ToolCallEntry =>
          entry.type === "tool_call" && entry.toolCall.status === "running",
      ),
    [entries],
  );

  const completedTasks = useMemo(
    () =>
      entries.filter(
        (entry): entry is ToolCallEntry =>
          entry.type === "tool_call" && entry.toolCall.status === "complete",
      ),
    [entries],
  );

  const metrics = useMemo(() => {
    const assistantMessages = entries.filter(e => e.type === "assistant_message").length;
    const toolCalls = entries.filter(e => e.type === "tool_call").length;
    const waitingPermissions = pendingPermissions.length;
    return {
      assistantMessages,
      toolCalls,
      waitingPermissions,
    };
  }, [entries, pendingPermissions.length]);

  return (
    <div className="h-full border-l bg-surface-1">
      <Tabs defaultValue="workspace" className="h-full">
        <div className="border-b px-3 py-2">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="observability">Observability</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="workspace" className="h-[calc(100%-49px)] overflow-auto p-3">
          <h3 className="mb-2 text-sm font-medium text-text-primary">最近工作区线索</h3>
          {workspaceHints.length === 0 ? (
            <p className="text-xs text-text-muted">暂无路径线索，执行文件/搜索工具后会显示。</p>
          ) : (
            <ul className="space-y-1">
              {workspaceHints.map(path => (
                <li
                  key={path}
                  className="rounded border bg-surface-0 px-2 py-1 font-mono text-xs text-text-secondary"
                >
                  {path}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="h-[calc(100%-49px)] overflow-auto p-3">
          <h3 className="mb-2 text-sm font-medium text-text-primary">运行中</h3>
          {runningTasks.length === 0 ? (
            <p className="mb-4 text-xs text-text-muted">没有正在运行的任务。</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {runningTasks.map(task => (
                <li key={task.toolCall.id} className="rounded border bg-surface-0 p-2">
                  <div className="text-xs font-medium">{task.toolCall.title}</div>
                  <div className="text-xs text-text-muted">status: {task.toolCall.status}</div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 text-sm font-medium text-text-primary">最近完成</h3>
          {completedTasks.length === 0 ? (
            <p className="text-xs text-text-muted">暂无已完成任务。</p>
          ) : (
            <ul className="space-y-2">
              {completedTasks.slice(-10).map(task => (
                <li key={task.toolCall.id} className="rounded border bg-surface-0 p-2">
                  <div className="text-xs font-medium">{task.toolCall.title}</div>
                  <div className="text-xs text-text-muted">status: {task.toolCall.status}</div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="h-[calc(100%-49px)] overflow-auto p-3">
          <h3 className="mb-2 text-sm font-medium text-text-primary">待审批权限</h3>
          {pendingPermissions.length === 0 ? (
            <p className="text-xs text-text-muted">当前无待审批项。</p>
          ) : (
            <ul className="space-y-2">
              {pendingPermissions.map(item => (
                <li key={item.requestId} className="rounded border bg-surface-0 p-2">
                  <div className="text-xs font-medium">{item.toolName}</div>
                  <div className="text-xs text-text-muted">
                    requestId: {shortText(item.requestId, "-")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="observability" className="h-[calc(100%-49px)] overflow-auto p-3">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded border bg-surface-0 p-2">
              <div className="text-xs text-text-muted">Assistant</div>
              <div className="text-sm font-semibold">{metrics.assistantMessages}</div>
            </div>
            <div className="rounded border bg-surface-0 p-2">
              <div className="text-xs text-text-muted">ToolCalls</div>
              <div className="text-sm font-semibold">{metrics.toolCalls}</div>
            </div>
            <div className="rounded border bg-surface-0 p-2">
              <div className="text-xs text-text-muted">PendingPerm</div>
              <div className="text-sm font-semibold">{metrics.waitingPermissions}</div>
            </div>
          </div>
          <h3 className="mb-2 text-sm font-medium text-text-primary">事件时间线（v3）</h3>
          {domainEvents.length === 0 ? (
            <p className="text-xs text-text-muted">暂无事件，等待会话流量。</p>
          ) : (
            <ul className="space-y-2">
              {domainEvents.slice(-30).map(event => (
                <li key={event.id} className="rounded border bg-surface-0 p-2">
                  <div className="text-xs font-medium">{event.type}</div>
                  <div className="text-xs text-text-muted">{new Date(event.created_at).toLocaleTimeString()}</div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

