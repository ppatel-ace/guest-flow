---
name: External deployment context
description: GuestFlow deployment reports can refer to Portainer rather than the Replit-hosted site.
---

The user is also building GuestFlow through Portainer on an external Docker host.

**Why:** On 2026-10-07 the user supplied Portainer Docker Compose build logs while troubleshooting delivery of the updated application. A working Replit preview or Replit publishing action does not establish whether this external build succeeded.

**How to apply:** Identify which hosting target the reported failure concerns. For Portainer, distinguish committing/pushing source, pulling or updating the stack, building the image, and verifying the external runtime. Do not attempt to run Docker in the Replit workspace or claim a complete external deployment based only on local application checks.
