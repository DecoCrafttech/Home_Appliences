# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: technician-flow.spec.ts >> card completes a job with its required report at 360px
- Location: tests\browser\technician-flow.spec.ts:187:7

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Complete job', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - banner [ref=e5]:
        - link "Home Services technician home" [ref=e6] [cursor=pointer]:
          - /url: /technician
          - generic [ref=e10]:
            - text: Home Services
            - generic [ref=e11]: Technician
        - button "Notifications" [ref=e12] [cursor=pointer]
        - link "Arun Kumar profile" [ref=e15] [cursor=pointer]:
          - /url: /technician/profile
          - generic [aria-hidden] [ref=e16]: AK
      - main [ref=e17]:
        - generic [ref=e18]:
          - heading "My jobs" [level=1] [ref=e21]
          - generic [ref=e22]:
            - generic [ref=e23]:
              - text: View
              - combobox "View" [ref=e24]:
                - option "Active jobs"
                - option "Assigned jobs"
                - option "Today"
                - option "Upcoming"
                - option "In progress" [selected]
                - option "Completed"
            - generic [ref=e25]:
              - text: Request type
              - combobox "Request type" [ref=e26]:
                - option "All types" [selected]
                - option "Service"
                - option "Installation"
            - button "Refresh" [ref=e27] [cursor=pointer]
          - article [ref=e31]:
            - generic [ref=e32]:
              - generic [ref=e33]: SR-101
              - generic [ref=e34]: In progress
            - generic [ref=e35]:
              - heading "Air Conditioner" [level=2] [ref=e36]
              - paragraph [ref=e37]: Cooling inspection
            - generic [ref=e38]:
              - paragraph [ref=e42]:
                - generic [ref=e43]: Confirmed visit
                - strong [ref=e44]:
                  - time [ref=e45]: 26 Oct
                  - text: · 09:00-12:00
              - paragraph [ref=e49]: Priya Kumar
            - generic [ref=e50]:
              - paragraph [ref=e51]: 12 Lake Road, Adyar, Chennai
              - link "Get Directions" [ref=e53] [cursor=pointer]:
                - /url: https://www.google.com/maps/dir/?api=1&destination=12%20Lake%20Road%2C%20Adyar%2C%20Chennai%2C%20Tamil%20Nadu%2C%20600020
            - link "View job" [ref=e57] [cursor=pointer]:
              - /url: /technician/jobs/11111111-1111-4111-8111-111111111111
    - navigation "Mobile technician navigation" [ref=e58]:
      - link "Home" [ref=e59] [cursor=pointer]:
        - /url: /technician
      - link "My jobs" [ref=e63] [cursor=pointer]:
        - /url: /technician/jobs
      - link "Schedule" [ref=e67] [cursor=pointer]:
        - /url: /technician/schedule
      - link "Profile" [ref=e71] [cursor=pointer]:
        - /url: /technician/profile
  - region "Notifications alt+T"
