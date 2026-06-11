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
| `SSO_BASE_URL` | optional | Public base URL of this service, e.g. `https://sso.aceelectronics.com`. Used to build password-reset links in emails (default: `http://localhost:PORT`). |
| `SMTP_HOST` | optional | SMTP server hostname. Required to enable email-based password resets. |
| `SMTP_PORT` | optional | SMTP server port (default: `587`). Use `465` for SSL. |
| `SMTP_USER` | optional | SMTP authentication username. |
| `SMTP_PASS` | optional | SMTP authentication password. |
| `SMTP_FROM` | optional | From address for reset emails (default: `noreply@APP_DOMAIN`). |

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

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/` | — | Login page (pass `?redirect_uri=...`) |
| `POST` | `/api/auth/login` | — | Validate credentials, set cookie, redirect |
| `GET` | `/api/auth/logout` | — | Clear cookie, redirect to login page |
| `GET` | `/api/auth/validate` | — | Validate JWT from cookie or Bearer header — returns `{ valid, user }` |
| `GET` | `/health` | — | Health check |
| `GET` | `/admin/users` | `ace_sso` cookie | Admin UI — list all SSO users |
| `POST` | `/admin/users` | `ace_sso` cookie | Create a new SSO user |
| `POST` | `/admin/users/:id/toggle` | `ace_sso` cookie | Activate or deactivate a user |
| `POST` | `/admin/users/:id/toggle-admin` | `ace_sso` cookie | Grant or revoke admin privilege (last-admin guard enforced) |
| `POST` | `/admin/users/:id/reset-password` | `ace_sso` cookie | Set a new password for a user directly |
| `POST` | `/admin/users/:id/send-reset` | `ace_sso` cookie | Email a password-reset link (requires SMTP config) |
| `GET` | `/reset-password?token=...` | — | Password reset form (linked from email) |
| `POST` | `/reset-password` | — | Submit new password via reset token |

## Admin UI

Visit `/admin/users` to manage SSO accounts. You must be signed in (valid `ace_sso` cookie).

From the admin UI you can:
- **View** all users with their status (active / inactive), admin badge, and join date
- **Create** a new user by providing name, email, and password
- **Set password** directly — click "Set Password" next to any user
- **Email a reset link** — click "Email Reset" (only shown when SMTP is configured); the link expires in 1 hour
- **Grant / Revoke Admin** — make any user an admin or remove their admin privileges; you cannot revoke your own admin status, and the last admin's privileges cannot be removed
- **Deactivate / Activate** accounts — deactivated users cannot sign in; you cannot deactivate your own account

> **Access control:** Only users with `is_admin = TRUE` in `sso_users` can access the admin panel. Any authenticated SSO user without admin privileges receives a 403 page. On first startup (or after a migration from an older version), the oldest existing user is automatically promoted to admin as a bootstrap measure.

### Self-service password reset (email flow)

When SMTP is configured and an admin clicks "Email Reset":
1. A one-time token (expires in 1 hour) is stored against the user record
2. An email is sent to the user's address with a link to `/reset-password?token=…`
3. The user visits the link, enters a new password, and the token is cleared

## User management

Users are managed through the `/admin/users` web UI (see above) or, for emergency access, via direct SQL:

```sql
INSERT INTO sso_users (email, name, password_hash, active)
VALUES ('user@aceelectronics.com', 'First Last', '<bcrypt hash>', true);
```

Generate a bcrypt hash with: `node -e "const b=require('bcryptjs');b.hash('yourpassword',12).then(console.log)"`
