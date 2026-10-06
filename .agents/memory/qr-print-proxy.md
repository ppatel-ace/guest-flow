---
name: QR print windows behind the preview proxy
description: Why branded print windows embed the logo instead of requesting it from a proxied app.
---

Embed the company logo and QR as data images in a dedicated print window.

**Why:** During browser verification, an external logo request from a same-origin `about:blank` print window remained pending through the preview proxy. Its unloaded image kept the print window from finishing loading. Embedding the already loaded company image made the printout reliable and self-contained.

**How to apply:** Use self-contained image assets for branded printouts instead of relying on image requests from the new window.
