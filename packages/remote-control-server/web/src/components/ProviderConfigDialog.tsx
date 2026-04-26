import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Check, Copy } from "lucide-react";
import type { ProviderConfig, ProviderType } from "../hooks/useProviderConfig";

interface ProviderConfigDialogProps {
  open: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: <K extends keyof ProviderConfig>(
    field: K,
    value: ProviderConfig[K],
  ) => void;
  commandPreview: string;
}

export function ProviderConfigDialog({
  open,
  onClose,
  config,
  onChange,
  commandPreview,
}: ProviderConfigDialogProps) {
  const [copied, setCopied] = useState(false);

  const keyPlaceholder = useMemo(() => {
    if (config.provider === "anthropic") return "sk-ant-...";
    if (config.provider === "openai") return "sk-...";
    return "Provider API Key";
  }, [config.provider]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(commandPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl border-border bg-surface-1 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold text-text-primary">
            模型提供商配置
          </DialogTitle>
          <DialogDescription className="text-sm text-text-muted">
            配置会保存在浏览器本地。更新后需要重启 `agent-worker` 才会生效。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-text-muted">Provider</div>
            <select
              value={config.provider}
              onChange={e =>
                onChange("provider", e.target.value as ProviderType)
              }
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI Compatible</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-text-muted">Model（可选）</div>
            <input
              value={config.model}
              onChange={e => onChange("model", e.target.value)}
              placeholder="claude-sonnet-4-5 / gpt-4o ..."
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-text-muted">API Key</div>
            <input
              value={config.apiKey}
              onChange={e => onChange("apiKey", e.target.value)}
              placeholder={keyPlaceholder}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-text-muted">Base URL（可选）</div>
            <input
              value={config.baseUrl}
              onChange={e => onChange("baseUrl", e.target.value)}
              placeholder="https://api.anthropic.com 或你的代理地址"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-text-secondary">
              PowerShell 启动命令（复制后执行）
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-status-active" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </>
              )}
            </button>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-surface-0 p-3 font-mono text-xs text-text-primary">
            {commandPreview}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

