# Screen and regression checklist

- Customer: splash/onboarding; Google sign-in; home; full service listing; appliance services; unified booking entry; existing four-step service/installation wizard; request list and filters; request details/estimates; feedback; profile; saved addresses; support conversations; privacy and not-found states.
- Admin: login/MFA; dashboard/date filters/allocation; operations and completed queues; request details/tabs/work reports; assignment; appointments; technicians/accounts; customers; feedback; support; catalogue/editor/questions/icons; settings; errors, dialogs and empty states.
- Technician: login/activation/password change; workday; jobs; schedule; job details/actions/completion/report; profile/photo; existing holds and permissions.
- Shared: exact design tokens; original PNG; supplied honeycomb in headers only; cards/inputs/buttons/statuses/skeletons/dialogs; safe areas and responsive tables.
- Regressions: preserve API shapes, authentication, permission checks, request IDs, submission idempotency, validation, drafts, existing supported actions, notifications, navigation paths, service workers and scope.
- Verify: three production builds, available lint/unit/integration/browser checks; 360/768/desktop layouts; disclose unavailable live external-auth/database checks.
