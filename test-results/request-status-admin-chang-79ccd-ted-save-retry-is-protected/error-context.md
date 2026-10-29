# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: request-status.spec.ts >> admin changes status without entering notes and repeated save/retry is protected
- Location: tests\browser\request-status.spec.ts:138:5

# Error details

```
Error: expect(locator).toHaveJSProperty(expected) failed

Locator: getByRole('dialog').getByLabel('New Status').locator('option[value="IN_PROGRESS"]')
Expected: false
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toHaveJSProperty" getByRole('dialog').getByLabel('New Status').locator('option[value="IN_PROGRESS"]') with timeout 30000ms
  - waiting for getByRole('dialog').getByLabel('New Status').locator('option[value="IN_PROGRESS"]')

```

```yaml
- complementary "Admin navigation":
  - link "Home Services dashboard":
    - /url: /
    - img
    - text: Home Services ADMIN WORKSPACE
  - navigation:
    - text: Daily work
    - link "Dashboard":
      - /url: /
    - link "Requests":
      - /url: /requests
    - link "Appointments":
      - /url: /appointments
    - link "Technicians":
      - /url: /technicians
    - text: Customer care
    - link "Customers":
      - /url: /customers
    - link "Support":
      - /url: /support
    - link "Feedback":
      - /url: /feedback
    - text: Manage
    - link "Completed Requests":
      - /url: /completed-requests
    - link "Services & Installations":
      - /url: /catalogue
    - link "Settings":
      - /url: /settings
- banner:
  - button "Collapse sidebar":
    - img
  - text: Workspace / Requests
  - button "Notifications"
  - group:
    - strong: Status Admin
    - text: ADMIN
- main:
  - heading "000123" [level=1]
  - link "Back to requests":
    - /url: /requests
  - button "Refresh":
    - img
    - text: Refresh
  - button "Change Status"
  - dialog "Change Request Status":
    - heading "Change Request Status" [level=2]
    - button "Close"
    - strong: "000123"
    - paragraph: Status Customer
    - paragraph: Air Conditioner
    - text: "Current status: Awaiting review"
    - group:
      - text: New Status
      - combobox "New Status":
        - option "Choose a status" [selected]
        - option "Pending"
        - option "Technician Assigned"
        - option "Completed"
        - option "On Hold"
        - option "Cancelled"
    - button "Cancel"
    - button "Save Status" [disabled]
  - heading "Next action" [level=2]
  - paragraph: "Current state: Awaiting review"
  - button "Assign Technician"
  - button "Start Review"
  - heading "1 Appliance / Service" [level=2]
  - heading "Air Conditioner" [level=3]
  - paragraph: General Service
  - heading "2 Customer / Location" [level=2]
  - heading "Customer Contact" [level=3]
  - strong: Status Customer
  - paragraph: Phone number not provided
  - link "View Customer":
    - /url: /customers/11111111-1111-4111-8111-111111111111
  - paragraph
  - heading "3 Schedule" [level=2]
  - term: Preferred visit
  - definition: 2099-10-25 · 09:00-12:00
  - term: Confirmed appointment
  - definition: Awaiting operations confirmation
  - term: Technician
  - definition: Unassigned
  - heading "4 Request Summary" [level=2]
  - text: "000123"
  - paragraph: Service
  - text: Pending
  - list "Request progress":
    - listitem:
      - strong: Pending
      - text: Current stage
    - listitem:
      - strong: Technician assigned
      - text: Not recorded
    - listitem:
      - strong: In progress
      - text: Not recorded
    - listitem:
      - strong: Completed
      - text: Not recorded
  - heading "Progress Timeline" [level=2]
  - list
  - group: Help and Support
- region "Notifications alt+T"
```

# Test source

