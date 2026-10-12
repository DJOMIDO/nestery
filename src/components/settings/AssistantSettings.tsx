// src/components/settings/AssistantSettings.tsx
// The model and API key the assistant uses. The key is checked and stored
// encrypted on the server; the page only ever sees its last characters.

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { KeyRound, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading, Spinner } from "@/components/ui/spinner";
import { Shortcut } from "@/components/Shortcut";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ASSISTANT_PROVIDER_LABELS,
  ASSISTANT_PROVIDERS,
  PROVIDER_KEY_PAGES,
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
  const t = useTranslations("assistantSettings");
  const tCommon = useTranslations("common");

  const [provider, setProvider] = useState<AssistantProvider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(SUGGESTED_MODELS.anthropic[0]);
  // "Other" providers only
  const [baseUrl, setBaseUrl] = useState("");
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
      setBaseUrl(settings.baseUrl ?? "");
    }
  };

  useEffect(() => {
    refresh()
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const isCustom = provider === "custom";
  // Without a new key: the saved one, the owner's (Anthropic), or none for a
  // local server
  const hasSavedKey = !!saved?.apiKeyHint && saved.provider === provider;
  const canUseExistingKey =
    hasSavedKey || (provider === "anthropic" && status?.source === "server") || isCustom;
  const ready = canUseExistingKey || !!apiKey.trim();

  // Sent with every check and save
  const connection = () => ({
    provider,
    ...(apiKey.trim() && { apiKey: apiKey.trim() }),
    ...(isCustom && { baseUrl: baseUrl.trim() }),
  });

  const loadModels = async () => {
    setError(null);
    setLoadingModels(true);
    try {
      const ids = await request<string[]>("/api/assistant/models", {
        method: "POST",
        body: JSON.stringify(connection()),
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
        body: JSON.stringify({ ...connection(), model }),
      });
      setApiKey("");
      await refresh();
      toast.success(t("saved"));
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
      setModel(SUGGESTED_MODELS[provider][0] ?? "");
      await refresh();
      toast.success(t("removed"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t.rich("intro", {
            shortcut: () => <Shortcut k="J" />,
            // The same icon as the sidebar's Assistant item
            icon: () => <Sparkles className="inline size-3.5 -translate-y-px" aria-label={t("iconLabel")} />,
          })}
        </p>
      </div>

      {status?.source === "server" && !saved?.apiKeyHint && (
        <p className="rounded-md bg-leaf-soft px-3 py-2 text-sm text-leaf">
          {t("serverKey", { limit: status.dailyLimit })}
        </p>
      )}
      {!status?.canSaveKey && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {t("cantStore")}
        </p>
      )}

      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assistant-provider">{t("provider")}</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v as AssistantProvider);
              setModels(null);
              setError(null);
              setModel(SUGGESTED_MODELS[v as AssistantProvider][0] ?? "");
            }}
          >
            <SelectTrigger id="assistant-provider" className="w-full sm:max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSISTANT_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "custom" ? t("customProvider") : ASSISTANT_PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCustom && (
          <div className="space-y-2">
            <Label htmlFor="assistant-base-url">{t("baseUrl")}</Label>
            <Input
              id="assistant-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setModels(null);
              }}
              placeholder="https://api.deepseek.com/v1"
              spellCheck={false}
              className="sm:max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t.rich("baseUrlHint", { code: (chunks) => <code>{chunks}</code> })}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="assistant-key">{isCustom ? t("apiKeyOptional") : t("apiKey")}</Label>
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
              placeholder={hasSavedKey ? t("savedKey", { hint: saved!.apiKeyHint! }) : ""}
            />
            {saved && (
              <Button type="button" variant="outline" size="icon" onClick={remove} disabled={saving} title={t("removeHint")}>
                <Trash2 className="size-4" />
                <span className="sr-only">{t("remove")}</span>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {PROVIDER_KEY_PAGES[provider] &&
              t.rich("createKey", {
                link: (chunks) => (
                  <a
                    href={PROVIDER_KEY_PAGES[provider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </a>
                ),
              })}
            {t("stored")}
            {hasSavedKey && t("keepKey")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistant-model">{t("model")}</Label>
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
              <Input
                id="assistant-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t("modelPlaceholder")}
                spellCheck={false}
              />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={loadModels}
              disabled={loadingModels || !ready || (isCustom && !baseUrl.trim())}
            >
              {loadingModels ? <Spinner className="mr-1" /> : <KeyRound className="size-4 mr-1" />}
              {loadingModels ? tCommon("loading") : t("loadModels")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("modelsHint")}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !model.trim() || !ready || (isCustom && !baseUrl.trim())}>
            {saving && <Spinner />}
            {saving ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
