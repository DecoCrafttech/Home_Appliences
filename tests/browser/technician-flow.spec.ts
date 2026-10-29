import { test, expect, type Page } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const assignment = "22222222-2222-4222-8222-222222222222";
type State = {
  status: string;
  assignmentState: string;
  version: number;
  reports: Array<{
    id: string;
    state: string;
    outcome: string;
    work_summary: string;
  }>;
  estimates: Array<{
    id: string;
    state: string;
    diagnosis: string;
    total_paise: number;
    items: unknown[];
  }>;
};
async function setup(page: Page, initial: Partial<State> = {}) {
  const state: State = {
    status: "TECHNICIAN_ASSIGNED",
    assignmentState: "ACCEPTED",
    version: 1,
    reports: [],
    estimates: [],
    ...initial,
  };
  const writes: Array<{
    path: string;
    body: Record<string, unknown>;
    key: string | undefined;
  }> = [];
  let completeFailure = false;
  const profile = {
    id,
    full_name: "Arun Kumar",
    username: "arun",
    phone: "+919876543210",
    email: "arun@example.com",
    csrfToken: "a".repeat(43),
    verification_status: "VERIFIED",
    account_status: "ACTIVE",
    availability: "AVAILABLE",
    skills: "Air Conditioner",
    service_area: "Chennai",
    working_hours: { start: "09:00", end: "18:00" },
    leave_dates: [],
    completed_count: 4,
    average_rating: null,
    mfa_enabled: false,
  };
  function job() {
    return {
      id,
      assignment_id: assignment,
      assignment_version: 1,
      assignment_state: state.assignmentState,
      version: state.version,
      request_number: "SR-101",
      request_type: "SERVICE",
      appliance: "Air Conditioner",
      service_name: "Cooling inspection",
      status: state.status,
      area: "Adyar",
      preferred_date: "2099-10-25",
      preferred_time_window: "09:00-12:00",
      ...(state.assignmentState === "ACCEPTED"
        ? {
            confirmed_date:
              state.status === "TECHNICIAN_ASSIGNED" ? undefined : "2099-10-26",
            confirmed_time_window: "09:00-12:00",
            customer: { full_name: "Priya Kumar", phone_e164: "+919876543210" },
            address_snapshot: {
              line1: "12 Lake Road",
              area: "Adyar",
              city: "Chennai",
              state: "Tamil Nadu",
              pinCode: "600020",
            },
            details: { description: "The air conditioner is not cooling." },
            checklist: [
              "Issue assessed",
              "Safety checks complete",
              "Customer informed",
            ],
            estimates: state.estimates,
            reports: state.reports,
          }
        : {}),
    };
  }
  await page.route("**/api/v1/technician/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      if (path.endsWith("/auth/me"))
        return route.fulfill({ json: { data: profile } });
      if (path.endsWith(`/jobs/${id}`))
        return route.fulfill({ json: { data: job() } });
      if (path.endsWith("/dashboard"))
        return route.fulfill({
          json: {
            data: {
              pending: 0,
              today: 1,
              in_progress: 1,
              completed_today: 2,
              next_jobs: [job()],
            },
          },
        });
      if (path.endsWith("/jobs"))
        return route.fulfill({
          json: {
            data: [job()],
            meta: { total: 1 },
          },
        });
      if (path.endsWith("/profile/photo"))
        return route.fulfill({ json: { data: { url: null } } });
      return route.fulfill({ json: { data: [] } });
    }
    const body = request.postDataJSON();
    writes.push({ path, body, key: request.headers()["idempotency-key"] });
    if (path.endsWith("/complete") && completeFailure) {
      completeFailure = false;
      return route.fulfill({
        status: 503,
        json: { error: { message: "Completion interrupted. Please retry." } },
      });
    }
    const statuses: Record<string, string> = {
      "on-the-way": "TECHNICIAN_EN_ROUTE",
      arrived: "TECHNICIAN_ARRIVED",
      start: "IN_PROGRESS",
      complete: "COMPLETED",
    };
    const action = path.split("/").at(-1)!;
    if (statuses[action]) state.status = statuses[action];
    if (action === "estimates") {
      state.status = "ESTIMATE_PENDING_APPROVAL";
      state.estimates = [
        {
          id: assignment,
          state: "AWAITING_CUSTOMER_APPROVAL",
          diagnosis: String(body.diagnosis),
          total_paise: 25000,
          items: body.items,
        },
      ];
    }
    if (action === "work-report")
      state.reports = [
        {
          id: assignment,
          state: "SUBMITTED_FOR_REVIEW",
          outcome: body.outcome,
          work_summary: body.workSummary,
        },
      ];
    if (path.endsWith("/profile")) {
      profile.full_name = body.fullName;
      profile.phone = body.phone;
    }
    state.version++;
    return route.fulfill({ json: { data: { id } } });
  });
  return {
    state,
    writes,
    failCompletion: () => {
      completeFailure = true;
    },
  };
}
async function tripleClick(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).evaluate((node) => {
    for (let i = 0; i < 3; i++) (node as HTMLButtonElement).click();
  });
}

