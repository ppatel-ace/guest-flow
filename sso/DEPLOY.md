# ACE Auth — Portainer Deployment

## Prerequisites

- External Docker network `ace-network` exists
- PostgreSQL `ace-db` reachable (syno-postgres-db or pgbouncer port 2666)
- Nginx Proxy Manager with Let's Encrypt for `sso.aceelectronics.com`

## Generate secrets

```bash
openssl rand -base64 48
```

Use output for `SSO_JWT_SECRET` — **must be identical** in every ACE app.

## Portainer stack

1. New Stack → name `ace-auth`
2. Upload `sso/docker-compose.yml` or point to repo
3. Set environment variables:

```env
DATABASE_URL=postgresql://ace_user:PASSWORD@syno-pgbouncer:5432/ace_jobtrack_db?sslmode=disable
SSO_JWT_SECRET=<generated-secret>
APP_DOMAIN=aceelectronics.com
SSO_BASE_URL=https://sso.aceelectronics.com
AZURE_REDIRECT_URI=https://sso.aceelectronics.com/auth/microsoft/callback
```

Leave `AZURE_CLIENT_SECRET` empty for PKCE-only user SSO.

4. Deploy stack

## Nginx Proxy Manager

| Setting | Value |
|---------|-------|
| Domain | `sso.aceelectronics.com` |
| Forward hostname | `ace-auth` |
| Forward port | `3100` |
| SSL | Let's Encrypt |

## Propagate SSO_JWT_SECRET

Set the same secret in Portainer stacks for:

- guestflow
- jobtrack / ace-production-api
- estimatepro
- it-issue-production-app
- ace-hub (when deployed)

Also set:

```env
SSO_LOGIN_URL=https://sso.aceelectronics.com
APP_DOMAIN=aceelectronics.com
```

## Verify

```bash
curl https://sso.aceelectronics.com/health
# {"ok":true}
```

After Microsoft login, decode `ace_sso` cookie or call:

```bash
curl -b "ace_sso=TOKEN" https://sso.aceelectronics.com/api/auth/validate
```
