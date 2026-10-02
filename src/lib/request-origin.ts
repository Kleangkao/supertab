const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Next may normalize loopback URLs to localhost. Never trust forwarded hosts. */
export function sameOriginRequest(request: Request): string | null {
  const value = request.headers.get("origin");
  if (!value) return null;
  let origin: URL;
  try { origin = new URL(value); } catch { return null; }
  if (origin.origin !== value || !["http:", "https:"].includes(origin.protocol)) return null;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host && host !== origin.host) return null;
  if (url.origin === value) return value;
  if (host === origin.host && LOOPBACK_HOSTS.has(url.hostname) && LOOPBACK_HOSTS.has(origin.hostname)
    && url.protocol === origin.protocol && url.port === origin.port) return value;
  return null;
}
