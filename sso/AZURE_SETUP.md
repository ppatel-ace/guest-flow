# Azure GCC High — ACE Auth SSO Setup

Complete these steps in [portal.azure.us](https://portal.azure.us) before production login.

## App registration

| Field | Value |
|-------|-------|
| App Name | User Validation App - SSO |
| Client ID | `443420ec-3e93-4fe2-b233-ee23866d66b1` |
| Tenant ID | `6ab850db-8359-47f8-9e46-ddb57a3f87bd` |

## 1. Redirect URI (Reply URL)

Authentication → Redirect URIs → add:

```
https://sso.aceelectronics.com/auth/microsoft/callback
```

Local dev (optional):

```
http://localhost:3100/auth/microsoft/callback
```

## 2. Delegated permissions

| Permission | Purpose |
|------------|---------|
| openid | SSO |
| profile | Display name, UPN |
| email | Email address |
| User.Read | Signed-in user profile |

Grant **admin consent** after adding permissions.

## 3. Token configuration

Optional claims on **ID token**: `email`, `given_name`, `family_name`, `preferred_username`

**Groups claim**: Security groups → Group ID (returns GUIDs)

## 4. Security groups → apps

| Group | GUID | App |
|-------|------|-----|
| sg_Guestflow | `88897cdd-bc61-4051-b67e-6daf5f7fc7e8` | GuestFlow |
| sg_Jobtrack | `bc5af5fb-4e3d-4e6c-be07-c7bcff91e2ed` | JobTrack admin |
| sg_EstimatePro | `e8309095-39bf-4354-ae42-5808685b0c94` | EstimatePro |

Assign users to groups in My Groups. Parth (owner) can add/remove members.

## 5. Conditional Access

- MFA required
- Intune compliant device required
- TLS 1.2+ (enforced by Entra)

## 6. GCC High endpoints (do not use .com)

| Purpose | URL |
|---------|-----|
| Login | `https://login.microsoftonline.us/{tenant-id}/oauth2/v2.0/authorize` |
| Token | `https://login.microsoftonline.us/{tenant-id}/oauth2/v2.0/token` |
| OpenID | `https://login.microsoftonline.us/{tenant-id}/.well-known/openid-configuration` |
| Graph | `https://graph.microsoft.us/v1.0/` |

## 7. PKCE without client secret (Fred / Parth)

ACE Auth uses **authorization code + PKCE**. No client secret is required when Azure treats the app as a **public client**.

In **portal.azure.us** → App registration → **Authentication**:

1. Add platform **Single-page application** with redirect URI:
   ```
   https://sso.aceelectronics.com/auth/microsoft/callback
   ```
   For IP testing:
   ```
   http://192.2.150.10:3100/auth/microsoft/callback
   ```

2. **Or** on the **Web** platform: **Advanced settings** → **Allow public client flows** = **Yes**.

3. **Token configuration** → **Groups claim** on ID token → Security groups → **Group ID** (GUIDs matched in ACE code).

When groups are enforced, set on ace-auth:

```env
SSO_ENFORCE_GROUPS=true
AZURE_GROUP_GUESTFLOW=<guid>
AZURE_GROUP_JOBTRACK=<guid>
AZURE_GROUP_ESTIMATEPRO=<guid>
```

Pilot (everyone gets in): `SSO_ENFORCE_GROUPS=false`

## 8. Return URLs

| Role | URL |
|------|-----|
| Azure Reply URL (only one registered with Microsoft) | `https://sso.aceelectronics.com/auth/microsoft/callback` |
| Hub after login | `http://192.2.150.2:3200/api/auth/callback` |
| GuestFlow after login | `http://<host>:6055/api/auth/callback` |

Microsoft always returns to SSO first; SSO then redirects to the app `redirect_uri` with `ace_token`.

## Testing

1. Deploy ace-auth with `SSO_JWT_SECRET` and `SSO_ENFORCE_GROUPS=false`
2. Login at `https://sso.aceelectronics.com` (or IP) with Microsoft
3. Call `GET /api/auth/validate` — confirm `groups` and `apps` in response
4. When `SSO_ENFORCE_GROUPS=true`, verify app tiles match group membership
