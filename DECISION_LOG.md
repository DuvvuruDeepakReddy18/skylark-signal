# Skylark Signal — Decision Log

**Problem interpretation.** The task is not a general chatbot. It is a trustworthy business-intelligence layer over two messy monday.com boards. Success means a founder can ask a natural-language question, receive a correct calculation with business context, see relevant limitations, and trace the result back to source records.

**Architecture.** I used a modular Next.js/TypeScript application: conversational UI → validated API → query planner → Monday repository/cache → normalization → quality assessment → deterministic analytics → response composer. Each stage has one responsibility and emits only the contract needed by the next stage.

**Key assumptions.** “Revenue” means billed value excluding GST because the source has no accounting revenue-recognition field. “Pipeline” means valid deal value for Open/On Hold deals. Period pipeline uses Tentative Close Date. Work-order risk is rule-based from normalized status and planned dates. Dates written as `DD/MM/YYYY` follow Indian convention; ambiguous values are flagged. Missing values are never imputed.

**Why API rather than MCP.** The direct monday GraphQL API made read-only behavior, explicit board IDs, cursor pagination, timeouts, caching, error categories, API versioning, and hosted deployment observable within the time box. MCP would be valuable in an internal agent platform, but it would add another runtime/configuration dependency without improving the evaluator’s core workflow.

**AI architecture.** I intentionally separated language understanding from metric computation. A model with strict structured output may determine intent, required boards, dimensions, period, and metrics. Deterministic TypeScript performs numerical calculations. When no model key exists or planning fails, a typed deterministic planner provides a disclosed fallback. The model cannot run arbitrary GraphQL or invent business data.

**Normalization strategy.** Columns are located by normalized title aliases, not positions. Text is trimmed/case-normalized while display values remain. Dates accept known formats and validate calendar components. Currency parsing handles symbols, commas, null markers, and parentheses. Known status equivalents map to canonical values; unknowns stay unknown. Every normalized record retains its raw Monday item.

**Data-quality strategy.** The engine detects missing identifiers/analytical fields, invalid or ambiguous dates, unparseable/negative amounts, unknown statuses, embedded headers, duplicate-like records, date-order violations, and billed/contract inconsistencies. A severity-weighted reliability score and record exclusions drive confidence. Every answer can show relevant caveats instead of hiding them.

**Cross-board analysis.** The files do not contain a safe row-level shared key: customer codes use different namespaces, and most shared masked deal names are non-unique. I aggregate both boards by normalized sector, then compare pipeline strength with execution health. This is less granular but avoids false joins and makes the limitation explicit.

**Leadership updates.** I interpreted the optional feature as an evidence-backed weekly decision brief: active pipeline, billed revenue, sales exceptions, operational exceptions, leading sector, data reliability, and recommended actions from one snapshot. Copy and drill-down are included; export was deprioritized.

**Key trade-offs.** I chose a focused full-stack monolith, in-memory TTL cache, transparent rule-based risks, and a custom executive UI. I did not add a database, microservices, complex authentication, arbitrary dashboards, dozens of charts, streaming infrastructure, or decorative 3D. These would reduce reliability and explainability within six hours.

**Risks.** Live behavior depends on board permissions and column titles; billed revenue may not match finance-recognized revenue; activity-based staleness is impossible without an activity field; per-instance cache does not coordinate across serverless instances; a model planner needs evaluation beyond unit tests.

**With more time.** I would validate against a real Monday account, add an admin column-mapping screen, OAuth/tenant isolation, Redis/background refresh, a shared deal/work-order key, planner faithfulness evals, activity fields, accessible chart testing, and PDF/Markdown leadership export.
