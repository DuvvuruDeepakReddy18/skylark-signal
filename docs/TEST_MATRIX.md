# Test Matrix

| # | Scenario | Expected result |
|---:|---|---|
| 1 | “How is our pipeline looking this quarter?” | Deals-only plan; current-quarter filter; valid values summed; missing date/value caveat; stage evidence |
| 2 | “How is Mining performing?” | Cross-board sector answer; Mining pipeline + execution; sector-level join caveat |
| 3 | “Which sector has the strongest pipeline?” | Active deals grouped/ranked by normalized sector; no invented probability weighting |
| 4 | “Which deals need attention?” | Overdue/on-hold/undated/aging rules; records sorted by value; no false activity claim |
| 5 | “Which work orders are at risk?” | Paused, details-pending, late-start, late-end rules with supporting records |
| 6 | “Compare Renewables sales pipeline with execution.” | Both boards; pipeline/execution scores; aggregate sector lineage |
| 7 | “Prepare my leadership update.” | Pipeline, billed revenue, sales risk, operational risk, quality, action; copy works |
| 8 | “What is our revenue?” | Billed value excl. GST definition; receivable context; invoice-date caveat |
| 9 | “How are we doing?” | Targeted clarification offering pipeline, billed revenue, work orders, or update |
| 10 | “How is Energy performing?” | Clarification because Energy is absent; source sectors offered; no silent mapping |
| 11 | Monday API failure | Friendly 503/retry; stale snapshot shown if available; no stack/token/GraphQL leakage |
| 12 | “Mining pipeline?” → “What about Renewables?” | Follow-up inherits pipeline intent and switches only the grounded sector |

## Additional gates

- Empty board: zero-valued but honest answer, no divide-by-zero/NaN.
- Missing column: nullable normalization and quality warnings; no crash.
- Invalid token: authentication-safe message.
- Rate limit: friendly retryable message.
- Timeout: abort after 12 seconds.
- Duplicate/header rows: excluded and visible in quality/lineage.
- Desktop and mobile: no horizontal page overflow; tables scroll inside the detail panel.
- Keyboard: `Ctrl/Cmd+K`, Enter to send, Shift+Enter newline, focus-visible states.
- Accessibility: semantic headings, buttons, details, labels, live status, reduced-motion support.
- Security: `/api/health` returns booleans only; secrets absent from browser network responses.

## Automated result

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Record final counts and deployment smoke-test results before submitting.
