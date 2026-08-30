import type {
  BoardKind,
  NormalizationIssue,
  NormalizedDataset,
  NormalizedDeal,
  NormalizedWorkOrder,
  RawBoardItem,
  RawMondayColumnValue,
  Severity,
} from "@/lib/types";
import { normalizedKey, titleCase } from "@/lib/utils";

const aliases = {
  deal: {
    owner: ["owner code", "owner", "bd/kam personnel code"],
    client: ["client code", "customer code", "customer name code"],
    status: ["deal status", "status"],
    closeDate: ["close date (a)", "close date", "actual close date"],
    probability: ["closure probability", "probability"],
    value: ["masked deal value", "deal value", "amount", "value"],
    tentativeClose: ["tentative close date", "expected close date"],
    stage: ["deal stage", "stage"],
    product: ["product deal", "product"],
    sector: ["sector/service", "sector", "service sector"],
    created: ["created date", "created at"],
  },
  work: {
    serial: ["serial #", "serial", "serial number", "work order id"],
    customer: ["customer name code", "customer code", "client code"],
    owner: ["bd/kam personnel code", "owner code", "owner"],
    nature: ["nature of work"],
    execution: ["execution status", "status"],
    delivery: ["data delivery date", "delivery date"],
    poDate: ["date of po/loi", "po date", "loi date"],
    start: ["probable start date", "start date"],
    end: ["probable end date", "end date"],
    sector: ["sector", "sector/service"],
    type: ["type of work", "work type"],
    lastInvoice: ["last invoice date"],
    amount: ["amount in rupees (excl of gst) (masked)", "amount excl gst", "total amount"],
    billed: ["billed value in rupees (excl of gst.) (masked)", "billed value excl gst", "billed value"],
    collected: ["collected amount in rupees (incl of gst.) (masked)", "collected amount incl gst", "collected amount"],
    receivable: ["amount receivable (masked)", "amount receivable", "receivable"],
    toBill: ["amount to be billed in rs. (exl. of gst) (masked)", "amount to be billed excl gst"],
    invoiceStatus: ["invoice status"],
    billingStatus: ["billing status"],
  },
} as const;

const dealStatusMap: Record<string, string> = {
  open: "open",
  won: "won",
  dead: "dead",
  lost: "dead",
  "on hold": "on_hold",
  "on-hold": "on_hold",
};

const workStatusMap: Record<string, string> = {
  completed: "completed",
  ongoing: "ongoing",
  "not started": "not_started",
  "executed until current month": "recurring_current",
  "pause / struck": "paused",
  paused: "paused",
  "partial completed": "partially_completed",
  "partially completed": "partially_completed",
  "details pending from client": "details_pending",
};

function issue(
  board: BoardKind,
  itemId: string,
  field: string,
  code: NormalizationIssue["code"],
  severity: Severity,
  message: string,
  original?: unknown,
): NormalizationIssue {
  return { board, itemId, field, code, severity, message, original };
}

function rawValue(column: RawMondayColumnValue | undefined): unknown {
  if (!column) return null;
  if (column.text !== null && column.text.trim() !== "") return column.text;
  return column.value;
}

function field(item: RawBoardItem, names: readonly string[]): unknown {
  for (const name of names) {
    const wanted = normalizedKey(name);
    const column = item.columns.find((candidate) => normalizedKey(candidate.title) === wanted);
    if (column) return rawValue(column);
  }
  return null;
}

function parseText(value: unknown): { value: string | null; display: string | null } {
  if (value === null || value === undefined) return { value: null, display: null };
  const display = String(value).trim().replace(/\s+/g, " ");
  if (!display || ["na", "n/a", "null", "none", "-"].includes(display.toLowerCase())) {
    return { value: null, display: null };
  }
  return { value: normalizedKey(display), display };
}

