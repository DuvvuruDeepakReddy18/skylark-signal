# Interview Preparation

## 60-second explanation

“Instead of building another chatbot, I built a trustworthy BI layer over monday.com. A constrained planner turns a founder’s question into intent, boards, filters, period, and metrics. Monday data is fetched read-only, normalized without destroying raw values, and checked for missing dates, bad amounts, duplicates, and unknown statuses. Deterministic TypeScript calculates pipeline, billed revenue, execution risk, and cross-board sector signals. The answer is shown as Signal, Evidence, and Action with caveats, confidence, source records, and calculation lineage. That separation makes the experience useful to a founder and defensible to an engineer.”

## 3-minute architecture explanation

“The browser sends only a validated business question and small conversation context. A deterministic pre-router selects Deals, Work Orders, or both before the server loads cursor-paginated Monday data through a short cache with explicit live/cached/stale labels. Normalization maps titles through aliases, parses dates and amounts, preserves raw items, and marks exclusions. The planner then uses strict Groq structured output grounded in the live taxonomy; rule validation remains authoritative and the model is never the calculator. Deterministic analytics return numbers plus evidence, risks, actions, caveats, records, and lineage. Cross-board analysis joins normalized sector aggregates because there is no safe row key. Founder Mode stays concise, Analyst Mode adds charts and drill-down, and real server progress events drive the analysis states.”

## Questions and concise answers

1. **Why Monday API?** Direct GraphQL made scopes, pagination, versioning, caching, errors, and hosted deployment explicit and testable.
2. **Why not MCP?** MCP is useful for a broader internal tool ecosystem, but adds a runtime dependency here without improving the evaluator’s read-only workflow.
3. **Why this agent architecture?** Language is good at intent; code is better at auditable arithmetic. The boundary reduces hallucination risk.
4. **How does normalization work?** Column-title aliases locate fields; parsers return canonical typed values; raw records remain attached; unknowns are flagged, not guessed.
5. **How do you prevent hallucinations?** The planner has a strict schema, cannot send GraphQL, calculations are deterministic, unsupported sectors clarify, and missing fields stay missing.
6. **How do you handle missing data?** Use valid records only, count exclusions, lower confidence, show caveats, and refuse metrics that cannot be reliable.
7. **How does cross-board analysis work?** Aggregate each board by normalized sector, then compare pipeline strength with execution health. No row join is claimed.
8. **What happens when Monday fails?** Typed auth/rate-limit/timeout/schema errors; stale cache when available; friendly retry; no stack traces.
9. **How would this scale?** Redis/shared cache, background refresh, OAuth tenants, precomputed aggregates, observability SLOs, and schema contracts.
10. **Another week?** Broader live-schema validation, mapping UI, shared ID, eval suite, OAuth, Redis, activity fields, and export.
11. **Biggest technical challenge?** Deriving useful metrics without pretending sparse or inconsistent fields were clean.
12. **Biggest product decision?** Making trust—the caveat, lineage, and action—not chat styling—the core experience.
13. **Why deterministic calculations?** They are reproducible, unit-testable, reviewable, and immune to model arithmetic drift.
14. **How do ambiguous questions work?** Clarify only when the interpretation changes the number; otherwise apply documented defaults.
15. **How would you evaluate agent quality?** Intent accuracy, filter/board selection, numerical exactness, evidence faithfulness, clarification precision, latency, and user actionability.
16. **Security concerns?** Token leakage, arbitrary GraphQL, cross-tenant access, prompt injection, sensitive logs, cache isolation, and overly broad Monday permissions.
17. **Current limitations?** Title-based mappings, billed revenue proxy, no activity field, per-instance cache, and sector-level rather than row-level cross-board joins.
18. **Why a confidence score?** It communicates data/analysis reliability from completeness and issues; it does not claim certainty in prose.
19. **What was deliberately not built?** Database, microservices, complex auth, decorative 3D, many charts, arbitrary report builder, and export-first work.
20. **Why should Skylark hire you?** I balanced product clarity, data realism, agent safety, engineering discipline, and delivery—then made the trade-offs visible.
