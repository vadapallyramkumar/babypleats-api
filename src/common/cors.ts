/** Vite / local Nest may bind arbitrary localhost ports when defaults are busy. */
const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/**
 * Parse CORS_ORIGIN (comma-separated). Falls back to a single local origin
 * when the variable is unset, matching historical behavior.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Explicit allowlist check for browser Origin values.
 * Requests with no Origin (curl, server-to-server) are allowed.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  if (LOCAL_DEV_ORIGIN.test(origin)) {
    return true;
  }
  return false;
}
