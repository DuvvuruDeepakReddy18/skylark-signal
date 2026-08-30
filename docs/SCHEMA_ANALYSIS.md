# Dataset and Schema Analysis

## Download anomaly

The links embedded in the assignment produce filenames whose contents are swapped:

- `deal-funnel.xlsx` → sheet **work order tracker**
- `work-order-tracker.xlsx` → sheet **Deal tracker**

The application maps the board role explicitly; it never trusts a local filename.

## Work Orders

- Grain: one work order per row.
- Rows/columns: 176 × 38.
- Strong identifier: `Serial #` is complete and unique (176/176).
- Primary dimensions: Sector, Execution Status, Nature of Work, Type of Work, Owner.
- Primary metrics: contract amount excl./incl. GST, billed excl./incl. GST, collected incl. GST, amount to bill, receivable.
- Primary dates: PO/LOI, probable start/end, delivery, last invoice.

Material issues:

- Delivery date 67% null; last invoice date 51% null.
- Collected amount 56% null.
- Expected Billing Month, Actual Collection Month, Collection Status, and Collection Date are 100% null.
- `Amount to be billed` contains six negatives; `Amount Receivable` contains eleven negatives.
- `Balance in quantity` contains negatives and `Quantities as per PO` mixes numbers with values such as `NA` and `45days`.
- Billing labels include the case typo `BIlled`.
- Probable end dates extend to 2028, requiring current-date-aware rules.

## Deals

- Grain: intended one deal per row, but duplicate rows exist.
- Rows/columns: 346 × 12.
- Dimensions: Deal Status, Deal Stage, Closure Probability, Product, Sector/service, Owner.
- Metric: Masked Deal value.
- Dates: Close Date, Tentative Close Date, Created Date.

Material issues:

- 12 exact duplicate rows across eight duplicate groups.
- Repeated header rows at spreadsheet rows 52 and 181.
- Close Date is 92% null; Closure Probability 75% null; Deal Value 52% null.
- Tentative Close Date is 21% null.
- Repeated headers leak category values such as `Deal Status`, `Closure Probability`, `Product deal`, and `Sector/service`.
- Deal Stage has 17 labels that mix lettered funnel stages with unlettered completed states.

## Relationships

Both datasets share six normalized sectors: Construction, Mining, Others, Powerline, Railways, Renewables. Deals additionally contain Aviation, DSP, Manufacturing, Security and Surveillance, and Tender after embedded-header exclusion.

There are 52 shared masked deal names, but 36 are non-unique in at least one dataset. Customer-code namespaces differ (`COMPANY…` vs `WOCOMPANY_…`). Therefore:

- safe aggregate join: normalized sector;
- unsafe without mapping: masked deal name or customer code;
- desired production improvement: explicit shared deal/work-order ID.

## Metric consequences

- Revenue is defined as billed value excluding GST, not formal recognized revenue.
- Current-quarter pipeline uses Tentative Close Date and must disclose excluded undated deals.
- Deal staleness cannot use “last activity” because no activity field exists.
- Quantity utilization is not a default KPI because the quantity field mixes units and text.
