# Three-PWA screen audit

25 October 2026. Scope: every routed screen and its nested workspaces. Classification is based on the existing working implementation; existing approvals, ownership, audit history, reports and price snapshots must survive visual changes. Reference image files were not supplied with the text brief; the specified white/blue visual characteristics guide the design.

| Screen | Purpose / information needed | Primary action | Classification and changes | Data / fetching concern | Layout |
| --- | --- | --- | --- | --- | --- |
| Customer Home | Identity, published appliances, active request | Choose appliance | IMPROVE: searchable compact discovery; MOVE tracking after discovery; REMOVE marketing heading repetition | profile, appliances, requests; duplicate profile observers need freshness | Compact mobile first; wider desktop grid |
| Appliances | Published categories only | Open appliance | IMPROVE: category-specific fallback icons, compact tiles | catalogue/appliances; unnecessary forced remount fetches | 2 mobile / responsive desktop columns |
| Appliance services | Actual service choices, approximate prices | Open service | KEEP card structure; IMPROVE density and readable price/action | appliance services; cache by appliance | Single column narrow phones, wider grid |
| Service detail | Scope, options, price and terms | Book Now | IMPROVE: sticky action area; do not hide extra-charge terms | published catalogue; duplicate global catalogue calls | Sticky action above mobile navigation |
| Customer sign-in | Google sign-in and useful errors | Sign in | KEEP: no developer setup instructions | public auth config; cache 5 min; no credential retries | Focused panel |
| Booking details | Prefilled appliance/service, selectable requirements | Continue | KEEP 4 stages; no repeated selection; IMPROVE labels | appliance/services/custom questions; stable keys | Large chips and readable controls |
| Booking contact | Address and actual contact phone | Continue | KEEP location/manual/saved address; no assumed Google phone | profile, addresses, optional geocode | Single column mobile, grouped desktop |
| Booking visit | Preferred date/window | Continue | KEEP preferred terminology; no fake availability | configured windows | Scrollable dates |
| Booking review / success | Snapshot, contact, date, request reference | Submit Request | KEEP: guarded submit and one confirmation | booking write, optional profile/address writes | Clear summary and bottom actions |
| My Requests | Real status and visits | Open request | KEEP four status filters; REMOVE redundant eyebrow | requests; no idle polling | Compact cards |
| Request detail | Actual timeline, estimate, technician/contact | Relevant decision / refresh | KEEP all evidence; IMPROVE schedule labels and secondary actions | detail, timeline, estimates; no fabricated updates | Stack panels on mobile |
| Customer review | Rating and feedback | Submit review | KEEP guarded one-review flow | review GET/POST | Small focused form |
| Profile | Actual Google identity and account settings | Edit details | IMPROVE settings rows/icons; REMOVE duplicate My Requests menu link | profile observers need shared staleTime | One identity card and menu |
| Addresses | Saved service locations | Add/edit address | KEEP validated contact/address fields | addresses CRUD | Clear cards and form |
| My Reviews | Past feedback | View feedback | KEEP nested under Profile | reviews | Compact list |
| Support / conversation | Tickets and messages | Send ticket/reply | IMPROVE explicit refresh; REMOVE 15s polling | tickets, messages, guarded writes | Progressive conversation disclosure |
| Privacy | Account security and data help | Google security / support | KEEP factual security information | no private API beyond identity | Short text |
| Admin sign-in / MFA | Staff authorization | Sign in / verify | KEEP secure workflow | login, MFA, identity | Focused form |
| Admin overview | Attention queue and useful totals | Assign / open request | IMPROVE compact metrics; KEEP optional trend/allocation disclosure | summary/activity poll every 30s unnecessarily | Dense responsive workspace |
| Unified Requests | Customer/contact, request, schedule, assignment | Open / assign / status | KEEP one table and filters; keep secondary actions in menu | requests every 15s; technician/catalogue lookups | Scroll table, compact mobile toolbar |
| Completed Requests | Completion evidence and review | Inspect request | KEEP history separate; REMOVE polling of history | requests every 30s | Same shared table |
| Request detail / override | Submitted booking, reports, actual history | Valid next operation | KEEP version checks, reasons, audit and evidence | detail polling should be bounded and visible-only | Responsive detail panels |
| Assignment drawer | Eligible technician, availability, skills, area | Confirm assignment | KEEP single guarded drawer | fetch eligibility only when opened, targeted refresh | Mobile sheet / desktop drawer |
| Admin appointments | Actual confirmed/preferred visits | Confirm / review proposal | KEEP Teams-style calendar and confirmations | range-scoped appointments, proposals | Calendar view switcher |
| Customers / customer detail | Account and booking context | Open account | KEEP; avoid repeated identity sections | customers and owner detail | Dense table + detail |
| Technicians / account | Verification, contact, skills, access | Create / manage account | KEEP temporary-password and suspension rules | technicians, account, operations | Drawer sections |
| Services / installations | Published source of truth | Edit / publish | IMPROVE multi-step editor into editable sections; KEEP safe icon upload | catalogue and media; targeted invalidation | Shared aligned cards |
| Appliance settings | Category creation, visibility and icons | Add / save | IMPROVE: added guarded draft category creation, duplicate-name protection and audit logging | category create/update | Compact drawer |
| Feedback / detail | Customer reviews and handling | Resolve / note | KEEP; REMOVE 15s list/summary polling | feedback, summary, detail | Table + focused handling |
| Admin support / detail | Customer tickets and replies | Reply / resolve | KEEP; REMOVE repeated list/conversation polling | support list/detail/messages | Table with conversation |
| Reports | Aggregate operations and audit | Export | KEEP accessible from settings, not daily nav | operations | Disclosure/table |
| Settings / security | Staff profile/password/MFA/preferences | Save | KEEP real controls; no fake preferences | identity, password, MFA | Clear sections |
| Notification legacy routes | Compatibility only | Open inbox | MERGE into shared dialog; fetch only on open/refresh | three identity-scoped inbox keys | Accessible responsive dialog |
| Technician login / activation / recovery | Account access | Sign in / set password | KEEP dedicated identity | technician auth | Field-friendly form |
| Technician first-password gate | Mandatory password change | Change password | KEEP restricted temporary session | password | Focused security step |
| Technician Home | New offers, today and next job | Review offer / continue | IMPROVE compact workday; REMOVE dashboard polling | dashboard every 15s | Compact stats + next job |
| My Jobs / history | Owned offers/jobs and next action | Review offer / open / complete | Card completion captures any required report and uses the fresh request version; pagination only when needed | No list polling; completion data fetched on opening | Call/directions and icon-labelled completion |
| Job detail | Visit, permitted contact and work report | Valid next action | Appliance-details, estimate-editor and operations-contact sections removed; required report/checklist and completion rules retained | Visible active detail refresh; targeted invalidation and synchronous mutation guard | Compact visit and report panels; two columns on desktop |
| Technician schedule / proposals | Actual assigned visits | Open / propose reschedule | KEEP backend approval, range fetching | calendar/proposals on open/focus | Day/week/month/agenda |
| Technician profile / security | Identity, skills, hours, account | Save | Broken Earnings/Support destinations removed; personal editing/security disclosed on demand; job-scoped operations help retained | profile, MFA, media | Readable mobile sections; account security preserved |

Shared components: notification center, guarded async buttons, dialog/drawer, status badges, location/contact actions, calendar, booked-price summary. Improve these primitives instead of creating role-specific copies. No backend workflow rewrite is warranted.
