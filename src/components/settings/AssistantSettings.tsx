// src/components/settings/AssistantSettings.tsx
// The model and API key the assistant uses. The key is checked and stored
// encrypted on the server; the page only ever sees its last characters.

"use client";

import { useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ASSISTANT_PROVIDER_LABELS,
  ASSISTANT_PROVIDERS,
  SUGGESTED_MODELS,
  type AssistantProvider,
  type AssistantSettingsView,
  type AssistantStatus,
} from "@/lib/assistant";
import { request } from "@/lib/api";

export function AssistantSettings() {
  const [saved, setSaved] = useState<AssistantSettingsView | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState<AssistantProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(SUGGESTED_MODELS.anthropic[0]);
  // Models the key can use, once loaded
  const [models, setModels] = useState<string[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const [settings, nextStatus] = await Promise.all([
      request<AssistantSettingsView | null>("/api/assistant/settings"),
      request<AssistantStatus>("/api/assistant"),
    ]);
    setSaved(settings);
    setStatus(nextStatus);
    if (settings) {
      setProvider(settings.provider);
      setModel(settings.model);
    }
  };

  useEffect(() => {
    refresh()
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Without a new key, the saved one (or the owner's) is used
  const canUseExistingKey = !!saved?.apiKeyHint || status?.source === "server";

  const loadModels = async () => {
    setError(null);
    setLoadingModels(true);
    try {
      const ids = await request<string[]>("/api/assistant/models", {
        method: "POST",
        body: JSON.stringify({ provider, ...(apiKey.trim() && { apiKey: apiKey.trim() }) }),
      });
      // Suggested ones first, in their order
      const suggested = SUGGESTED_MODELS[provider].filter((m) => ids.includes(m));
      setModels([...suggested, ...ids.filter((m) => !suggested.includes(m))]);
      if (!ids.includes(model)) setModel(suggested[0] ?? ids[0] ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingModels(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await request("/api/assistant/settings", {
        method: "PUT",
        body: JSON.stringify({ provider, model, ...(apiKey.trim() && { apiKey: apiKey.trim() }) }),
      });
      setApiKey("");
      await refresh();
      toast.success("Assistant settings saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await request("/api/assistant/settings", { method: "DELETE" });
      setApiKey("");
      setModels(null);
      setModel(SUGGESTED_MODELS[provider][0]);
      await refresh();
      toast.success("API key removed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Assistant</h2>
        <p className="text-sm text-muted-foreground">
          The assistant (✦ in the sidebar, or ⌘J) uses an AI model with your own API key. The provider bills you
          for what you use.
        </p>
      </div>

      {status?.source === "server" && !saved?.apiKeyHint && (
        <p className="rounded-md bg-leaf-soft px-3 py-2 text-sm text-leaf">
          You can use the app&apos;s own key ({status.dailyLimit} messages a day). Add yours to use it without a limit.
        </p>
      )}
      {!status?.canSaveKey && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          This server can&apos;t store API keys yet (ASSISTANT_ENCRYPTION_KEY is not set).
        </p>
      )}

      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assistant-provider">Provider</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v as AssistantProvider);
              setModels(null);
              setModel(SUGGESTED_MODELS[v as AssistantProvider][0]);
            }}
          >
            <SelectTrigger id="assistant-provider" className="w-full sm:max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSISTANT_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {ASSISTANT_PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">More providers (OpenAI, Gemini, OpenRouter, …) are coming.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistant-key">API key</Label>
          <div className="flex gap-2 sm:max-w-sm">
            <Input
              id="assistant-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setModels(null);
              }}
              placeholder={saved?.apiKeyHint ? `Saved key ${saved.apiKeyHint}` : "sk-ant-…"}
            />
            {saved?.apiKeyHint && (
              <Button type="button" variant="outline" size="icon" onClick={remove} disabled={saving} title="Remove key">
                <Trash2 className="size-4" />
                <span className="sr-only">Remove key</span>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Create one in the{" "}
            <a
              href="https://platform.claude.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Claude Console
            </a>
            . It&apos;s stored encrypted and only used for your own requests.
            {saved?.apiKeyHint && " Leave empty to keep the saved key."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistant-model">Model</Label>
          <div className="flex gap-2 sm:max-w-sm">
            {models ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="assistant-model" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="assistant-model" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={loadModels}
              disabled={loadingModels || (!apiKey.trim() && !canUseExistingKey)}
            >
              <KeyRound className="size-4 mr-1" />
              {loadingModels ? "Checking…" : "Check key"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            “Check key” lists the models your key can use. Haiku is the cheapest; Sonnet and Opus are smarter.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !model.trim() || (!apiKey.trim() && !canUseExistingKey)}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
