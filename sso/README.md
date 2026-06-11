# ACE Auth — SSO Service

Lightweight self-hosted Single Sign-On service for ACE Electronics internal apps.

All apps live on `*.aceelectronics.com`. The SSO service sets a JWT cookie with
`Domain=.aceelectronics.com` so every subdomain app receives it automatically —
no OAuth2 redirect dance required.

## How it works

1. User visits a protected app (e.g. `guestflow.aceelectronics.com`)
2. App checks for the `ace_sso` cookie → not found → redirects to SSO login
3. SSO login form at `sso.aceelectronics.com/?redirect_uri=...`
4. User logs in → SSO sets `ace_sso` cookie with `Domain=.aceelectronics.com`
5. User is redirected back to the original app
6. App validates the JWT in the cookie using `SSO_JWT_SECRET` → authenticated

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. The service creates a `sso_users` table in this database. Can share the existing `ace-db` instance. |
| `SSO_JWT_SECRET` | ✅ | Secret key used to sign JWT tokens. **Must be identical in every app that validates SSO tokens.** Use a long random string (32+ chars). |
| `APP_DOMAIN` | ✅ | Parent domain for the shared cookie, e.g. `aceelectronics.com`. The cookie is set on `.aceelectronics.com` so all subdomains receive it. Set to `localhost` for local dev. |
| `INITIAL_ADMIN_EMAIL` | optional | Email address for the auto-seeded admin user (only runs when the users table is empty). |
| `INITIAL_ADMIN_PASSWORD` | optional | Password for the auto-seeded admin user. |
| `INITIAL_ADMIN_NAME` | optional | Display name for the auto-seeded admin (default: `Admin`). |
| `PORT` | optional | Port to listen on (default: `3100`). |

## Deploying on Portainer

1. Add this repository (or just the `sso/` subdirectory) as a new Stack in Portainer
2. Set the environment variables listed above in the Stack config
3. The service exposes port `3100` — add it to your nginx `ace-gateway` config:

```nginx
server {
    listen 443 ssl;
    server_name sso.aceelectronics.com;
    location / {
        proxy_pass http://ace-auth:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Connecting a new app

Every app that wants SSO needs two things:

### 1. Validate the JWT in `requireAuth`

```ts
import jwt from "jsonwebtoken";

const requireAuth = (req, res, next) => {
  const token = req.cookies?.ace_sso;
  if (token && process.env.SSO_JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.SSO_JWT_SECRET);
      req.user = payload;
      return next();
    } catch {}
  }
  // Fall back to whatever local auth the app uses
  res.status(401).json({ error: "Unauthorized" });
};
```

### 2. Redirect to SSO on unauthenticated access

```ts
// In GET /api/session, include the SSO login URL when not authenticated:
if (!authenticated && process.env.SSO_LOGIN_URL) {
  return res.json({
    authenticated: false,
    ssoLoginUrl: `${process.env.SSO_LOGIN_URL}?redirect_uri=${encodeURIComponent(currentUrl)}`
  });
}
```

### Required env vars per app

```
SSO_JWT_SECRET=<same secret as the SSO service>
SSO_LOGIN_URL=https://sso.aceelectronics.com
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Login page (pass `?redirect_uri=...`) |
| `POST` | `/api/auth/login` | Validate credentials, set cookie, redirect |
| `GET` | `/api/auth/logout` | Clear cookie, redirect to login page |
| `GET` | `/api/auth/validate` | Validate JWT from cookie or Bearer header — returns `{ valid, user }` |
| `GET` | `/health` | Health check |

## User management

Users are currently managed via environment variables on first start. A management
UI is planned for a future release. To add a user manually:

```sql
INSERT INTO sso_users (email, name, password_hash, active)
VALUES ('user@aceelectronics.com', 'First Last', '<bcrypt hash>', true);
```

Generate a bcrypt hash with: `node -e "const b=require('bcryptjs');b.hash('yourpassword',12).then(console.log)"`
