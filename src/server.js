import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanUsage } from "./indexer.js";
import { buildReport } from "./report.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function sendStatic(response, route) {
  const [fileName, contentType] = STATIC_FILES.get(route);
  const filePath = path.join(PUBLIC_ROOT, fileName);
  const fileStat = await stat(filePath);
  response.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": contentType,
    "Content-Length": fileStat.size,
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(response);
}

export function createTokenScopeServer({
  scan = scanUsage,
  memoryTtlMs = 15_000,
} = {}) {
  let snapshot = null;
  let snapshotTime = 0;
  let scanPromise = null;

  async function getSnapshot(refresh) {
    const stale = Date.now() - snapshotTime > memoryTtlMs;
    if (!snapshot || refresh || stale) {
      if (!scanPromise) {
        scanPromise = scan()
          .then((next) => {
            snapshot = next;
            snapshotTime = Date.now();
            return next;
          })
          .finally(() => {
            scanPromise = null;
          });
      }
      return scanPromise;
    }
    return snapshot;
  }

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");

    try {
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Only GET is supported." });
        return;
      }

      if (requestUrl.pathname === "/api/health") {
        sendJson(response, 200, { ok: true, indexing: Boolean(scanPromise) });
        return;
      }

      if (requestUrl.pathname === "/api/usage") {
        const refresh = requestUrl.searchParams.get("refresh") === "1";
        const harness = (requestUrl.searchParams.get("harness") || "").trim();
        const harnesses = harness
          ? [harness]
          : (requestUrl.searchParams.get("harnesses") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        const current = await getSnapshot(refresh);
        const report = buildReport(current, {
          range: requestUrl.searchParams.get("range") || "30d",
          harnesses,
        });
        sendJson(response, 200, report);
        return;
      }

      if (STATIC_FILES.has(requestUrl.pathname)) {
        await sendStatic(response, requestUrl.pathname);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      sendJson(response, 500, {
        error: "TokenScope could not build the local usage report.",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function parsePort(argv) {
  const argument = argv.find((value) => value.startsWith("--port="));
  const candidate = argument?.split("=")[1] || process.env.PORT || "4317";
  const port = Number(candidate);
  return Number.isInteger(port) && port > 0 && port < 65_536 ? port : 4317;
}

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntryPoint) {
  const port = parsePort(process.argv.slice(2));
  const host = "127.0.0.1";
  const server = createTokenScopeServer();
  server.listen(port, host, () => {
    console.log(`TokenScope is running at http://${host}:${port}`);
    console.log("The first scan can take a moment; later scans reuse the local index.");
  });
}
