import { createRemoteJWKSet, jwtVerify } from "jose";

export type AccessAuthEnvironment = {
  NOTES_ACCESS_AUD?: string;
  NOTES_ACCESS_ISSUER?: string;
  NOTES_ACCESS_EMAIL?: string;
};

type AccessClaims = {
  email?: string;
};

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyCloudflareAccess(request: Request, env: AccessAuthEnvironment) {
  const audience = env.NOTES_ACCESS_AUD?.trim();
  const issuer = env.NOTES_ACCESS_ISSUER?.trim().replace(/\/+$/, "");

  if (!audience && !issuer) return undefined;
  if (!audience || !issuer) {
    throw new AccessConfigurationError("NOTES_ACCESS_AUD and NOTES_ACCESS_ISSUER must be configured together.");
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AccessAuthenticationError("Cloudflare Access identity is missing.");

  const keySet = remoteKeySet(issuer);
  try {
    const { payload } = await jwtVerify<AccessClaims>(token, keySet, {
      issuer,
      audience
    });
    const allowedEmail = env.NOTES_ACCESS_EMAIL?.trim().toLowerCase();
    if (allowedEmail && payload.email?.toLowerCase() !== allowedEmail) {
      throw new AccessAuthenticationError("Cloudflare Access identity is not authorized.");
    }
    return payload;
  } catch (error) {
    if (error instanceof AccessAuthenticationError) throw error;
    throw new AccessAuthenticationError("Cloudflare Access identity is invalid.");
  }
}

export class AccessAuthenticationError extends Error {}
export class AccessConfigurationError extends Error {}

function remoteKeySet(issuer: string) {
  const existing = keySets.get(issuer);
  if (existing) return existing;

  const keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  keySets.set(issuer, keySet);
  return keySet;
}
