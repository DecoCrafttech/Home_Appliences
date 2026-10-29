# Request status control

Historical report: this three-choice control and final-state restriction are superseded by the user's later master prompt. Current behavior is the reusable unrestricted administrative override modal documented in STATUS_OVERRIDE_REPORT.md. Completed and cancelled requests can now be reopened with an explicit confirmation and reason; Pending and On Hold are distinct.

Admin Requests now provides a visible Change Status link beside View Details. It opens the request's focused status selector. Only staff with existing request-management permission see these controls.

| Choice | Behavior |
| --- | --- |
| Pending | Pauses an eligible active request using the existing ON_HOLD backend state. A reason and confirmation are required. The displayed status is Pending. |
| Completed | Opens the existing completion form for a contact-technician job, or focuses the technician's submitted work report for review and approval. It does not skip work, unresolved estimates or report approval. |
| Cancelled | Opens a confirmation requiring a reason, then uses the existing version-checked cancellation API. |

Completed and cancelled requests stay final, as explicitly confirmed by the user. There is no reopening action. Choices unavailable at the current workflow stage are disabled with an explanation. No backend transition, role or ownership check was relaxed.

The status filter distinguishes Pending review from Pending (paused). Existing stored status codes, history, assignments and notifications are retained. Successful updates refresh the request, listing, summary, dashboard activity, allocation, appointments and notification caches. Failed updates retain the reason; synchronous mutation protection prevents duplicate writes.

Verification: all workspace builds (including TypeScript) and ESLint pass. The five new browser checks cover required reasons, failed update/retry, repeated clicks, persisted UI refresh, paused filtering, guarded report completion, unavailable transitions and final-state protection. The broader run passed 72/72, including real service/installation completion and review. The final Admin/status run passed 15/15 after the paused-filter label and cache updates. All three PWA checks pass; the post-test read-only audit returned no findings. See FINAL_TEST_REPORT.md for commands and environment limits.
