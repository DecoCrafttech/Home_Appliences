/* global document, localStorage, sessionStorage, console */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

const sourceRoot = resolve(process.argv[2] || ".");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
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
        if (path.endsWith("/auth/customer/config"))
          return route.fulfill({
            headers,
            json: { data: { clientId: null, adminOfficePhone: null } },
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
