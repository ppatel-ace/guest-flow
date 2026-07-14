import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const OPENID_CONFIG_CACHE_MS = 60 * 60 * 1000;
let cachedJwksUri: { uri: string; fetchedAt: number } | null = null;

export interface MicrosoftIdTokenClaims {
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  oid?: string;
  sub?: string;
}

function getOpenIdConfigUrl(tenantId: string): string {
  return `https://login.microsoftonline.us/${tenantId}/.well-known/openid-configuration`;
}

async function getJwksUri(tenantId: string): Promise<string> {
  const now = Date.now();
  if (cachedJwksUri && now - cachedJwksUri.fetchedAt < OPENID_CONFIG_CACHE_MS) {
    return cachedJwksUri.uri;
  }
  const res = await fetch(getOpenIdConfigUrl(tenantId));
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenID configuration: ${res.status}`);
  }
  const data = (await res.json()) as { jwks_uri?: string };
  if (!data.jwks_uri) {
    throw new Error("OpenID configuration missing jwks_uri");
  }
  cachedJwksUri = { uri: data.jwks_uri, fetchedAt: now };
  return data.jwks_uri;
}

function createJwksClient(jwksUri: string) {
  return jwksClient({
    jwksUri,
    cache: true,
    cacheMaxAge: OPENID_CONFIG_CACHE_MS,
    rateLimit: true,
  });
}

function getKey(client: jwksClient.JwksClient, header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!header.kid) {
      reject(new Error("ID token missing kid header"));
      return;
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error("Signing key not found"));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyMicrosoftIdToken(
  idToken: string,
  tenantId: string,
  clientId: string,
): Promise<MicrosoftIdTokenClaims> {
  const jwksUri = await getJwksUri(tenantId);
  const client = createJwksClient(jwksUri);

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header) {
    throw new Error("Invalid ID token format");
  }

  const signingKey = await getKey(client, decoded.header);

  const verified = jwt.verify(idToken, signingKey, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: [
      `https://login.microsoftonline.us/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`,
    ],
  }) as MicrosoftIdTokenClaims;

  return verified;
}

export function extractEmailFromClaims(claims: MicrosoftIdTokenClaims): string {
  const email = (claims.email || claims.preferred_username || "").toLowerCase().trim();
  if (!email) {
    throw new Error("No email returned from Microsoft");
  }
  return email;
}

export function extractNameFromClaims(claims: MicrosoftIdTokenClaims, email: string): string {
  return (
    claims.name ||
    [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
    email
  );
}

export function extractGroupsFromClaims(claims: MicrosoftIdTokenClaims): string[] {
  if (!Array.isArray(claims.groups)) return [];
  return claims.groups.map((g) => String(g).toLowerCase());
}
