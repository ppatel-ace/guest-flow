import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { normalizeAceHostname, guardProductionPublicPages } from "./publicPageRouting";

test("production routing allows RSVP entry and normal public pages without exposing staff pages", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(normalizeAceHostname);
  app.use(guardProductionPublicPages);
  app.use((req, res) => res.json({ page: req.path, query: req.query }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (path: string, host = "aceregistration.replit.app") =>
    fetch(base + path, { redirect: "manual", headers: { "X-Forwarded-Host": host } });
  try {
    for (const path of ["/rsvp-arrival", "/rsvp-arrival/", "/guest-check-in",
      "/scan", "/kiosk", "/api/rsvp-guest/context", "/assets/index.js", "/logos/ace.jpg"]) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("location"), null, path);
    }
    const rsvp = await request("/rsvp-arrival?entry=desk");
    assert.deepEqual(await rsvp.json(), { page: "/rsvp-arrival", query: { entry: "desk" } });
    for (const path of ["/", "/customers", "/rsvp-check-in", "/rsvp-arrival-other"]) {
      const response = await request(path);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "/guest-check-in");
    }
    const canonical = await request("/rsvp-check-in", "guestflow.aceelectronics.com");
    assert.equal(canonical.status, 200);
    const normalized = await request("/rsvp-arrival?entry=desk", "arrival.aceelectronics.com");
    assert.equal(normalized.status, 301);
    assert.equal(normalized.headers.get("location"), "https://guestflow.aceelectronics.com/rsvp-arrival?entry=desk");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
