const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const dockerfile = fs.readFileSync(path.resolve(__dirname, "../Dockerfile"), "utf8");
const commands = [...dockerfile.matchAll(/^RUN (sed[^\n]+) \\\s*$/gm)].map((match) => match[1]);

function normalize(lock, command) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guestflow-lock-"));
  try {
    fs.writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify(lock));
    execFileSync("sh", ["-c", command], { cwd: dir });
    return JSON.parse(fs.readFileSync(path.join(dir, "package-lock.json"), "utf8"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Docker normalizes both internal hosts over HTTP/HTTPS before install and after COPY", () => {
  assert.equal(commands.length, 2);
  assert.equal(commands[0], commands[1]);
  const copyIndex = dockerfile.indexOf("COPY . .");
  assert.ok(dockerfile.indexOf("RUN sed") < dockerfile.indexOf("npm ci"));
  assert.ok(dockerfile.lastIndexOf("RUN sed") > copyIndex);
  assert.ok(dockerfile.lastIndexOf("RUN sed") < dockerfile.indexOf("npm prune"));
  const urls = [
    "http://package-firewall.replit.local/npm/example/-/example-1.0.0.tgz",
    "https://package-firewall.replit.local/npm/example/-/example-1.0.0.tgz",
    "http://package-firewall.replit.internal/npm/example/-/example-1.0.0.tgz",
    "https://package-firewall.replit.internal/npm/example/-/example-1.0.0.tgz",
    "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
  ];
  const fixture = { lockfileVersion: 3, packages: Object.fromEntries(
    urls.map((url, index) => [`node_modules/example-${index}`, { version: "1.0.0", integrity: "unchanged", resolved: url }])
  ) };
  for (const command of commands) {
    const output = normalize(fixture, command);
    for (const entry of Object.values(output.packages)) {
      assert.equal(entry.resolved, "https://registry.npmjs.org/example/-/example-1.0.0.tgz");
      assert.equal(entry.version, "1.0.0");
      assert.equal(entry.integrity, "unchanged");
    }
  }
});

test("current lockfile loses internal addresses without changing versions or integrity", () => {
  const original = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package-lock.json"), "utf8"));
  const output = normalize(original, commands[0]);
  for (const [name, entry] of Object.entries(original.packages)) {
    const normalized = output.packages[name];
    assert.equal(normalized.version, entry.version, name);
    assert.equal(normalized.integrity, entry.integrity, name);
    if (normalized.resolved) assert.ok(!normalized.resolved.includes("package-firewall.replit."), name);
  }
  assert.equal(Object.keys(output.packages).length, Object.keys(original.packages).length);
});
