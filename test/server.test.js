import assert from "node:assert/strict";
import test from "node:test";
import { createTokenScopeServer } from "../src/server.js";

const NOW = new Date();

function localDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fakeSnapshot() {
  const today = localDay(NOW);
  return {
    generatedAt: NOW.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    records: [
      {
        timestamp: Date.parse(`${today}T12:00:00`),
        day: today,
        harness: "codex",
        provider: "openai",
        providerInferred: false,
        model: "gpt-test",
        inputTokens: 100,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        inputKnown: true,
        outputKnown: true,
        requests: 1,
        sessionId: "one",
      },
      {
        timestamp: Date.parse(`${today}T12:30:00`),
        day: today,
        harness: "copilot",
        provider: "github-copilot",
        providerInferred: false,
        model: "claude-test",
        inputTokens: 0,
        outputTokens: 20,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        inputKnown: false,
        outputKnown: true,
        requests: 1,
        sessionId: "two",
      },
    ],
    sources: [
      { id: "codex", name: "Codex", detected: true, coverage: "full" },
      { id: "copilot", name: "Copilot", detected: true, coverage: "partial" },
    ],
    cache: { indexedFiles: 2, parsedFiles: 2, reusedFiles: 0, durationMs: 10 },
  };
}

function startServer() {
  const server = createTokenScopeServer({ scan: async () => fakeSnapshot() });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function getJson(server, pathname) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const body = await response.json();
  return { status: response.status, body };
}

test("usage endpoint scopes the report to a single requested harness", async () => {
  const server = await startServer();
  try {
    const scoped = await getJson(server, "/api/usage?range=today&harness=codex&refresh=1");
    assert.equal(scoped.status, 200);
    assert.equal(scoped.body.summary.knownTokens, 110);
    assert.deepEqual(
      scoped.body.breakdowns.harnesses.map((harness) => harness.name),
      ["codex"],
    );
  } finally {
    server.close();
  }
});

test("missing or empty harness parameter preserves the unscoped report", async () => {
  const server = await startServer();
  try {
    for (const query of ["?range=today", "?range=today&harness=", "?range=today&harness=%20"]) {
      const unscoped = await getJson(server, `/api/usage${query}&refresh=1`);
      assert.equal(unscoped.status, 200);
      assert.equal(unscoped.body.summary.knownTokens, 130);
      assert.equal(unscoped.body.summary.complete, false);
      assert.deepEqual(
        unscoped.body.breakdowns.harnesses.map((harness) => harness.name).sort(),
        ["codex", "copilot"],
      );
    }
  } finally {
    server.close();
  }
});

test("an unknown harness id yields an empty but well-formed report, not an error", async () => {
  const server = await startServer();
  try {
    const empty = await getJson(server, "/api/usage?range=today&harness=nope&refresh=1");
    assert.equal(empty.status, 200);
    assert.equal(empty.body.summary.knownTokens, 0);
    assert.deepEqual(empty.body.groups, []);
    assert.deepEqual(empty.body.daily, []);
    assert.ok(empty.body.range.key === "today");
    assert.ok(Array.isArray(empty.body.sources));
  } finally {
    server.close();
  }
});

test("dashboard modules required by the first paint are served", async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    for (const pathname of ["/app.js", "/i18n.js", "/format.js", "/harness-marks.js", "/styles.css"]) {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get("content-type"), /javascript|css/);
    }
  } finally {
    server.close();
  }
});

test("vendored Harness logos are served locally without path traversal", async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    const logo = await fetch(`http://127.0.0.1:${port}/logos/codex.svg`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get("content-type"), /svg/);
    const body = await logo.text();
    assert.match(body, /<svg/);
    assert.doesNotMatch(body, /cdn\.jsdelivr|unpkg\.com|githubusercontent/i);

    const missing = await fetch(`http://127.0.0.1:${port}/logos/no-such-harness.svg`);
    assert.equal(missing.status, 404);

    const nested = await fetch(`http://127.0.0.1:${port}/logos/foo/bar.svg`);
    assert.equal(nested.status, 404);
  } finally {
    server.close();
  }
});

// Guards the 完整数字 bridge end to end: if a script referenced by
// index.html 404s, the i18n module never installs window.tokenscopeI18n
// and app.js falls back to rendering ungrouped digits.
test("every asset referenced by index.html is served", async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    const html = await (
      await fetch(`http://127.0.0.1:${port}/index.html`)
    ).text();
    const references = [
      ...html.matchAll(/(?:src|href)="(\/[^"?]+)(?:\?[^"]*)?"/g),
    ].map((match) => match[1]);
    assert.ok(references.length > 0, "index.html should reference assets");
    for (const pathname of new Set(references)) {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
      assert.equal(response.status, 200, pathname);
    }
  } finally {
    server.close();
  }
});