```ts
  53  |           data: { id, role, username: "status", full_name: "Status Admin" },
  54  |         },
  55  |       });
  56  |     if (path.endsWith(`/requests/${id}/status`)) {
  57  |       const body = route.request().postDataJSON();
  58  |       writes.push(body);
  59  |       await new Promise((resolve) => setTimeout(resolve, 150));
  60  |       if (fail && writes.length === 1)
  61  |         return route.fulfill({
  62  |           status: 503,
  63  |           json: { error: { message: "Temporary error. Try again." } },
  64  |         });
  65  |       request.status = body.status === "PENDING" ? "REQUESTED" : body.status;
  66  |       request.version++;
  67  |       return route.fulfill({ json: { data: request } });
  68  |     }
  69  |     if (path.endsWith(`/requests/${id}`))
  70  |       return route.fulfill({ json: { data: request } });
  71  |     if (path.endsWith("/requests")) {
  72  |       requestGroups.push(
  73  |         new URL(route.request().url()).searchParams.get("group"),
  74  |       );
  75  |       return route.fulfill({ json: { data: [request], meta: { total: 1 } } });
  76  |     }
  77  |     if (path.endsWith("/catalogue"))
  78  |       return route.fulfill({
  79  |         json: { data: { categories: [], services: [] } },
  80  |       });
  81  |     if (path.endsWith("/technicians"))
  82  |       return route.fulfill({
  83  |         json: {
  84  |           data: [
  85  |             {
  86  |               id: technicianId,
  87  |               full_name: "Available Technician",
  88  |               verification_status: "VERIFIED",
  89  |               account_status: "ACTIVE",
  90  |             },
  91  |             {
  92  |               id: "33333333-3333-4333-8333-333333333333",
  93  |               full_name: "Another Technician",
  94  |               verification_status: "VERIFIED",
  95  |               account_status: "ACTIVE",
  96  |             },
  97  |           ],
  98  |         },
  99  |       });
  100 |     return route.fulfill({ json: { data: [] } });
  101 |   });
  102 |   await page.goto(
  103 |     `http://127.0.0.1:5174/requests/${id}?action=status#update-status`,
  104 |   );
  105 |   return { writes, requestGroups };
  106 | }
  107 | 
  108 | async function open(page: Page) {
  109 |   await page
  110 |     .getByRole("button", { name: "Change Status", exact: true })
  111 |     .click();
  112 |   return page.getByRole("dialog");
  113 | }
  114 | test("missing contact is honest and does not produce an invalid call link", async ({
  115 |   page,
  116 | }) => {
  117 |   await setup(page);
  118 |   await expect(
  119 |     page
  120 |       .locator(".customer-contact")
  121 |       .getByText("Phone number not provided", { exact: true }),
  122 |   ).toBeVisible();
  123 |   await expect(page.locator('.customer-contact a[href^="tel:"]')).toHaveCount(
  124 |     0,
  125 |   );
  126 | });
  127 | test("admin has a separate in-progress requests workspace", async ({
  128 |   page,
  129 | }) => {
  130 |   const { requestGroups } = await setup(page, { status: "IN_PROGRESS" });
  131 |   await page.goto("http://127.0.0.1:5174/in-progress-requests");
  132 |   await expect(
  133 |     page.getByRole("heading", { name: "In Progress Requests", exact: true }),
  134 |   ).toBeVisible();
  135 |   await expect.poll(() => requestGroups.at(-1)).toBe("IN_PROGRESS");
  136 |   await expect(page.getByLabel("Status")).toHaveCount(0);
  137 | });
  138 | test("admin changes status without entering notes and repeated save/retry is protected", async ({
  139 |   page,
  140 | }) => {
  141 |   const { writes } = await setup(page, { status: "REQUESTED", fail: true }),
  142 |     dialog = await open(page);
  143 |   for (const status of [
  144 |     "PENDING",
  145 |     "TECHNICIAN_ASSIGNED",
  146 |     "IN_PROGRESS",
  147 |     "COMPLETED",
  148 |     "ON_HOLD",
  149 |     "CANCELLED",
  150 |   ])
  151 |     await expect(
  152 |       dialog.getByLabel("New Status").locator(`option[value="${status}"]`),
> 153 |     ).toHaveJSProperty("disabled", false);
      |       ^ Error: expect(locator).toHaveJSProperty(expected) failed
  154 |   await dialog.getByLabel("New Status").selectOption("COMPLETED");
  155 |   await expect(dialog.getByLabel("Reason / Internal Note")).toHaveCount(0);
  156 |   await expect(
  157 |     dialog.getByLabel("Completion note", { exact: false }),
  158 |   ).toHaveCount(0);
  159 |   await dialog
  160 |     .getByRole("button", { name: "Save Status", exact: true })
  161 |     .click({ clickCount: 3 });
  162 |   await expect(dialog.getByRole("alert")).toHaveText(
  163 |     "Temporary error. Try again.",
  164 |   );
  165 |   expect(writes).toHaveLength(1);
  166 |   await expect(dialog.getByLabel("New Status")).toHaveValue("COMPLETED");
  167 |   await expect(dialog.getByLabel("Reason / Internal Note")).toHaveCount(0);
  168 |   await dialog
  169 |     .getByRole("button", { name: "Save Status", exact: true })
  170 |     .click();
  171 |   await expect(dialog).toHaveCount(0);
  172 |   expect(writes).toHaveLength(2);
  173 |   expect(writes[1]).toMatchObject({
  174 |     status: "COMPLETED",
  175 |     expectedVersion: 4,
  176 |   });
  177 | });
  178 | test("technician status requires a person from the active list without skill matching", async ({
  179 |   page,
  180 | }) => {
  181 |   const { writes } = await setup(page, { status: "REQUESTED" }),
  182 |     dialog = await open(page);
  183 |   await dialog.getByLabel("New Status").selectOption("TECHNICIAN_ASSIGNED");
  184 |   await expect(dialog.getByLabel("Technician", { exact: true })).toBeVisible();
  185 |   await expect(
  186 |     dialog.getByLabel("Technician", { exact: true }).locator("option"),
  187 |   ).toHaveCount(3);
  188 |   await expect(
  189 |     dialog.getByRole("button", { name: "Save Status", exact: true }),
  190 |   ).toBeDisabled();
  191 |   await dialog
  192 |     .getByLabel("Technician", { exact: true })
  193 |     .selectOption(technicianId);
  194 |   await dialog
  195 |     .getByRole("button", { name: "Save Status", exact: true })
  196 |     .click();
  197 |   await expect(dialog).toHaveCount(0);
  198 |   expect(writes[0]).toMatchObject({
  199 |     status: "TECHNICIAN_ASSIGNED",
  200 |     technicianId,
  201 |   });
  202 | });
  203 | for (const status of ["COMPLETED", "CANCELLED"])
  204 |   test(`${status} can reopen only with explicit confirmation`, async ({
  205 |     page,
  206 |   }) => {
  207 |     const { writes } = await setup(page, { status }),
  208 |       dialog = await open(page);
  209 |     await dialog.getByLabel("New Status").selectOption("PENDING");
  210 |     await expect(
  211 |       dialog.getByRole("button", { name: "Save Status", exact: true }),
  212 |     ).toBeDisabled();
  213 |     await dialog.getByRole("checkbox").check();
  214 |     await dialog
  215 |       .getByRole("button", { name: "Save Status", exact: true })
  216 |       .click();
  217 |     await expect(dialog).toHaveCount(0);
  218 |     expect(writes[0]).toMatchObject({ status: "PENDING", confirmReopen: true });
  219 |   });
  220 | test("support role has no override action", async ({ page }) => {
  221 |   await setup(page, { role: "SUPPORT_AGENT" });
  222 |   await expect(
  223 |     page.getByRole("heading", { name: "000123", exact: true }),
  224 |   ).toBeVisible();
  225 |   await expect(
  226 |     page.getByRole("button", { name: "Change Status", exact: true }),
  227 |   ).toHaveCount(0);
  228 | });
  229 | for (const width of [360, 390, 768, 1024, 1440])
  230 |   test(`status modal fits ${width}px and can be opened from row actions`, async ({
  231 |     page,
  232 |   }) => {
  233 |     await page.setViewportSize({ width, height: 900 });
  234 |     await setup(page);
  235 |     await page
  236 |       .getByRole("link", { name: "Back to requests", exact: true })
  237 |       .click();
  238 |     const row = page
  239 |       .locator(
  240 |         width <= 1100 ? ".mobile-request-card" : ".desktop-request-table",
  241 |       )
  242 |       .first();
  243 |     await row.getByLabel("More actions", { exact: true }).click();
  244 |     await row
  245 |       .getByRole("button", { name: "Change Status", exact: true })
  246 |       .last()
  247 |       .click();
  248 |     const dialog = page.getByRole("dialog");
  249 |     await expect(
  250 |       dialog.getByRole("heading", {
  251 |         name: "Change Request Status",
  252 |         exact: true,
  253 |       }),
```