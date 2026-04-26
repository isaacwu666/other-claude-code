import { useCallback, useMemo, useState } from "react";

export type ProviderType = "anthropic" | "openai" | "custom";

export type ProviderConfig = {
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const STORAGE_KEY = "rcs_model_provider_config";

const DEFAULT_CONFIG: ProviderConfig = {
  provider: "anthropic",
  apiKey: "",
  baseUrl: "",
  model: "",
};

function loadConfig(): ProviderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
    return {
      provider:
        parsed.provider === "anthropic" ||
        parsed.provider === "openai" ||
        parsed.provider === "custom"
          ? parsed.provider
          : DEFAULT_CONFIG.provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

export function useProviderConfig() {
  const [config, setConfig] = useState<ProviderConfig>(loadConfig);

  const saveConfig = useCallback((next: ProviderConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  }, []);

  const setField = useCallback(
    <K extends keyof ProviderConfig>(field: K, value: ProviderConfig[K]) => {
      const next = { ...config, [field]: value };
      saveConfig(next);
    },
    [config, saveConfig],
  );

  const providerTitle = useMemo(() => {
    if (config.provider === "anthropic") return "Anthropic";
    if (config.provider === "openai") return "OpenAI Compatible";
    return "Custom";
  }, [config.provider]);

  const commandPreview = useMemo(() => {
    const lines: string[] = [];
    if (config.provider === "anthropic") {
      if (config.apiKey.trim()) {
        lines.push(
          `$env:ANTHROPIC_API_KEY='${escapePowerShell(config.apiKey.trim())}'`,
        );
      }
      if (config.baseUrl.trim()) {
        lines.push(
          `$env:ANTHROPIC_BASE_URL='${escapePowerShell(config.baseUrl.trim())}'`,
        );
      }
      if (config.model.trim()) {
        lines.push(
          `$env:ANTHROPIC_MODEL='${escapePowerShell(config.model.trim())}'`,
        );
      }
    } else if (config.provider === "openai") {
      if (config.apiKey.trim()) {
        lines.push(
          `$env:OPENAI_API_KEY='${escapePowerShell(config.apiKey.trim())}'`,
        );
      }
      if (config.baseUrl.trim()) {
        lines.push(
          `$env:OPENAI_BASE_URL='${escapePowerShell(config.baseUrl.trim())}'`,
        );
      }
      if (config.model.trim()) {
        lines.push(
          `$env:OPENAI_MODEL='${escapePowerShell(config.model.trim())}'`,
        );
      }
    } else {
      if (config.apiKey.trim()) {
        lines.push(
          `$env:MODEL_API_KEY='${escapePowerShell(config.apiKey.trim())}'`,
        );
      }
      if (config.baseUrl.trim()) {
        lines.push(
          `$env:MODEL_BASE_URL='${escapePowerShell(config.baseUrl.trim())}'`,
        );
      }
      if (config.model.trim()) {
        lines.push(
          `$env:MODEL_NAME='${escapePowerShell(config.model.trim())}'`,
        );
      }
    }
    lines.push("bun run dev:services");
    return lines.join("\n");
  }, [config]);

  const hasConfiguredKey = config.apiKey.trim().length > 0;

  return {
    config,
    setField,
    providerTitle,
    commandPreview,
    hasConfiguredKey,
  };
}

