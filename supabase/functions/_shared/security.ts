export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}

type RateEntry = { count: number; windowStartMs: number };
const rateStore = new Map<string, RateEntry>();

export function checkSoftRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const current = rateStore.get(key);

  if (!current || now - current.windowStartMs >= windowMs) {
    rateStore.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= limit) {
    const retryMs = windowMs - (now - current.windowStartMs);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
  }

  current.count += 1;
  rateStore.set(key, current);
  return { allowed: true, retryAfterSec: 0 };
}

export function sanitizePromptText(input: unknown, maxLen: number): string {
  if (input === null || input === undefined) return "";
  let s = String(input);
  // Remove control markers used by transcript protocol so they can't be injected via user input/content.
  s = s.replace(/\[INSIGHTS\]|\[\/INSIGHTS\]|\[INTERVIEW_COMPLETE\]/gi, "");
  // Remove low ASCII controls except newline and tab.
  s = s.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function isIPv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isPrivateIPv4(host: string): boolean {
  if (!isIPv4(host)) return false;
  const parts = host.split(".").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isIPv6LoopbackOrLocal(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  return false;
}

export function validateWebhookTargetUrl(
  targetUrl: string,
  opts?: { allowPrivateTargets?: boolean; allowInsecureHttp?: boolean }
): { allowed: boolean; reason?: string } {
  const allowPrivate = Boolean(opts?.allowPrivateTargets);
  const allowInsecure = Boolean(opts?.allowInsecureHttp);
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!allowInsecure && protocol !== "https:") {
    return { allowed: false, reason: "Only https targets are allowed" };
  }
  if (protocol !== "https:" && protocol !== "http:") {
    return { allowed: false, reason: "Unsupported URL scheme" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!allowPrivate) {
    const blockedHostnames = new Set([
      "localhost",
      "metadata.google.internal",
      "169.254.169.254",
      "100.100.100.200",
    ]);
    if (blockedHostnames.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
      return { allowed: false, reason: "Private/internal host not allowed" };
    }
    if (isPrivateIPv4(host) || isIPv6LoopbackOrLocal(host)) {
      return { allowed: false, reason: "Private/internal IP not allowed" };
    }
  }

  return { allowed: true };
}
