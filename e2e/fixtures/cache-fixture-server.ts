/**
 * Cache Fixture Server
 *
 * A minimal Node.js **HTTPS** server for integration-testing real browser
 * HTTP cache behaviour.
 *
 * ## Purpose
 *
 * Playwright's `page.route()` + `route.fulfill()` bypasses the browser HTTP
 * cache: every matched request gets a freshly synthesised response regardless
 * of cache headers. This makes it impossible to write a test that fails when
 * `cache: 'no-cache'` is removed from a fetch call.
 *
 * This server solves the problem by running as a real HTTPS server on
 * localhost and using Playwright's `route.continue({ url })` to redirect
 * intercepted `https://api.github.com/…` requests to this server at the same
 * protocol (HTTPS → HTTPS).  The browser then goes through its full HTTP
 * cache pipeline for the fixture URL:
 *
 * - The fixture serves `Cache-Control: public, max-age=60` so the browser
 *   caches the first response.
 * - On reload, `fetch({ cache: 'no-cache' })` bypasses that cache and the
 *   fixture server receives a fresh request, returning updated state (v2).
 * - Without `cache: 'no-cache'`, the browser returns the cached v1 and the
 *   fixture server is NOT hit; the assertion on v2 data fails.
 *
 * A self-signed TLS certificate is generated via the system `openssl` binary
 * at server startup (≈150 ms).  Tests must use `ignoreHTTPSErrors: true`.
 *
 * ## Typical test pattern
 *
 * ```ts
 * test.use({ ignoreHTTPSErrors: true });
 *
 * let fixture: CacheFixtureServer;
 * test.beforeAll(async () => { fixture = await startCacheFixtureServer(); });
 * test.afterAll(async () => { await fixture.close(); });
 *
 * test('cache is bypassed on reload', async ({ page }) => {
 *   // Prime state v1
 *   fixture.setResponse('/repos/o/r/issues/1/comments', [{ body: '...v1...' }]);
 *
 *   // Redirect the real api.github.com URL to the fixture server
 *   await page.route('https://api.github.com/**', async (route) => {
 *     await route.continue({ url: fixture.rewriteUrl(route.request().url()) });
 *   });
 *
 *   await page.goto('/o/r/1');         // first load — caches v1 in browser
 *
 *   // Advance fixture server state to v2
 *   fixture.setResponse('/repos/o/r/issues/1/comments', [{ body: '...v2...' }]);
 *   await page.reload();
 *   // With cache:'no-cache': browser bypasses cache → fixture returns v2 → PASS ✓
 *   // Without cache:'no-cache': cache HIT → stale v1 returned → FAIL ✓
 * });
 * ```
 *
 * ## Reusability
 *
 * The server is intentionally generic: callers configure it entirely through
 * `setResponse()` / `getResponse()`.  It can serve any JSON endpoint.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";

// ============================================================================
// Public interface
// ============================================================================

export interface CacheFixtureServer {
  /** TCP port the server is listening on */
  readonly port: number;

  /**
   * Rewrite an api.github.com URL to point at this fixture server.
   * Preserves the path and query string; replaces the origin only.
   *
   * The returned URL uses `https://127.0.0.1:<port>` so that Playwright's
   * `route.continue({ url })` — which requires the same protocol as the
   * original intercepted URL — accepts it for `https://api.github.com/…`
   * requests.  Pair with `test.use({ ignoreHTTPSErrors: true })` to accept
   * the self-signed certificate.
   */
  rewriteUrl(originalUrl: string): string;

  /**
   * Set the JSON response body returned for the given URL path.
   *
   * The server always responds with HTTP 200 and
   * `Cache-Control: public, max-age=60` (same as api.github.com) so the
   * browser will cache the response unless asked not to.
   */
  setResponse(path: string, body: unknown): void;

  /**
   * Return the current response body stored for the given URL path, or
   * `undefined` if no response has been set.
   *
   * Use this in a Playwright `route.fulfill()` handler to read the fixture
   * server's current state when simulating HTTP cache behaviour.
   */
  getResponse(path: string): unknown;

  /**
   * Return how many times the given path has been requested since the server
   * started (or since `resetCounts()` was last called).
   *
   * Query strings are ignored when counting (path key is stripped at `?`).
   */
  getRequestCount(path: string): number;

  /** Reset all per-path request counters to zero. */
  resetCounts(): void;

  /** Gracefully stop the server. */
  close(): Promise<void>;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Start a cache fixture server and wait until it is ready to accept
 * connections.  The OS assigns a free port (listen on port 0).
 *
 * A temporary self-signed TLS certificate is generated via the system
 * `openssl` binary, read into memory, and the temporary files are deleted
 * before the server starts accepting connections.  Tests using this server
 * must set `ignoreHTTPSErrors: true` (via `test.use({ ignoreHTTPSErrors:
 * true })`) to accept the self-signed certificate.
 */
export async function startCacheFixtureServer(): Promise<CacheFixtureServer> {
  const responses: Map<string, unknown> = new Map();
  const counts: Map<string, number> = new Map();

  // Generate a self-signed certificate for 127.0.0.1 using the system openssl
  // binary (~150 ms).  Files are written to a temp directory, read into
  // memory, then the directory is deleted so no key material lingers on disk.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cache-fixture-"));
  let key: Buffer;
  let cert: Buffer;
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        path.join(tmpDir, "key.pem"),
        "-out",
        path.join(tmpDir, "cert.pem"),
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1",
      ],
      { stdio: "ignore" }
    );
    key = fs.readFileSync(path.join(tmpDir, "key.pem"));
    cert = fs.readFileSync(path.join(tmpDir, "cert.pem"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }

  const server = https.createServer({ key, cert }, (req, res) => {
    // CORS preflight: the page origin (http://localhost) is cross-origin to
    // the fixture server (http://127.0.0.1:PORT). The JS fetch also sends
    // non-simple headers (Authorization, Cache-Control), triggering a
    // preflight OPTIONS request before every GET.
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Accept, Cache-Control, Pragma",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    const rawPath = req.url ?? "/";
    // Normalise path: strip query string for key lookup and counting
    const pathKey = rawPath.split("?")[0] ?? rawPath;

    counts.set(pathKey, (counts.get(pathKey) ?? 0) + 1);

    const body = responses.get(pathKey);

    if (body === undefined) {
      res.writeHead(404, {
        "Content-Type": "application/json",
        // No caching for 404s — they indicate a test configuration issue
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ message: "Not Found (cache-fixture-server)" }));
      return;
    }

    const json = JSON.stringify(body);
    res.writeHead(200, {
      "Content-Type": "application/json",
      // Mirrors api.github.com cache headers so the browser caches the
      // response for up to 60 s, reproducing the exact production scenario
      // that triggered issue #494.
      "Cache-Control": "public, max-age=60",
      "Content-Length": Buffer.byteLength(json).toString(),
      "Access-Control-Allow-Origin": "*",
    });
    res.end(json);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Listen on 127.0.0.1 (loopback) — no risk of exposing the fixture port
    // on a shared network interface during CI runs.
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const { port } = server.address() as { port: number };

  return {
    port,

    rewriteUrl(originalUrl: string): string {
      const url = new URL(originalUrl);
      return `https://127.0.0.1:${port}${url.pathname}${url.search}`;
    },

    setResponse(path: string, body: unknown): void {
      responses.set(path, body);
    },

    getResponse(path: string): unknown {
      return responses.get(path);
    },

    getRequestCount(path: string): number {
      return counts.get(path) ?? 0;
    },

    resetCounts(): void {
      counts.clear();
    },

    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
