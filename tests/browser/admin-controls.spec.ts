import { test, expect, type Page } from "@playwright/test";
type TechBody = {
  fullName: string;
  phone: string;
  serviceArea: string;
  verificationStatus: string;
};
type Tech = {
  id: string;
  full_name: string;
  phone: string;
  account_status: string;
  service_area: string;
  verification_status: string;
  assigned_requests: number;
};
async function setup(page: Page) {
  const state = {
    staff: {
      id: "11111111-1111-4111-8111-111111111111",
      username: "ui_qa",
      full_name: "UI QA Admin",
      role: "ADMIN",
      must_change_password: false,
    },
    technicians: [] as Tech[],
    passwordCalls: 0,
  };
  const mapTech = (body: TechBody, id: string): Tech => ({
    id,
    full_name: body.fullName,
    phone: body.phone,
    account_status: "ACTIVE",
    service_area: body.serviceArea,
    verification_status: body.verificationStatus,
    assigned_requests: 0,
  });
  await page.route("**/api/v1/admin/**", (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({ json: { data: state.staff } });
    if (path.endsWith("/technician-workflow"))
      return route.fulfill({
        json: { data: { accounts: [], reports: [], assignments: [] } },
      });
    if (path.endsWith("/auth/profile")) {
      state.staff = {
        ...state.staff,
        full_name: request.postDataJSON().fullName,
      };
      return route.fulfill({ json: { data: state.staff } });
    }
    if (path.endsWith("/auth/password")) {
      state.passwordCalls++;
      return route.fulfill({
        status: 403,
        json: { error: { message: "Current password is incorrect" } },
      });
    }
    if (path.endsWith("/operations"))
      return route.fulfill({
        json: {
          data: {
            totals: [
              { request_type: "SERVICE", status: "IN_PROGRESS", count: 3 },
            ],
            activity: [],
          },
        },
      });
    if (path.endsWith("/technicians") && request.method() === "GET")
      return route.fulfill({ json: { data: state.technicians } });
    if (path.endsWith("/technicians") && request.method() === "POST") {
      const tech = mapTech(
        request.postDataJSON(),
        "22222222-2222-4222-8222-222222222222",
      );
      state.technicians.push(tech);
      return route.fulfill({ status: 201, json: { data: tech } });
    }
    if (
      path.includes("/technicians/") &&
      path.endsWith("/account") &&
      request.method() === "GET"
    ) {
      const id = path.split("/").at(-2)!;
      const tech = state.technicians.find((item) => item.id === id);
      return route.fulfill({
        json: {
          data: tech
            ? {
                username: "ui_qa_technician",
                email: null,
                status: tech.account_status,
                must_change_password: false,
              }
            : null,
        },
      });
    }
    if (
      path.includes("/technicians/") &&
      path.endsWith("/account") &&
      request.method() === "PATCH"
    ) {
      const id = path.split("/").at(-2)!;
      const tech = state.technicians.find((item) => item.id === id);
      if (tech) tech.account_status = request.postDataJSON().status;
      return route.fulfill({
        json: { data: { status: tech?.account_status } },
      });
    }
    if (path.includes("/technicians/") && request.method() === "PATCH") {
      const tech = mapTech(request.postDataJSON(), path.split("/").pop()!);
      state.technicians = [tech];
      return route.fulfill({ json: { data: tech } });
    }
    if (path.includes("/technicians/") && request.method() === "DELETE") {
      state.technicians = [];
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { data: [] } });
  });
  return state;
}
test("report export downloads the fetched counts as CSV", async ({ page }) => {
  await setup(page);
  await page.goto("http://127.0.0.1:5174/reports");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export report", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("request-report.csv");
  let csv = "";
  for await (const chunk of (await download.createReadStream())!)
    csv += chunk.toString();
  expect(csv).toContain("SERVICE,IN_PROGRESS,3");
});
test("profile save refreshes identity and password errors preserve form input", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("http://127.0.0.1:5174/settings");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Updated UI QA Admin");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator(".profile-menu strong")).toHaveText(
    "Updated UI QA Admin",
  );
  await page
    .getByLabel("Current password", { exact: true })
    .fill("old-test-password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-password-one-123");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("new-password-two-456");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByText("New passwords do not match.", { exact: true }),
  ).toBeVisible();
  expect(state.passwordCalls).toBe(0);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("new-password-one-123");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByText("Current password is incorrect", { exact: true }),
  ).toBeVisible();
  expect(state.passwordCalls).toBe(1);
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toHaveValue("old-test-password");
});
test("technician editor omits skills and availability and archive requires confirmation", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("http://127.0.0.1:5174/technicians");
  await page
    .getByRole("button", { name: "Add technician", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("UI QA Technician");
  await page
    .getByLabel("Temporary password", { exact: true })
    .fill("Temporary!Secure123");
  await page
    .getByLabel("Confirm temporary password", { exact: true })
    .fill("Temporary!Secure123");
  await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
  await expect(page.getByLabel("Skills", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Availability", { exact: true })).toHaveCount(0);
  await page.getByLabel("Service area", { exact: true }).fill("Chennai");
  await page.getByLabel("Verification").selectOption("VERIFIED");
  await page
    .getByRole("button", { name: "Save technician", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "UI QA Technician" }),
  ).toBeVisible();
  expect(state.technicians[0]?.verification_status).toBe("VERIFIED");
  await page.getByLabel("More actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Edit / verify", exact: true })
    .click();
  await expect(page.getByLabel("Skills", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Availability", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save technician", exact: true })
    .click();
  expect(state.technicians[0]?.service_area).toBe("Chennai");
  await page.getByLabel("More actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Freeze account", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Freeze account", exact: true })
    .click();
  expect(state.technicians[0]?.account_status).toBe("SUSPENDED");
  await page.getByLabel("More actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Unfreeze account", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Unfreeze account", exact: true })
    .click();
  expect(state.technicians[0]?.account_status).toBe("ACTIVE");
  await page.getByLabel("More actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Remove technician", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.technicians).toHaveLength(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove technician", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No technicians found", exact: true }),
  ).toBeVisible();
  expect(state.technicians).toHaveLength(0);
});
