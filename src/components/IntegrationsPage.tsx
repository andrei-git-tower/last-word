import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Provider = "webhook" | "slack";
type AuthMethod = "none" | "bearer" | "api_key" | "hmac";

type Endpoint = {
  id: string;
  name: string;
  provider: Provider;
  target_url: string;
  signing_secret: string;
  auth_header_name: string | null;
  auth_header_value: string | null;
  enabled: boolean;
};

type Delivery = {
  id: string;
  endpoint_id: string | null;
  status: "success" | "failed" | "skipped";
  http_status: number | null;
  duration_ms: number | null;
  error_message: string | null;
  attempted_at: string;
};

const INPUT_CLS =
  "w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

export function IntegrationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("webhook");
  const [targetUrl, setTargetUrl] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("none");
  const [bearerToken, setBearerToken] = useState("");
  const [apiKeyHeaderName, setApiKeyHeaderName] = useState("X-API-Key");
  const [apiKeyHeaderValue, setApiKeyHeaderValue] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: endpoints, isLoading: endpointsLoading } = useQuery({
    queryKey: ["notification_endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_endpoints")
        .select("id, name, provider, target_url, signing_secret, auth_header_name, auth_header_value, enabled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Endpoint[];
    },
  });

  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ["notification_deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_deliveries")
        .select("id, endpoint_id, status, http_status, duration_ms, error_message, attempted_at")
        .order("attempted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Delivery[];
    },
  });

  const endpointNameById = useMemo(() => {
    const map = new Map<string, string>();
    (endpoints ?? []).forEach((e) => {
      map.set(e.id, e.name || (e.provider === "slack" ? "Slack webhook" : "Webhook"));
    });
    return map;
  }, [endpoints]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setProvider("webhook");
    setTargetUrl("");
    setAuthMethod("none");
    setBearerToken("");
    setApiKeyHeaderName("X-API-Key");
    setApiKeyHeaderValue("");
    setSigningSecret("");
    setEnabled(true);
  }

  function inferAuthMethod(endpoint: Endpoint): AuthMethod {
    if ((endpoint.signing_secret ?? "").trim()) return "hmac";
    const headerName = (endpoint.auth_header_name ?? "").trim();
    const headerValue = (endpoint.auth_header_value ?? "").trim();
    if (headerName.toLowerCase() === "authorization" && headerValue.toLowerCase().startsWith("bearer ")) {
      return "bearer";
    }
    if (headerName || headerValue) return "api_key";
    return "none";
  }

  function loadForEdit(endpoint: Endpoint) {
    setEditingId(endpoint.id);
    setName(endpoint.name ?? "");
    setProvider(endpoint.provider);
    setTargetUrl(endpoint.target_url);
    const method = inferAuthMethod(endpoint);
    setAuthMethod(method);
    setSigningSecret(endpoint.signing_secret ?? "");
    if (method === "bearer") {
      setBearerToken((endpoint.auth_header_value ?? "").replace(/^Bearer\s+/i, "").trim());
      setApiKeyHeaderName("X-API-Key");
      setApiKeyHeaderValue("");
    } else if (method === "api_key") {
      setBearerToken("");
      setApiKeyHeaderName(endpoint.auth_header_name ?? "X-API-Key");
      setApiKeyHeaderValue(endpoint.auth_header_value ?? "");
    } else {
      setBearerToken("");
      setApiKeyHeaderName("X-API-Key");
      setApiKeyHeaderValue("");
    }
    setEnabled(endpoint.enabled);
  }

  async function saveEndpoint() {
    if (!user?.id) return;
    if (!targetUrl.trim()) {
      toast.error("Target URL is required.");
      return;
    }
    if (authMethod === "bearer" && !bearerToken.trim()) {
      toast.error("Bearer token is required.");
      return;
    }
    if (authMethod === "api_key" && (!apiKeyHeaderName.trim() || !apiKeyHeaderValue.trim())) {
      toast.error("API key header name and value are required.");
      return;
    }
    if (authMethod === "hmac" && !signingSecret.trim()) {
      toast.error("Signing secret is required.");
      return;
    }

    const authHeaderName =
      authMethod === "bearer"
        ? "Authorization"
        : authMethod === "api_key"
        ? apiKeyHeaderName.trim()
        : null;
    const authHeaderValue =
      authMethod === "bearer"
        ? `Bearer ${bearerToken.trim()}`
        : authMethod === "api_key"
        ? apiKeyHeaderValue.trim()
        : null;
    const effectiveSigningSecret = authMethod === "hmac" ? signingSecret.trim() : "";

    setSaving(true);
    const payload = {
      account_id: user.id,
      name: name.trim(),
      provider,
      target_url: targetUrl.trim(),
      signing_secret: effectiveSigningSecret,
      auth_header_name: authHeaderName,
      auth_header_value: authHeaderValue,
      enabled,
      event_type: "interview_completed" as const,
      delivery_mode: "realtime" as const,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await supabase.from("notification_endpoints").update(payload).eq("id", editingId)
      : await supabase.from("notification_endpoints").insert(payload);

    setSaving(false);

    if (error) {
      toast.error("Failed to save integration.");
      return;
    }

    toast.success(editingId ? "Integration updated." : "Integration added.");
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["notification_endpoints"] });
  }

  async function removeEndpoint(id: string) {
    const { error } = await supabase
      .from("notification_endpoints")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete integration.");
      return;
    }
    toast.success("Integration removed.");
    if (editingId === id) resetForm();
    queryClient.invalidateQueries({ queryKey: ["notification_endpoints"] });
  }

  async function toggleEnabled(endpoint: Endpoint) {
    const { error } = await supabase
      .from("notification_endpoints")
      .update({ enabled: !endpoint.enabled, updated_at: new Date().toISOString() })
      .eq("id", endpoint.id);
    if (error) {
      toast.error("Failed to update integration.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["notification_endpoints"] });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-1">Add Integration</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Send interview-completed events in realtime to Slack or any webhook endpoint.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className={INPUT_CLS}
            >
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLS}
              placeholder={provider === "slack" ? "Product Team Slack" : "Ops Webhook"}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {provider === "slack" ? "Slack Incoming Webhook URL" : "Target URL"}
            </label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className={INPUT_CLS}
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Authentication</label>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
              className={INPUT_CLS}
            >
              <option value="none">None</option>
              <option value="bearer">Bearer token</option>
              <option value="api_key">API key header</option>
              <option value="hmac">HMAC signature</option>
            </select>
          </div>
          {authMethod === "bearer" && (
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bearer token</label>
              <input
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                className={INPUT_CLS}
                placeholder="your-token"
              />
            </div>
          )}
          {authMethod === "api_key" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Header name</label>
                <input
                  value={apiKeyHeaderName}
                  onChange={(e) => setApiKeyHeaderName(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="X-API-Key"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Header value</label>
                <input
                  value={apiKeyHeaderValue}
                  onChange={(e) => setApiKeyHeaderValue(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="your-api-key"
                />
              </div>
            </>
          )}
          {authMethod === "hmac" && (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Signing secret</label>
                <input
                  value={signingSecret}
                  onChange={(e) => setSigningSecret(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Used for x-lastword-signature"
                />
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                Sends <code>x-lastword-signature: sha256=...</code> for verification.
              </div>
            </>
          )}
          {provider === "slack" && authMethod !== "none" && (
            <div className="sm:col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Slack incoming webhooks usually work best with Authentication set to None.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <label className="text-sm text-foreground flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enabled
          </label>
          <div className="flex items-center gap-2">
            {editingId && (
              <button
                onClick={resetForm}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={saveEndpoint}
              disabled={saving}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Add integration"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-3">Configured Endpoints</h3>
        {endpointsLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (endpoints ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No endpoints configured yet.</div>
        ) : (
          <div className="space-y-2">
            {(endpoints ?? []).map((endpoint) => (
              <div key={endpoint.id} className="border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {endpoint.name || (endpoint.provider === "slack" ? "Slack webhook" : "Webhook")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 break-all">{endpoint.target_url}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase">
                        {endpoint.provider}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          endpoint.enabled
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {endpoint.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleEnabled(endpoint)}
                      className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground"
                    >
                      {endpoint.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => loadForEdit(endpoint)}
                      className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removeEndpoint(endpoint.id)}
                      className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-sm text-foreground mb-3">Recent Deliveries</h3>
        {deliveriesLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (deliveries ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No deliveries yet.</div>
        ) : (
          <div className="space-y-2">
            {(deliveries ?? []).map((d) => (
              <div key={d.id} className="border border-border rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {d.endpoint_id ? (endpointNameById.get(d.endpoint_id) ?? "Endpoint") : "Endpoint"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(d.attempted_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      d.status === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : d.status === "failed"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {d.status}
                  </span>
                  {d.http_status !== null && (
                    <span className="text-muted-foreground">HTTP {d.http_status}</span>
                  )}
                  {d.duration_ms !== null && (
                    <span className="text-muted-foreground">{d.duration_ms}ms</span>
                  )}
                  {d.error_message && (
                    <span className="text-red-600 truncate">{d.error_message}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
