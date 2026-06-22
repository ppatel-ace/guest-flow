---
name: Microsoft Entra ID GCC High PKCE SSO
description: How the ACE SSO service implements Microsoft OAuth2/PKCE login for GCC High tenants
---

## Implementation

- Authority: `https://login.microsoftonline.us/{tenantId}` (GCC High — NOT .com)
- Flow: Authorization Code + PKCE (public client, no client_secret)
- Client ID: env var `AZURE_CLIENT_ID` (default hardcoded to the ACE GCC High app)
- Tenant ID: env var `AZURE_TENANT_ID`
- Redirect URI: env var `AZURE_REDIRECT_URI` (default: `${SSO_BASE_URL}/auth/microsoft/callback`)
  - Must be registered as **Web** redirect (not SPA) in portal.azure.us

## Key decisions

- PKCE state + code_verifier stored in a short-lived `ms_pkce` httpOnly cookie (10 min TTL). State is validated on callback to prevent CSRF.
- ID token is decoded (base64url split) without signature verification — token comes from Microsoft's HTTPS token endpoint directly, so MITM is already prevented.
- email claim falls back to `preferred_username` (UPN) if `email` is absent.
- Users are **auto-created** on first Microsoft login (everyone with a valid GCC High account gets in; group-based access control deferred).
- `password_hash` in `sso_users` was made nullable so Microsoft-only users can be inserted without a hash. `auth_provider` column ('local'|'microsoft') added.
- For cross-origin absolute redirect URIs the token is appended as `?ace_token=<jwt>` (same pattern as the existing local login cross-origin flow).

**Why:**
GCC High requires `.us` endpoints and a separate app registration in portal.azure.us. No client secret is needed for PKCE — the code verifier proves identity without a secret.

**How to apply:**
Any new GCC High app registration: use portal.azure.us, set redirect URI to `https://sso.aceelectronics.com/auth/microsoft/callback`, enable openid/profile/email scopes, leave client secret blank.
