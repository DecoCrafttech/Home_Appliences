import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  estimate = "22222222-2222-4222-8222-222222222222";
test("estimate approval refreshes job data without refetching the customer profile", async ({
  page,
}) => {
  let approved = false,
    profiles = 0,
    estimates = 0;
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile")) {
      profiles++;
      return route.fulfill({
        json: {
          data: {
            id,
            full_name: "Estimate QA",
            created_at: "2026-10-01T00:00:00Z",
          },
        },
      });
    }
    if (path.endsWith(`/estimates/${estimate}/decision`)) {
      approved = true;
      return route.fulfill({
        json: { data: { id: estimate, state: "APPROVED" } },
      });
    }
    if (path.endsWith(`/requests/${id}/estimates`)) {
      estimates++;
      return route.fulfill({
        json: {
          data: [
            {
              id: estimate,
              version: 1,
              state: approved ? "APPROVED" : "AWAITING_CUSTOMER_APPROVAL",
              diagnosis: "Replacement part needed",
              items: [
                {
                  type: "Part",
                  description: "Replacement part",
                  quantity: 1,
                  unitPrice: 250,
                },
              ],
              subtotal_paise: 25000,
              tax_paise: 0,
              total_paise: 25000,
            },
          ],
        },
      });
    }
    if (path.endsWith(`/requests/${id}`))
      return route.fulfill({
        json: {
          data: {
            id,
            request_number: "QA-ESTIMATE",
            request_type: "SERVICE",
            appliance: "Air Conditioner",
            service_name: "Inspection",
            status: approved ? "IN_PROGRESS" : "ESTIMATE_PENDING_APPROVAL",
            version: approved ? 2 : 1,
            details: {},
            address_snapshot: {
              name: "Estimate QA",
              phone: "9876543210",
              line1: "QA street",
              area: "Adyar",
              city: "Chennai",
              state: "Tamil Nadu",
              pinCode: "600020",
            },
            preferred_date: "2099-11-01",
            preferred_time_window: "09:00-10:00",
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto(`http://localhost:5173/requests/${id}`);
  const button = page.getByRole("button", {
    name: "Approve estimate",
    exact: true,
  });
  await expect(button).toBeVisible();
  const before = profiles;
  await button.click();
  await expect(
    page.getByText("Estimate approved. Your technician has been notified.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(estimates).toBeGreaterThanOrEqual(2);
  expect(profiles).toBe(before);
  await expect(button).toHaveCount(0);
});
