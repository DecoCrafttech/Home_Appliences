/* global document, localStorage, sessionStorage, console, window, Event */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

const sourceRoot = resolve(process.argv[2] || ".");
const measure = process.argv.includes("--measure");
const measurements = {};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
try {
  for (const app of ["customer", "admin", "technician"]) {
    const root = resolve(sourceRoot, `apps/${app}-pwa/dist`);
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
        let file = resolve(root, `.${pathname}`);
        if (file !== root && !file.startsWith(root + sep)) {
          res.writeHead(403).end();
          return;
        }
        if (!(await stat(file).catch(() => null))?.isFile())
          file = resolve(root, "index.html");
        res.writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(await readFile(file));
      } catch {
        res.writeHead(500).end();
      }
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const origin = `http://localhost:${server.address().port}`;
    const context = await browser.newContext({ serviceWorkers: "block" });
    try {
      const counts = {};
      await context.addInitScript(() => {
        localStorage.setItem("fixbeez.customer.onboarding.v1", "complete");
        for (const role of ["customer", "admin", "technician"])
          sessionStorage.setItem(`fixbeez.${role}.launched.v1`, "complete");
      });
      await context.route("https://accounts.google.com/gsi/client*", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: "window.google={accounts:{id:{initialize(){},renderButton(){},cancel(){},disableAutoSelect(){}}}};",
        }),
      );
      await context.route("**/api/v1/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        const headers = {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers":
            "content-type,x-csrf-token,idempotency-key",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        };
        if (route.request().method() === "OPTIONS")
          return route.fulfill({ status: 204, headers });
        counts[path] = (counts[path] || 0) + 1;
        if (path.endsWith("/auth/customer/config"))
          return route.fulfill({
            headers,
            json: { data: { clientId: null, adminOfficePhone: null } },
          });
        if (measure && app === "customer" && path === "/api/v1/profile")
          return route.fulfill({
            headers,
            json: {
              data: {
                id: "00000000-0000-4000-8000-000000000001",
                full_name: "Audit Customer",
                email: "audit@example.invalid",
                phone_e164: "+919876543210",
                account_status: "ACTIVE",
              },
            },
          });
        if (path.endsWith("/profile") || path.endsWith("/auth/me"))
          return route.fulfill({
            status: 401,
            headers,
            json: {
              error: { code: "UNAUTHORIZED", message: "Sign in required" },
            },
          });
        return route.fulfill({ headers, json: { data: [] } });
      });
      const page = await context.newPage();
      for (const size of [16, 32, 48, 180]) {
        const path =
          size === 180
            ? "/apple-touch-icon.png"
            : `/favicon-${size}x${size}.png`;
        const response = await context.request.get(origin + path);
        assert.equal(response.status(), 200, `${app}: ${path}`);
        const png = await response.body();
        assert.equal(png.readUInt32BE(16), size);
        assert.equal(png.readUInt32BE(20), size);
      }
      const favicon = await context.request.get(origin + "/favicon.ico");
      const ico = await favicon.body();
      assert.equal(favicon.status(), 200);
      assert.equal(ico.readUInt16LE(2), 1);
      assert.equal(ico.readUInt16LE(4), 3);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          /useLocation|Router.*context|Invalid hook|No QueryClient/.test(
            message.text(),
          )
        )
          errors.push(message.text());
      });
      for (const path of app === "customer"
        ? ["/login", "/services"]
        : app === "admin"
          ? ["/", "/requests"]
          : ["/technician", "/technician/jobs"]) {
        await page.goto(origin + path);
        await page
          .waitForFunction(
            () =>
              !!document.querySelector("main") ||
              /Unexpected Application Error|Something went wrong/.test(
                document.body.innerText,
              ),
            undefined,
            { timeout: 15000 },
          )
          .catch(() => {});
        assert.deepEqual(errors, [], `${app}${path}: JavaScript render errors`);
        assert.ok(
          await page.locator("main").count(),
          `${app}${path}: application content must render`,
        );
        assert.doesNotMatch(
          await page.locator("body").innerText(),
          /Unexpected Application Error|useLocation\(\).*Router|Something went wrong/,
        );
        if (app !== "customer")
          assert.ok(
            await page.locator('input[type="password"]').count(),
            `${app}: unauthenticated login form must render`,
          );
      }
      if (measure) {
        const phase = async (action) => {
          const before = { ...counts };
          await action();
          await page.waitForTimeout(250);
          return Object.fromEntries(
            Object.entries(counts)
              .map(([key, value]) => [key, value - (before[key] || 0)])
              .filter(([, value]) => value),
          );
        };
        const focus = async () => {
          for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
              window.dispatchEvent(new Event("focus"));
              document.dispatchEvent(
                new Event("visibilitychange", { bubbles: true }),
              );
            });
            await page.waitForTimeout(200);
          }
        };
        const focusCalls = await phase(focus);
        let navigationCalls = {},
          requestCalls = {};
        if (app === "customer") {
          navigationCalls = await phase(async () => {
            for (let i = 0; i < 3; i++) {
              await page
                .getByRole("link", { name: "Home", exact: true })
                .first()
                .click();
              await page.waitForTimeout(150);
              await page
                .getByRole("link", { name: "Services", exact: true })
                .first()
                .click();
              await page.waitForTimeout(150);
            }
          });
          requestCalls = await phase(async () => {
            await page
              .getByRole("link", { name: "My Requests", exact: true })
              .first()
              .click();
            await page.waitForTimeout(250);
            await focus();
          });
        }
        assert.deepEqual(
          errors,
          [],
          `${app}: no runtime errors during API measurement`,
        );
        measurements[app] = {
          focusCycles: 3,
          navigationCycles: app === "customer" ? 3 : 0,
          focusCalls,
          navigationCalls,
          requestCalls,
          totalCounts: counts,
        };
      }
      console.log(
        `PASS: ${app} production browser rendering and nested-route refresh (mocked API)`,
      );
    } finally {
      await context.close();
      await new Promise((done) => server.close(done));
    }
  }
} finally {
  await browser.close();
}
if (measure) {
  const reportIndex = process.argv.indexOf("--report");
  if (reportIndex >= 0) {
    const destination = resolve(process.argv[reportIndex + 1]);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await writeFile(destination, JSON.stringify(measurements, null, 2));
  }
  console.log(JSON.stringify(measurements, null, 2));
}
