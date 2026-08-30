# Submission Checklist

## Public links

- [x] Open the hosted application in a private/incognito window.
- [x] Open the GitHub repository while signed out.
- [x] Confirm the source ZIP downloads and extracts successfully.
- [x] Confirm the Decision Log PDF is exactly two pages.

## Live integration

- [x] Set `MONDAY_API_TOKEN`, `MONDAY_DEALS_BOARD_ID`, and `MONDAY_WORK_ORDERS_BOARD_ID` in the deployment environment.
- [x] Set the server-only Groq key as `OPENAI_API_KEY`, plus the Groq `OPENAI_BASE_URL` and `OPENAI_MODEL`.
- [x] Redeploy after setting environment variables.
- [x] Confirm the header reports **Live**, not **Demo**.
- [x] Ask one Deals query, one Work Orders query, and one cross-board query against live boards.
- [x] Confirm the application uses only fixed read-only Monday queries and no credential appears in browser responses or logs.

## Required evaluator flows

- [x] Current-quarter pipeline returns an evidence-backed answer and missing-data caveat.
- [x] Strongest-sector query returns the normalized-sector result or an honest no-reliable-comparison state.
- [x] Deals needing attention returns reasons and supporting records.
- [x] Work orders at risk returns reasons and supporting records.
- [x] Renewables pipeline-versus-execution uses both boards and states the sector-level join limitation.
- [x] Leadership update can be copied.
- [x] “How are we doing?” asks a targeted clarification.
- [x] “How is Energy performing?” does not silently map to another source sector.
- [x] Follow-up query preserves context: “Mining pipeline?” → “What about Renewables?”

## Submission package

- [x] Hosted application URL included.
- [x] Public GitHub repository URL included.
- [x] `Skylark_Signal_Source_Code.zip` included.
- [x] `Skylark_Signal_Decision_Log.pdf` included.
- [x] README covers architecture, setup, assumptions, trade-offs, AI tools, challenges, limitations, testing, and improvements.
- [ ] Complete the official form: <https://forms.gle/qGihfi4zCLBxKWK68>.
- [x] Recheck all links immediately before submitting.

## Final safety check

- [x] No `.env` file, API token, board credential, personal data export, `.next`, `node_modules`, or tool scratch files are present in the repository or source ZIP.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev` pass.
- [x] Live access and remaining production limitations are stated honestly.
