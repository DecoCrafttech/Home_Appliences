# Proposed shared database cleanup — approval required

Approved by the owner in this session and executed on 5 November 2026 (local time): 626 rows removed, 160 rows preserved, foreign keys enforced and preserved-table fingerprints unchanged. The scope below is retained as the approval record. See the release audit for the fresh backup and outcome.

Target: Neon project snowy-hill-87120042, branch br-broad-breeze-b41iqgjz, database neondb. This is the database used by the hosted apps.

Verified encrypted backup: D:\HA\backups\2026-11-04T21-49-17-247Z-214bb90a.json.enc. Backup contains 41 tables and 786 records; its key is protected by Windows DPAPI for this Windows user.

Delete all rows from the following 33 tables (626 rows at snapshot time). This removes customer identities/sessions, requests, appointments, assignments, technician accounts/profiles, reports, attachments metadata, notifications/push subscriptions/jobs, reviews, support messages/tickets, staff sessions/MFA challenges, OTPs, and mutation receipts. It does not remove objects from S3 storage.

| Table                           | Snapshot rows |
| ------------------------------- | ------------: |
| appointment_reschedule_requests |             0 |
| completion_reports              |             2 |
| customer_addresses              |             5 |
| customer_auth_identities        |             3 |
| customer_notifications          |            42 |
| customer_sessions               |            11 |
| customers                       |            10 |
| mutation_results                |           175 |
| otp_challenges                  |             0 |
| push_deliveries                 |           111 |
| push_preferences                |             4 |
| push_subscriptions              |             3 |
| request_reviews                 |             1 |
| request_status_events           |            52 |
| request_status_overrides        |             7 |
| review_handling_events          |             0 |
| review_internal_notes           |             0 |
| service_requests                |            19 |
| staff_login_challenges          |             9 |
| staff_notifications             |            75 |
| staff_sessions                  |            12 |
| support_messages                |             2 |
| support_tickets                 |             2 |
| technician_accounts             |             7 |
| technician_assignment_events    |            13 |
| technician_assignments          |            12 |
| technician_attachments          |             0 |
| technician_estimates            |             2 |
| technician_identity_files       |             0 |
| technician_notifications        |            27 |
| technician_sessions             |             8 |
| technician_work_reports         |             4 |
| technicians                     |             8 |

Preserve all rows in: schema_migrations, app_settings, appliance_categories, service_catalogue, catalogue_media, technician_checklists, staff_profiles, audit_logs. All six staff profiles, including the primary admin, remain unchanged. No tables, schemas, migrations, database, catalogue, audit trail, or storage objects will be dropped. No data deletion has occurred.

If approved, recheck identity and take a fresh verified backup before the transaction. If the dataset changes, stop and update this plan rather than silently expanding scope. Deletion must respect foreign keys and preserve the listed tables; fail/rollback if a constraint cannot be satisfied.
