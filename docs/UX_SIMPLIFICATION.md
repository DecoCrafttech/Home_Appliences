# Workflow and UX review

Reviewed and updated 23 October 2026. This review covers the three application entry points, navigation, service discovery, booking, request tracking, operations overview and technician job discovery. It is a code and browser review, not a study with real customers.

## Core journeys

- Customer: choose appliance, choose service and requirements, sign in, provide contact/address and preferred visit, review and submit, track confirmation, decide on additional estimates, review completed work.
- Operations: review requests, offer work to a technician, confirm appointments, resolve exceptions and work reports, follow completed work and customer support.
- Technician: review and accept an offer, open the visit, progress the job, submit estimates when needed, submit the work report and complete when permitted.

## Changes

| Area | Friction | Change |
| --- | --- | --- |
| Customer home | Marketing, browsing, active work and old requests compete | Show draft and active request before appliance selection; remove duplicate browse button, recent-history block and how-it-works block |
| Customer tracking | Status alone does not explain the next step | Add short status-specific guidance; prioritize pending estimate approval on Home |
| Visit dates | Request cards show requested time even after confirmation | Prefer confirmed date/time and explicitly label preferred dates |
| New request | My Requests skips the appliance discovery journey | Start new bookings from the appliance catalogue |
| Service lists | Long descriptions repeat the detail page | Keep service name, type and indicative price on cards; retain descriptions and scope on details |
| Customer sign-in | Developer OAuth instructions appear in the product | Remove the setup disclosure; retain useful sign-in errors |
| Admin navigation | Six headings make routine tasks harder to scan | Group links into Daily work, Customer care and Manage; shorten labels |
| Admin overview | Reporting appears before the attention queue | Put the queue first, add assignment/appointment shortcuts, collapse trends and team workload |
| Technician workday | Counts require another navigation and filter step | Link offers, today's jobs and work in progress to their respective filtered lists |
| Technician copy | Internal identity and account scoping clutter daily work | Remove identity from Home and use actionable job-list guidance |

History remains in My Requests and completed-job views. Settings, support, security, audit history, estimate decisions, assignment acceptance and completion requirements remain accessible. No backend lifecycle or authorization rules were changed.

## Verification

Browser checks cover appliance selection and multi-option booking, unsaved booking navigation, admin responsive layouts, notification dialogs, optional reporting, technician filter shortcuts and customer estimate priority. Responsive checks use widths of 360, 390, 768, 1024 and 1440 pixels. Provider configuration and real-user usability research are separate from these checks.
