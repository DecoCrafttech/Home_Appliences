import { test, expect, type Page } from "@playwright/test";

// These tests exercise app behavior with a simulated Google provider.
// Real origin authorization remains under the Google Cloud OAuth client.
const customer = {
  id: "customer-b",
  full_name: "Customer B",
  email: "b@example.com",
  phone_e164: null,
  created_at: "2026-10-21",
};
const googleScript = `window.google={accounts:{id:{initialize:function(config){window.googleSignInCallback=config.callback;},renderButton:function(element){var button=document.createElement('button');button.textContent='Sign in with Google';button.onclick=function(){window.googleSignInCallback({credential:'test-credential'});};element.replaceChildren(button);},cancel:function(){},disableAutoSelect:function(){}}}};`;
type Options = {
  configMissing?: boolean;
  scriptBlocked?: boolean;
  tokenRejected?: boolean;
  sessionBlocked?: boolean;
  complete?: boolean;
};
async function setup(page: Page, options: Options = {}) {
  let signedIn = false;
  await page.route("https://accounts.google.com/gsi/client*", (route) =>
    options.scriptBlocked
      ? route.abort()
      : route.fulfill({
          contentType: "application/javascript",
          body: googleScript,
        }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({
        json: {
          data: {
            clientId: options.configMissing
              ? null
              : "test.apps.googleusercontent.com",
          },
        },
      });
    if (path.endsWith("/auth/customer/google")) {
      if (options.tokenRejected)
        return route.fulfill({
          status: 401,
          json: {
            error: {
              code: "INVALID_GOOGLE_CREDENTIAL",
              message: "Google sign-in could not be completed",
            },
          },
        });
      signedIn = true;
      return route.fulfill({
        json: { data: { created: true, profileComplete: !!options.complete } },
      });
    }
    if (path.endsWith("/auth/customer/me") && options.sessionBlocked)
      return route.fulfill({
        status: 401,
        json: { error: { code: "UNAUTHORIZED" } },
      });
    if (path.endsWith("/profile") || path.endsWith("/auth/customer/me"))
      return route.fulfill({
        json: {
          data: signedIn
            ? customer
            : { ...customer, id: "customer-a", full_name: "Customer A" },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
}
test("Google sign-in opens the profile for a new customer", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile\?next=/);
  await expect(page.getByText("Customer B", { exact: true })).toBeVisible();
});
test("sign-in clears the previous customer's cached profile", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/profile");
  await expect(page.getByText("Customer A", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await expect(page.getByText("Customer B", { exact: true })).toBeVisible();
  await expect(page.getByText("Customer A", { exact: true })).toHaveCount(0);
});
test("returns a signed-in customer to their selected appliance", async ({
  page,
}) => {
  await setup(page, { complete: true });
  await page.goto(
    "/login?next=" +
      encodeURIComponent("/request/service?applianceCategoryId=ac-test"),
  );
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/request\/service\?applianceCategoryId=ac-test/,
  );
});
test("rejects external return destinations", async ({ page }) => {
  await setup(page, { complete: true });
  await page.goto("/login?next=" + encodeURIComponent("//example.com"));
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:5173/");
});
test("shows a recoverable error when Google cannot verify the token", async ({
  page,
}) => {
  await setup(page, { tokenRejected: true });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Google could not verify your sign-in",
  );
  await expect(
    page.getByRole("button", { name: "Sign in with Google", exact: true }),
  ).toBeVisible();
});
test("does not report success if the browser cannot retain the session", async ({
  page,
}) => {
  await setup(page, { sessionBlocked: true });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "could not keep the sign-in session",
  );
  await expect(page).toHaveURL(/\/login$/);
});
test("explains an unavailable Google configuration", async ({ page }) => {
  await setup(page, { configMissing: true });
  await page.goto("/login");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
});
test("explains Google script loading failures", async ({ page }) => {
  await setup(page, { scriptBlocked: true });
  await page.goto("/login");
  await expect(page.getByRole("alert")).toContainText(
    "Unable to load Google sign-in",
  );
});
