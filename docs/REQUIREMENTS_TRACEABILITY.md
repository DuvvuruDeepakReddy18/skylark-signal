# Assignment Requirements Traceability

## Authority boundary

The attached **Skylark Drones - Full stack Assignment - RVU.docx** is the authoritative assignment. The pasted “Principal Full-Stack Engineer…” text was treated as optional product/quality guidance. Where they differ, the DOCX controls: the source assignment states **6 hours**, source code as a **ZIP**, and “Leadership Updates” as **optional**.

## Authoritative matrix

| Requirement | Priority | Evidence in solution | Verification |
|---|---:|---|---|
| AI agent for founder BI | P0 | Typed query planner + orchestrator + deterministic tools | Planner/analytics tests; API smoke test |
| Connect via monday API or MCP | P0 | Monday GraphQL API adapter | Inspect `lib/monday/client.ts`; live credential test |
| Read both boards | P0 | Concurrent configured Deals + Work Orders retrieval | Bootstrap/chat APIs; live smoke test |
| No hardcoded supplied data | P0 | Live API source; demo uses generated synthetic records and is labelled | Inspect demo generator and mode banner |
| Missing/null resilience | P0 | Nullable typed model; no imputation; exclusions/caveats | Normalization tests and lineage view |
| Inconsistent dates/names/text | P0 | Multi-format parsers, case/whitespace/status normalization | Unit tests |
| Meaningful incomplete-data results | P0 | Valid-record calculations plus excluded counts | Ask period pipeline/revenue with gaps |
| Communicate quality issues | P0 | Score, caveats, quality detail, confidence | Data-quality query and answer cards |
| Natural-language interpretation | P0 | Model/deterministic planner contracts | Query matrix |
| Clarifying questions | P0 | Material ambiguity and absent taxonomy handling | “How are we doing?” / “Energy” |
| Revenue/pipeline/sector/operations | P0 | Deterministic engine | Automated tests and manual queries |
| Cross-board queries | P0 | Sector aggregate comparison | Cross-board test/query |
| Context and insights | P0 | Signal/Evidence/Risk/Action/lineage | API response and component inspection |
| Leadership updates | P1 optional | Weekly evidence-backed briefing | Leadership query/copy |
| Conversational interface | P0 | Responsive chat/analysis workspace | Component review; final browser QA gate in checklist |
| Graceful API/data errors | P0 | Safe typed errors, retry, stale cache, no stack traces | Failure-mode tests/manual config |
| Hosted prototype | Required | Public Vercel URL | Fresh-browser check |
| Decision Log ≤2 pages | Required | Concise Markdown + PDF | Page-count QA |
| Source ZIP + README | Required | Repository/ZIP and detailed README | Public download/fresh setup |
| Justify stack | Required | README + Decision Log | Document review |

## Submission gates

- Public hosted URL opens without local setup.
- Repository/ZIP is accessible without requesting access.
- README contains architecture, setup, assumptions, trade-offs, AI disclosure, testing, limitations, and deployment.
- Decision Log is no more than two pages.
- Monday and OpenAI secrets are absent from client bundles, logs, source, and Git history.
- Header state matches reality: Live, Cached, Stale, or Demo.