export function parseNumber(value: unknown): { value: number | null; error?: string } {
  if (value === null || value === undefined || value === "") return { value: null };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value } : { value: null, error: "Number is not finite." };
  }
  let text = String(value).trim();
  if (!text || ["na", "n/a", "null", "none", "-"].includes(text.toLowerCase())) return { value: null };
  const negativeByParentheses = /^\(.*\)$/.test(text);
  text = text.replace(/[₹,$€£\s]/g, "").replace(/[()]/g, "");
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return { value: null, error: "Value could not be parsed as a number." };
  return { value: negativeByParentheses ? -parsed : parsed };
}

export function parseDateValue(value: unknown): { value: Date | null; error?: string; ambiguous?: boolean } {
  if (value === null || value === undefined || value === "") return { value: null };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? { value: null, error: "Date is invalid." } : { value: new Date(value) };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return { value: new Date(excelEpoch + value * 86_400_000) };
  }
  const text = String(value).trim();
  if (!text || ["na", "n/a", "null", "none", "-"].includes(text.toLowerCase())) return { value: null };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (iso) return makeUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const ambiguous = first <= 12 && second <= 12;
    const parsed = makeUtcDate(year, second, first);
    return { ...parsed, ambiguous };
  }

  const native = new Date(text);
  if (!Number.isNaN(native.getTime())) return { value: native };
  return { value: null, error: "Date format is not recognized." };
}

function makeUtcDate(year: number, month: number, day: number): { value: Date | null; error?: string } {
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return { value: null, error: "Date components are invalid." };
  }
  return { value: result };
}

function addMissingIssue(
  issues: NormalizationIssue[],
  board: BoardKind,
  itemId: string,
  fieldName: string,
  value: unknown,
  severity: Severity = "warning",
): void {
  if (value === null || value === undefined || String(value).trim() === "") {
    issues.push(issue(board, itemId, fieldName, "missing_value", severity, `${fieldName} is missing.`));
  }
}

function normalizeDeal(item: RawBoardItem): NormalizedDeal {
  const issues: NormalizationIssue[] = [];
  const statusRaw = field(item, aliases.deal.status);
  const stageRaw = field(item, aliases.deal.stage);
  const sectorRaw = field(item, aliases.deal.sector);
  const valueRaw = field(item, aliases.deal.value);
  const closeRaw = field(item, aliases.deal.closeDate);
  const tentativeRaw = field(item, aliases.deal.tentativeClose);
  const createdRaw = field(item, aliases.deal.created);
  const statusText = parseText(statusRaw);
  const sector = parseText(sectorRaw);
  const parsedValue = parseNumber(valueRaw);
  const closeDate = parseDateValue(closeRaw);
  const tentativeCloseDate = parseDateValue(tentativeRaw);
  const createdDate = parseDateValue(createdRaw);

  const embeddedHeader = normalizedKey(item.name) === "deal name" || normalizedKey(statusRaw as string) === "deal status";
  if (embeddedHeader) {
    issues.push(issue("deals", item.id, "row", "embedded_header", "error", "A repeated spreadsheet header was found inside the data."));
  }
  if (!item.name.trim()) {
    issues.push(issue("deals", item.id, "name", "missing_identifier", "error", "Deal name is missing."));
  }
  addMissingIssue(issues, "deals", item.id, "Deal value", valueRaw);
  addMissingIssue(issues, "deals", item.id, "Sector", sectorRaw);
  addMissingIssue(issues, "deals", item.id, "Deal status", statusRaw, "error");
  if (parsedValue.error) issues.push(issue("deals", item.id, "value", "invalid_number", "error", parsedValue.error, valueRaw));
  if (parsedValue.value !== null && parsedValue.value < 0) {
    issues.push(issue("deals", item.id, "value", "negative_value", "error", "Deal value is negative.", valueRaw));
  }
  if (closeDate.error) issues.push(issue("deals", item.id, "closeDate", "invalid_date", "warning", closeDate.error, closeRaw));
  if (tentativeCloseDate.error) {
    issues.push(issue("deals", item.id, "tentativeCloseDate", "invalid_date", "warning", tentativeCloseDate.error, tentativeRaw));
  }
  if (createdDate.error) issues.push(issue("deals", item.id, "createdDate", "invalid_date", "warning", createdDate.error, createdRaw));
  if (tentativeCloseDate.ambiguous) {
    issues.push(issue("deals", item.id, "tentativeCloseDate", "ambiguous_date", "info", "Ambiguous date interpreted as DD/MM/YYYY.", tentativeRaw));
  }

  const canonicalStatus = statusText.value ? dealStatusMap[statusText.value] ?? null : null;
  if (statusText.value && !canonicalStatus) {
    issues.push(issue("deals", item.id, "status", "unknown_status", "warning", `Unrecognized deal status: ${statusText.display}.`, statusRaw));
  }
  if ((canonicalStatus === "open" || canonicalStatus === "on_hold") && !tentativeCloseDate.value) {
    issues.push(issue("deals", item.id, "tentativeCloseDate", "missing_value", "warning", "Open deal has no usable tentative close date."));
  }

  return {
    id: item.id,
    name: item.name.trim() || "Unnamed deal",
    clientCode: parseText(field(item, aliases.deal.client)).display,
    owner: parseText(field(item, aliases.deal.owner)).display,
    status: canonicalStatus,
    stage: parseText(stageRaw).display,
    sector: sector.value,
    sectorDisplay: sector.display ? titleCase(sector.display.toLowerCase()) : null,
    product: parseText(field(item, aliases.deal.product)).display,
    probability: parseText(field(item, aliases.deal.probability)).value,
    value: parsedValue.value,
    closeDate: closeDate.value,
    tentativeCloseDate: tentativeCloseDate.value,
    createdDate: createdDate.value,
    source: item,
    issues,
    excluded: embeddedHeader || !item.name.trim(),
  };
}

