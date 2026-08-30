# Submission Checklist

## Public links

- [ ] Open the hosted application in a private/incognito window.
- [ ] Open the GitHub repository while signed out.
- [ ] Confirm the source ZIP downloads and extracts successfully.
- [ ] Confirm the Decision Log PDF is exactly two pages.

## Live integration

- [ ] Set `MONDAY_API_TOKEN`, `MONDAY_DEALS_BOARD_ID`, and `MONDAY_WORK_ORDERS_BOARD_ID` in the deployment environment.
- [ ] Optionally set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`; deterministic planning remains available without them.
- [ ] Redeploy after setting environment variables.
- [ ] Confirm the header reports **Live**, not **Demo**.
- [ ] Ask one Deals query, one Work Orders query, and one cross-board query against live boards.
- [ ] Confirm the Monday token has read-only board access and is absent from browser responses and logs.

## Required evaluator flows

- [ ] Current-quarter pipeline returns an evidence-backed answer and missing-data caveat.
- [ ] Strongest-sector query ranks normalized sectors.
- [ ] Deals needing attention returns reasons and supporting records.
- [ ] Work orders at risk returns reasons and supporting records.
- [ ] Renewables pipeline-versus-execution uses both boards and states the sector-level join limitation.
- [ ] Leadership update can be copied.
- [ ] “How are we doing?” asks a targeted clarification.
- [ ] “How is Energy performing?” does not silently map to another source sector.
- [ ] Follow-up query preserves context: “Mining pipeline?” → “What about Renewables?”

## Submission package

- [ ] Hosted application URL included.
- [ ] Public GitHub repository URL included.
- [ ] `Skylark_Signal_Source_Code.zip` included.
- [ ] `Skylark_Signal_Decision_Log.pdf` included.
- [ ] README covers architecture, setup, assumptions, trade-offs, AI tools, challenges, limitations, testing, and improvements.
- [ ] Complete the official form: <https://forms.gle/qGihfi4zCLBxKWK68>.
- [ ] Recheck all links immediately before submitting.

## Final safety check

- [ ] No `.env` file, API token, board credential, personal data export, `.next`, `node_modules`, or tool scratch files are present in the repository or source ZIP.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev` pass.
- [ ] Known limitation is stated honestly if live credentials could not be configured before submission.