```

# Test source

```ts
  98  |       path = new URL(request.url()).pathname;
  99  |     if (request.method() === "GET") {
  100 |       if (path.endsWith("/auth/me"))
  101 |         return route.fulfill({ json: { data: profile } });
  102 |       if (path.endsWith(`/jobs/${id}`))
  103 |         return route.fulfill({ json: { data: job() } });
  104 |       if (path.endsWith("/dashboard"))
  105 |         return route.fulfill({
  106 |           json: {
  107 |             data: {
  108 |               pending: 0,
  109 |               today: 1,
  110 |               in_progress: 1,
  111 |               completed_today: 2,
  112 |               next_jobs: [job()],
  113 |             },
  114 |           },
  115 |         });
  116 |       if (path.endsWith("/jobs"))
  117 |         return route.fulfill({
  118 |           json: {
  119 |             data: [job()],
  120 |             meta: { total: 1 },
  121 |           },
  122 |         });
  123 |       if (path.endsWith("/profile/photo"))
  124 |         return route.fulfill({ json: { data: { url: null } } });
  125 |       return route.fulfill({ json: { data: [] } });
  126 |     }
  127 |     const body = request.postDataJSON();
  128 |     writes.push({ path, body, key: request.headers()["idempotency-key"] });
  129 |     if (path.endsWith("/complete") && completeFailure) {
  130 |       completeFailure = false;
  131 |       return route.fulfill({
  132 |         status: 503,
  133 |         json: { error: { message: "Completion interrupted. Please retry." } },
  134 |       });
  135 |     }
  136 |     const statuses: Record<string, string> = {
  137 |       "on-the-way": "TECHNICIAN_EN_ROUTE",
  138 |       arrived: "TECHNICIAN_ARRIVED",
  139 |       start: "IN_PROGRESS",
  140 |       complete: "COMPLETED",
  141 |     };
  142 |     const action = path.split("/").at(-1)!;
  143 |     if (statuses[action]) state.status = statuses[action];
  144 |     if (action === "estimates") {
  145 |       state.status = "ESTIMATE_PENDING_APPROVAL";
  146 |       state.estimates = [
  147 |         {
  148 |           id: assignment,
  149 |           state: "AWAITING_CUSTOMER_APPROVAL",
  150 |           diagnosis: String(body.diagnosis),
  151 |           total_paise: 25000,
  152 |           items: body.items,
  153 |         },
  154 |       ];
  155 |     }
  156 |     if (action === "work-report")
  157 |       state.reports = [
  158 |         {
  159 |           id: assignment,
  160 |           state: "SUBMITTED_FOR_REVIEW",
  161 |           outcome: body.outcome,
  162 |           work_summary: body.workSummary,
  163 |         },
  164 |       ];
  165 |     if (path.endsWith("/profile")) {
  166 |       profile.full_name = body.fullName;
  167 |       profile.phone = body.phone;
  168 |     }
  169 |     state.version++;
  170 |     return route.fulfill({ json: { data: { id } } });
  171 |   });
  172 |   return {
  173 |     state,
  174 |     writes,
  175 |     failCompletion: () => {
  176 |       completeFailure = true;
  177 |     },
  178 |   };
  179 | }
  180 | async function tripleClick(page: Page, name: string) {
  181 |   await page.getByRole("button", { name, exact: true }).evaluate((node) => {
  182 |     for (let i = 0; i < 3; i++) (node as HTMLButtonElement).click();
  183 |   });
  184 | }
  185 | 
  186 | for (const width of [360, 1440])
  187 |   test(`card completes a job with its required report at ${width}px`, async ({
  188 |     page,
  189 |   }) => {
  190 |     await page.setViewportSize({ width, height: 900 });
  191 |     const { state, writes } = await setup(page, {
  192 |       status: "IN_PROGRESS",
  193 |       assignmentState: "ACCEPTED",
  194 |     });
  195 |     await page.goto("http://127.0.0.1:5175/technician/jobs?view=in-progress");
  196 |     await page
  197 |       .getByRole("button", { name: "Complete job", exact: true })
> 198 |       .click();
      |        ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  199 |     const dialog = page.getByRole("dialog", {
  200 |       name: "Complete this job?",
  201 |       exact: true,
  202 |     });
  203 |     await expect(
  204 |       dialog.getByLabel("Work performed", { exact: true }),
  205 |     ).toBeVisible();
  206 |     expect(writes).toHaveLength(0);
  207 |     await dialog
  208 |       .getByLabel("Work performed", { exact: true })
  209 |       .fill("Cleaned filters and verified cooling.");
  210 |     for (const check of await dialog.getByRole("checkbox").all())
  211 |       await check.check();
  212 |     await tripleClick(page, "Confirm completion");
  213 |     await expect(dialog).toHaveCount(0);
  214 |     expect(state.status).toBe("COMPLETED");
  215 |     expect(
  216 |       writes.filter((write) => write.path.endsWith("/work-report")),
  217 |     ).toHaveLength(1);
  218 |     expect(
  219 |       writes.filter((write) => write.path.endsWith("/complete")),
  220 |     ).toHaveLength(1);
  221 |     expect(
  222 |       writes.find((write) => write.path.endsWith("/complete"))!.body.version,
  223 |     ).toBe(2);
  224 |   });
  225 | 
  226 | test("card completion retry retains the saved report and does not submit it twice", async ({
  227 |   page,
  228 | }) => {
  229 |   const { writes, failCompletion } = await setup(page, {
  230 |     status: "IN_PROGRESS",
  231 |     assignmentState: "ACCEPTED",
  232 |   });
  233 |   failCompletion();
  234 |   await page.goto("http://127.0.0.1:5175/technician/jobs?view=in-progress");
  235 |   await page.getByRole("button", { name: "Complete job", exact: true }).click();
  236 |   const dialog = page.getByRole("dialog");
  237 |   await dialog
  238 |     .getByLabel("Work performed", { exact: true })
  239 |     .fill("Checked cooling and completed repair.");
  240 |   for (const check of await dialog.getByRole("checkbox").all())
  241 |     await check.check();
  242 |   await tripleClick(page, "Confirm completion");
  243 |   await expect(dialog.getByRole("alert")).toContainText(
  244 |     "Completion interrupted",
  245 |   );
  246 |   await expect(
  247 |     dialog.getByLabel("Work performed", { exact: true }),
  248 |   ).toHaveCount(0);
  249 |   await tripleClick(page, "Confirm completion");
  250 |   await expect(dialog).toHaveCount(0);
  251 |   expect(
  252 |     writes.filter((write) => write.path.endsWith("/work-report")),
  253 |   ).toHaveLength(1);
  254 |   const completion = writes.filter((write) => write.path.endsWith("/complete"));
  255 |   expect(completion).toHaveLength(2);
  256 |   expect(completion[0]!.key).toBe(completion[1]!.key);
  257 | });
  258 | 
  259 | for (const width of [390, 1440])
  260 |   test(`workday and profile stay compact at ${width}px`, async ({ page }) => {
  261 |     await page.setViewportSize({ width, height: 900 });
  262 |     await setup(page, { status: "IN_PROGRESS", assignmentState: "ACCEPTED" });
  263 |     await page.goto("http://127.0.0.1:5175/technician");
  264 |     await expect(
  265 |       page.getByRole("button", { name: "Complete job", exact: true }),
  266 |     ).toBeVisible();
  267 |     expect(
  268 |       await page.evaluate(
  269 |         () => document.documentElement.scrollWidth <= innerWidth + 1,
  270 |       ),
  271 |     ).toBe(true);
  272 |     await page.screenshot({
  273 |       path: `test-results/request-simple/tech-home-${width}.png`,
  274 |       fullPage: true,
  275 |     });
  276 |     await page.goto("http://127.0.0.1:5175/technician/profile");
  277 |     await expect(
  278 |       page.getByRole("button", { name: "Save availability", exact: true }),
  279 |     ).toBeHidden();
  280 |     await expect(page.getByText("Availability", { exact: true })).toHaveCount(
  281 |       0,
  282 |     );
  283 |     await expect(
  284 |       page.getByText("Account Security", { exact: true }),
  285 |     ).toHaveCount(0);
  286 |     await expect(page.getByText("Skills", { exact: true })).toHaveCount(0);
  287 |     await expect(page.getByLabel("Full name", { exact: true })).toBeHidden();
  288 |     await page.screenshot({
  289 |       path: `test-results/request-simple/tech-profile-${width}.png`,
  290 |       fullPage: true,
  291 |     });
  292 |   });
  293 | 
  294 | for (const width of [360, 1440])
  295 |   test(`technician works an immediately assigned job at ${width}px`, async ({
  296 |     page,
  297 |   }) => {
  298 |     await page.setViewportSize({ width, height: 900 });
```