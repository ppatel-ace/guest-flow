---
name: Shared database connection budget
description: Supabase session connections are shared across running services and integration tests.
---

Keep database integration-test concurrency modest when other application processes are running; their connections share the same remote session-pool budget.

**Why:** The Supabase pool rejected concurrent integration requests with a session-mode maximum-client error even though individual reads and writes succeeded. The reported session-pool limit was 12.

**How to apply:** Distinguish pool exhaustion from application logic failures. Retain meaningful concurrent-request tests, but budget their connections alongside development and other services. Do not blindly increase client-pool sizes.