function normalizeWorkOrder(item: RawBoardItem): NormalizedWorkOrder {
  const issues: NormalizationIssue[] = [];
  const serialRaw = field(item, aliases.work.serial);
  const executionRaw = field(item, aliases.work.execution);
  const sectorRaw = field(item, aliases.work.sector);
  const amountRaw = field(item, aliases.work.amount);
  const billedRaw = field(item, aliases.work.billed);
  const collectedRaw = field(item, aliases.work.collected);
  const receivableRaw = field(item, aliases.work.receivable);
  const toBillRaw = field(item, aliases.work.toBill);
  const amount = parseNumber(amountRaw);
  const billed = parseNumber(billedRaw);
  const collected = parseNumber(collectedRaw);
  const receivable = parseNumber(receivableRaw);
  const toBill = parseNumber(toBillRaw);
  const start = parseDateValue(field(item, aliases.work.start));
  const end = parseDateValue(field(item, aliases.work.end));
  const poDate = parseDateValue(field(item, aliases.work.poDate));
  const delivery = parseDateValue(field(item, aliases.work.delivery));
  const lastInvoice = parseDateValue(field(item, aliases.work.lastInvoice));
  const executionText = parseText(executionRaw);
  const canonicalExecution = executionText.value ? workStatusMap[executionText.value] ?? null : null;
  const sector = parseText(sectorRaw);

  if (!parseText(serialRaw).display) {
    issues.push(issue("work_orders", item.id, "serial", "missing_identifier", "error", "Work-order serial is missing."));
  }
  addMissingIssue(issues, "work_orders", item.id, "Execution status", executionRaw, "error");
  addMissingIssue(issues, "work_orders", item.id, "Sector", sectorRaw);
  if (executionText.value && !canonicalExecution) {
    issues.push(issue("work_orders", item.id, "executionStatus", "unknown_status", "warning", `Unrecognized execution status: ${executionText.display}.`, executionRaw));
  }

  const numericFields = [
    ["amountExGst", amount, amountRaw],
    ["billedExGst", billed, billedRaw],
    ["collectedIncGst", collected, collectedRaw],
    ["receivable", receivable, receivableRaw],
    ["amountToBillExGst", toBill, toBillRaw],
  ] as const;
  for (const [fieldName, parsed, original] of numericFields) {
    if (parsed.error) issues.push(issue("work_orders", item.id, fieldName, "invalid_number", "error", parsed.error, original));
    if (parsed.value !== null && parsed.value < 0) {
      issues.push(issue("work_orders", item.id, fieldName, "negative_value", "warning", `${fieldName} is negative and needs review.`, original));
    }
  }

  const dateFields = [
    ["probableStartDate", start, field(item, aliases.work.start)],
    ["probableEndDate", end, field(item, aliases.work.end)],
    ["poDate", poDate, field(item, aliases.work.poDate)],
    ["dataDeliveryDate", delivery, field(item, aliases.work.delivery)],
    ["lastInvoiceDate", lastInvoice, field(item, aliases.work.lastInvoice)],
  ] as const;
  for (const [fieldName, parsed, original] of dateFields) {
    if (parsed.error) issues.push(issue("work_orders", item.id, fieldName, "invalid_date", "warning", parsed.error, original));
    if (parsed.ambiguous) {
      issues.push(issue("work_orders", item.id, fieldName, "ambiguous_date", "info", "Ambiguous date interpreted as DD/MM/YYYY.", original));
    }
  }
  if (start.value && end.value && end.value < start.value) {
    issues.push(issue("work_orders", item.id, "probableEndDate", "date_order", "error", "Probable end date is before the start date."));
  }
  if (amount.value !== null && billed.value !== null && billed.value > amount.value * 1.01) {
    issues.push(issue("work_orders", item.id, "billedExGst", "amount_inconsistency", "warning", "Billed value exceeds the stated pre-GST work-order amount."));
  }

  return {
    id: item.id,
    serial: parseText(serialRaw).display,
    name: item.name.trim() || "Unnamed work order",
    customerCode: parseText(field(item, aliases.work.customer)).display,
    owner: parseText(field(item, aliases.work.owner)).display,
    executionStatus: canonicalExecution,
    sector: sector.value,
    sectorDisplay: sector.display ? titleCase(sector.display.toLowerCase()) : null,
    natureOfWork: parseText(field(item, aliases.work.nature)).display,
    typeOfWork: parseText(field(item, aliases.work.type)).display,
    poDate: poDate.value,
    probableStartDate: start.value,
    probableEndDate: end.value,
    dataDeliveryDate: delivery.value,
    lastInvoiceDate: lastInvoice.value,
    amountExGst: amount.value,
    billedExGst: billed.value,
    collectedIncGst: collected.value,
    receivable: receivable.value,
    amountToBillExGst: toBill.value,
    invoiceStatus: parseText(field(item, aliases.work.invoiceStatus)).value,
    billingStatus: parseText(field(item, aliases.work.billingStatus)).value,
    source: item,
    issues,
    excluded: !parseText(serialRaw).display,
  };
}

function markDealDuplicates(deals: NormalizedDeal[]): void {
  const seen = new Map<string, string>();
  for (const deal of deals) {
    if (deal.excluded) continue;
    const fingerprint = [
      normalizedKey(deal.name),
      normalizedKey(deal.clientCode),
      deal.status,
      deal.value,
      deal.tentativeCloseDate?.toISOString().slice(0, 10),
      normalizedKey(deal.stage),
    ].join("|");
    const originalId = seen.get(fingerprint);
    if (originalId) {
      deal.excluded = true;
      deal.issues.push(
        issue("deals", deal.id, "row", "duplicate_record", "warning", `Duplicate-like record; matches item ${originalId}.`),
      );
    } else {
      seen.set(fingerprint, deal.id);
    }
  }
}

export function normalizeSnapshot(snapshot: { deals: { items: RawBoardItem[] }; workOrders: { items: RawBoardItem[] } }): NormalizedDataset {
  const deals = snapshot.deals.items.map(normalizeDeal);
  const workOrders = snapshot.workOrders.items.map(normalizeWorkOrder);
  markDealDuplicates(deals);
  const issues = [...deals.flatMap((deal) => deal.issues), ...workOrders.flatMap((order) => order.issues)];
  return { deals, workOrders, issues };
}
