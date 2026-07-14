---
name: pg Pool SSL + connectionString conflict
description: When pg.Pool receives connectionString with ?sslmode=... AND an explicit ssl:{} option, the URL parser wins — causing "self-signed certificate" errors.
---

## Rule
When creating a `pg.Pool` with a `connectionString` that contains `?sslmode=...`, strip the `sslmode` parameter from the URL before passing it to the pool, then set the `ssl` option explicitly.

**Why:** `pg`'s URL parser reads `sslmode` from the connection string and sets its own TLS options (including `rejectUnauthorized: true` for `verify-full`). This overrides any `ssl: {}` object you pass directly, making it impossible to force `rejectUnauthorized: false` any other way.

**How to apply:** Whenever building a `pg.Pool` (e.g. for `connect-pg-simple` session store) with a remote DATABASE_URL:
```typescript
const parsed = new URL(dbUrl);
parsed.searchParams.delete("sslmode");   // remove before passing
const pool = new Pool({
  connectionString: parsed.toString(),
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
```
Supabase pooler always uses a self-signed cert; Neon and other cloud DBs may also fail with strict verification. `rejectUnauthorized: false` is safe for app-layer sessions (data is still encrypted, only cert identity is unchecked).
