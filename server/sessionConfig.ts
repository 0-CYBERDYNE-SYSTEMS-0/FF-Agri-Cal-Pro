import { randomBytes } from "crypto";

const MIN_PRODUCTION_SECRET_BYTES = 32;

export function resolveSessionSecret(
  environment = process.env.NODE_ENV,
  configuredSecret = process.env.SESSION_SECRET,
): string {
  if (environment === "production") {
    if (!configuredSecret || Buffer.byteLength(configuredSecret, "utf8") < MIN_PRODUCTION_SECRET_BYTES) {
      throw new Error("SESSION_SECRET must be configured with at least 32 bytes in production");
    }
    return configuredSecret;
  }

  // Development/test runs get a fresh process-local key rather than a
  // predictable timestamp fallback. It is intentionally not suitable for
  // production or for sessions that must survive restarts.
  return configuredSecret || randomBytes(MIN_PRODUCTION_SECRET_BYTES).toString("base64url");
}