for (const width of [360, 1440])
  test(`card completes a job with its required report at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, writes } = await setup(page, {
      status: "IN_PROGRESS",
      assignmentState: "ACCEPTED",
    });
    await page.goto("http://127.0.0.1:5175/technician/jobs?view=in-progress");
    await page
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Complete this job?",
      exact: true,
    });
    await expect(
      dialog.getByLabel("Work performed", { exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(0);
    await dialog
      .getByLabel("Work performed", { exact: true })
      .fill("Cleaned filters and verified cooling.");
    for (const check of await dialog.getByRole("checkbox").all())
      await check.check();
    await tripleClick(page, "Confirm completion");
    await expect(dialog).toHaveCount(0);
    expect(state.status).toBe("COMPLETED");
    expect(
      writes.filter((write) => write.path.endsWith("/work-report")),
    ).toHaveLength(1);
    expect(
      writes.filter((write) => write.path.endsWith("/complete")),
    ).toHaveLength(1);
    expect(
      writes.find((write) => write.path.endsWith("/complete"))!.body.version,
    ).toBe(2);
  });

test("card completion retry retains the saved report and does not submit it twice", async ({
  page,
}) => {
  const { writes, failCompletion } = await setup(page, {
    status: "IN_PROGRESS",
    assignmentState: "ACCEPTED",
  });
  failCompletion();
  await page.goto("http://127.0.0.1:5175/technician/jobs?view=in-progress");
  await page.getByRole("button", { name: "Complete job", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Work performed", { exact: true })
    .fill("Checked cooling and completed repair.");
  for (const check of await dialog.getByRole("checkbox").all())
    await check.check();
  await tripleClick(page, "Confirm completion");
  await expect(dialog.getByRole("alert")).toContainText(
    "Completion interrupted",
  );
  await expect(
    dialog.getByLabel("Work performed", { exact: true }),
  ).toHaveCount(0);
  await tripleClick(page, "Confirm completion");
  await expect(dialog).toHaveCount(0);
  expect(
    writes.filter((write) => write.path.endsWith("/work-report")),
  ).toHaveLength(1);
  const completion = writes.filter((write) => write.path.endsWith("/complete"));
  expect(completion).toHaveLength(2);
  expect(completion[0]!.key).toBe(completion[1]!.key);
});

for (const width of [390, 1440])
  test(`workday and profile stay compact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, { status: "IN_PROGRESS", assignmentState: "ACCEPTED" });
    await page.goto("http://127.0.0.1:5175/technician");
    await expect(
      page.getByRole("button", { name: "Complete job", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/request-simple/tech-home-${width}.png`,
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:5175/technician/profile");
    await expect(
      page.getByRole("button", { name: "Save availability", exact: true }),
    ).toBeHidden();
    await expect(page.getByText("Availability", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Account Security", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Skills", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Full name", { exact: true })).toBeHidden();
    await page.screenshot({
      path: `test-results/request-simple/tech-profile-${width}.png`,
      fullPage: true,
    });
  });

for (const width of [360, 1440])
  test(`technician works an immediately assigned job at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, writes } = await setup(page);
    await page.goto(`http://127.0.0.1:5175/technician/jobs/${id}`);
    await expect(
      page.getByRole("button", { name: "Accept job", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Decline job", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Reason for declining", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Diagnosis and additional work estimate", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Work report", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveAttribute(
      "href",
      "tel:+919876543210",
    );
    expect(writes).toHaveLength(0);
    await expect(
      page.getByText("Awaiting appointment confirmation by operations.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "On the way", exact: true }),
    ).toHaveCount(0);
    state.status = "APPOINTMENT_CONFIRMED";
    state.version++;
    await page.reload();
    await expect(
      page.getByRole("link", { name: /Call Customer/ }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await expect(
      page.getByRole("link", { name: "Get Directions", exact: true }),
    ).toHaveAttribute("href", /maps\/dir/);
    await expect(
      page.getByRole("button", { name: /Copy address|Share Location/ }),
    ).toHaveCount(0);
    await expect(
      page.getByText("The air conditioner is not cooling.", { exact: true }),
    ).toHaveCount(0);
    for (const [label, suffix] of [
      ["On the way", "on-the-way"],
      ["I have arrived", "arrived"],
      ["Start work", "start"],
    ]) {
      await expect(
        page.getByRole("button", { name: label!, exact: true }),
      ).toBeVisible();
      await tripleClick(page, label!);
      await expect
        .poll(
          () =>
            writes.filter((write) => write.path.endsWith(`/${suffix}`)).length,
        )
        .toBe(1);
    }
    await expect(
      page.getByRole("button", { name: "Complete job", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Work performed", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByLabel("Work performed", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Parts used", { exact: true })).toBeHidden();
    await expect(
      page.getByLabel("Unresolved issues", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Outcome", exact: true })
      .selectOption("UNRESOLVED");
    await page
      .getByLabel("Unresolved issues", { exact: true })
      .fill("Awaiting a part");
    await page
      .getByRole("combobox", { name: "Outcome", exact: true })
      .selectOption("RESOLVED");
    await page
      .getByLabel("Work performed", { exact: true })
      .fill("Cleaned the filters and verified cooling.");
    for (const checkbox of await page.getByRole("checkbox").all())
      await checkbox.check();
    await page.screenshot({
      path: `test-results/technician-flow/report-${width}.png`,
      fullPage: true,
    });
    await tripleClick(page, "Submit work report");
    await expect(
      page.getByRole("button", { name: "Complete job", exact: true }),
    ).toBeVisible();
    expect(
      writes.filter((write) => write.path.endsWith("/work-report")),
    ).toHaveLength(1);
    expect(
      writes.find((write) => write.path.endsWith("/work-report"))!.body
        .unresolvedIssues,
    ).toBe("");
    await page
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(
      writes.filter((write) => write.path.endsWith("/complete")),
    ).toHaveLength(0);
    await page
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    await tripleClick(page, "Confirm completion");
    await expect(
      page.getByText("Job completed", { exact: true }),
    ).toBeVisible();
    expect(
      writes.filter((write) => write.path.endsWith("/complete")),
    ).toHaveLength(1);
    await expect(
      page.getByRole("button", { name: "Submit work report", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });

test("legacy estimate approval blocks completion without exposing the removed editor", async ({
  page,
}) => {
  const { state } = await setup(page, {
    status: "ESTIMATE_PENDING_APPROVAL",
    assignmentState: "ACCEPTED",
    estimates: [
      {
        id: assignment,
        state: "AWAITING_CUSTOMER_APPROVAL",
        diagnosis: "Existing estimate",
        total_paise: 25000,
        items: [],
      },
    ],
  });
  await page.goto(`http://127.0.0.1:5175/technician/jobs/${id}`);
  await expect(
    page.getByText(
      "Waiting for customer approval. Additional work and completion are paused.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit work report", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Diagnosis and additional work estimate", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Appliance details and customer notes", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Contact operations", { exact: true }),
  ).toHaveCount(0);
  state.status = "IN_PROGRESS";
  state.estimates[0]!.state = "APPROVED";
  state.version++;
  await page.reload();
  await expect(
    page.getByLabel("Work performed", { exact: true }),
  ).toBeVisible();
});

test("assigned job has no accept or decline actions", async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto(`http://127.0.0.1:5175/technician/jobs/${id}`);
  await expect(
    page.getByRole("button", { name: /Accept|Decline job/ }),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("resolved reports cannot expose completion while an estimate blocks the backend", async ({
  page,
}) => {
  await setup(page, {
    status: "IN_PROGRESS",
    assignmentState: "ACCEPTED",
    reports: [
      {
        id: assignment,
        state: "SUBMITTED_FOR_REVIEW",
        outcome: "RESOLVED",
        work_summary: "Work checked",
      },
    ],
    estimates: [
      {
        id: assignment,
        state: "REJECTED",
        diagnosis: "Part replacement",
        total_paise: 25000,
        items: [],
      },
    ],
  });
  await page.goto(`http://127.0.0.1:5175/technician/jobs/${id}`);
  await expect(
    page.getByText(
      "This job is paused until the admin resolves the declined estimate.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete job", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Resolve the estimate approval before completing this job."),
  ).toBeVisible();
});

test("profile omits availability and account-security controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("http://127.0.0.1:5175/technician/profile");
  await expect(
    page.getByRole("link", { name: /Earnings|Support/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Full name", { exact: true })).toBeHidden();
  await page.getByText("Edit personal details", { exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Arun Selvam");
  await page
    .getByRole("button", { name: "Save personal details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Arun Selvam", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change password", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Set up authenticator", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Account security", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Availability", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Job history", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "View", exact: true }),
  ).toHaveValue("completed");
  await page
    .getByRole("combobox", { name: "Request type", exact: true })
    .selectOption("INSTALLATION");
  await expect(page).toHaveURL(/view=completed&type=INSTALLATION$/);
  await page.getByRole("link", { name: "My jobs", exact: true }).last().click();
  await expect(
    page.getByRole("combobox", { name: "View", exact: true }),
  ).toHaveValue("active");
  await expect(
    page.getByRole("combobox", { name: "Request type", exact: true }),
  ).toHaveValue("");
});

test("frozen technicians are told to contact an administrator", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/technician/auth/me", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: "ACCOUNT_FROZEN",
          message:
            "Your technician account has been frozen. Contact an administrator for access.",
        },
      },
    }),
  );
  await page.goto("http://127.0.0.1:5175/technician");
  await expect(
    page.getByRole("heading", { name: "Account access paused" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your technician account has been frozen. Contact an administrator to restore access.",
    ),
  ).toBeVisible();
});
