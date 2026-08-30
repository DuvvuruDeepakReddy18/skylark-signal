import { summarizeIssues } from "@/lib/data/quality";
import type {
  BusinessPulse,
  ChartDatum,
  DataQualitySummary,
  EvidencePoint,
  InsightAnswer,
  LineageStep,
  NormalizedDataset,
  NormalizedDeal,
  NormalizedWorkOrder,
  ProactiveSignal,
  QueryPeriod,
  QueryPlan,
  SectorSignal,
  SupportingRecord,
} from "@/lib/types";
import {
  clamp,
  daysBetween,
  endOfQuarter,
  formatCount,
  formatInr,
  isoDate,
  isWithin,
  normalizedKey,
  startOfQuarter,
  titleCase,
} from "@/lib/utils";

function usableDeals(dataset: NormalizedDataset): NormalizedDeal[] {
  return dataset.deals.filter((deal) => !deal.excluded);
}

function usableWorkOrders(dataset: NormalizedDataset): NormalizedWorkOrder[] {
  return dataset.workOrders.filter((order) => !order.excluded);
}

function periodBounds(period: QueryPeriod, now: Date): { start: Date | null; end: Date | null; label: string } {
  if (period === "current_quarter") {
    return { start: startOfQuarter(now), end: endOfQuarter(now), label: "current quarter" };
  }
  if (period === "last_90_days") {
    return { start: new Date(now.getTime() - 90 * 86_400_000), end: now, label: "last 90 days" };
  }
  return { start: null, end: null, label: "full available history" };
}

function openDeals(deals: NormalizedDeal[]): NormalizedDeal[] {
  return deals.filter((deal) => deal.status === "open" || deal.status === "on_hold");
}

function filterDeals(
  dataset: NormalizedDataset,
  plan: QueryPlan,
  now: Date,
): { records: NormalizedDeal[]; missingDates: number; invalidValues: number; periodLabel: string } {
  const bounds = periodBounds(plan.period, now);
  const bySector = usableDeals(dataset).filter(
    (deal) => !plan.sector || normalizedKey(deal.sector) === normalizedKey(plan.sector),
  );
  const active = openDeals(bySector);
  const invalidValues = active.filter((deal) => deal.value === null).length;
  const missingDates = active.filter((deal) => !deal.tentativeCloseDate).length;
  const records = active.filter((deal) => {
    if (!bounds.start || !bounds.end) return true;
    return isWithin(deal.tentativeCloseDate, bounds.start, bounds.end);
  });
  return { records, missingDates, invalidValues, periodLabel: bounds.label };
}

function sumDealValue(records: NormalizedDeal[]): number {
  return records.reduce((sum, record) => sum + (record.value ?? 0), 0);
}

function sumBilled(records: NormalizedWorkOrder[]): number {
  return records.reduce((sum, record) => sum + (record.billedExGst ?? 0), 0);
}

function isLateStage(deal: NormalizedDeal): boolean {
  return /proposal|commercial|negotiat|project won|work order/i.test(deal.stage ?? "");
}

function workOrderRisk(order: NormalizedWorkOrder, now: Date): string | null {
  if (order.executionStatus === "paused") return "Execution is paused or stuck";
  if (order.executionStatus === "details_pending") return "Client details are pending";
  if (order.executionStatus === "not_started" && order.probableStartDate && order.probableStartDate < now) {
    return "Start date has passed but execution has not started";
  }
  if (
    ["ongoing", "recurring_current", "partially_completed"].includes(order.executionStatus ?? "") &&
    order.probableEndDate &&
    order.probableEndDate < now
  ) {
    return "Probable end date has passed while work remains active";
  }
  return null;
}

function dealAttentionReason(deal: NormalizedDeal, now: Date): string | null {
  if (deal.status === "on_hold") return "Deal is on hold";
  if (deal.tentativeCloseDate && deal.tentativeCloseDate < now) return "Tentative close date has passed";
  if (!deal.tentativeCloseDate) return "Missing tentative close date";
  if (deal.createdDate && daysBetween(now, deal.createdDate) > 180 && !isLateStage(deal)) {
    return "Older than 180 days and still early-stage";
  }
  if (deal.value === null) return "Missing deal value";
  return null;
}

function recordFromDeal(deal: NormalizedDeal, reason?: string): SupportingRecord {
  return {
    id: deal.id,
    name: deal.name,
    board: "deals",
    sector: deal.sectorDisplay,
    status: deal.status,
    value: deal.value,
    date: isoDate(deal.tentativeCloseDate),
    reason,
  };
}

function recordFromWorkOrder(order: NormalizedWorkOrder, reason?: string): SupportingRecord {
  return {
    id: order.id,
    name: order.name,
    board: "work_orders",
    sector: order.sectorDisplay,
    status: order.executionStatus,
    value: order.amountExGst,
    date: isoDate(order.probableEndDate),
    reason,
  };
}

function confidenceLabel(score: number): InsightAnswer["confidenceLabel"] {
  if (score >= 85) return "High";
  if (score >= 65) return "Medium";
  return "Low";
}

function answerBase(plan: QueryPlan, quality: DataQualitySummary, confidenceAdjustment = 0): Pick<InsightAnswer, "generatedAt" | "plan" | "confidence" | "confidenceLabel"> {
  const confidence = Math.round(clamp(quality.score + confidenceAdjustment, 35, 98));
  return { generatedAt: new Date().toISOString(), plan, confidence, confidenceLabel: confidenceLabel(confidence) };
}

function emptyChart(title: string): { title: string; data: ChartDatum[] } {
  return { title, data: [] };
}

function pipelineAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  const filtered = filterDeals(dataset, plan, now);
  const validValueDeals = filtered.records.filter((deal) => deal.value !== null);
  const pipelineValue = sumDealValue(validValueDeals);
  const lateStage = validValueDeals.filter(isLateStage);
  const lateStageValue = sumDealValue(lateStage);
  const attention = filtered.records
    .map((deal) => ({ deal, reason: dealAttentionReason(deal, now) }))
    .filter((entry): entry is { deal: NormalizedDeal; reason: string } => Boolean(entry.reason));
  const sectorName = plan.sector ? titleCase(plan.sector) : "Company";
  const lateShare = pipelineValue ? lateStageValue / pipelineValue : 0;
  const caveats = [
    ...(filtered.missingDates ? [`${filtered.missingDates} active deals lack a usable tentative close date and are excluded from period filtering.`] : []),
    ...(filtered.invalidValues ? [`${filtered.invalidValues} matching deals have no usable deal value.`] : []),
    ...summarizeIssues(dataset.issues, { board: "deals", fields: ["value", "date", "row"] }).slice(0, 2),
  ];
  const stageMap = new Map<string, number>();
  for (const deal of validValueDeals) {
    const stage = deal.stage ?? "Unknown stage";
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + (deal.value ?? 0));
  }
  const chart = {
    title: "Pipeline value by stage",
    data: [...stageMap.entries()]
      .map(([label, value]) => ({ label, value, formatted: formatInr(value) }))
      .sort((a, b) => b.value - a.value),
  };
  const evidence: EvidencePoint[] = [
    { label: "Active opportunities", value: formatCount(filtered.records.length) },
    { label: "Late-stage value", value: formatInr(lateStageValue), tone: lateShare >= 0.35 ? "positive" : "warning" },
    { label: "Needs attention", value: formatCount(attention.length), tone: attention.length ? "warning" : "positive" },
  ];
  const lineage: LineageStep[] = [
    { label: "Source", detail: "Monday.com Deals board" },
    { label: "Scope", detail: `${filtered.records.length} open/on-hold records for ${sectorName}; ${filtered.periodLabel}` },
    { label: "Normalization", detail: "Deal values parsed as INR; sectors, stages, statuses, and dates normalized while raw values were retained" },
    { label: "Calculation", detail: `SUM(valid deal value) across ${validValueDeals.length} included records` },
    { label: "Exclusions", detail: `${filtered.invalidValues} invalid/missing values; ${filtered.missingDates} missing dates relevant to period filters` },
  ];

  return {
    eyebrow: `${sectorName.toUpperCase()} PIPELINE`,
    headline: pipelineValue
      ? `${sectorName} has ${formatInr(pipelineValue)} in active pipeline for the ${filtered.periodLabel}.`
      : `No reliable active pipeline value was found for ${sectorName} in the ${filtered.periodLabel}.`,
    keyMetric: formatInr(pipelineValue),
    metricLabel: `active pipeline · ${filtered.periodLabel}`,
    signal: pipelineValue
      ? lateShare >= 0.35
        ? "Pipeline has meaningful late-stage coverage, but attention items still need ownership."
        : "Pipeline volume exists, but too little value is late-stage to treat it as near-term confidence."
      : "The available records cannot support a reliable pipeline total for this filter.",
    evidence,
    risk: attention.length
      ? `${attention.length} matching opportunities are overdue, on hold, missing dates, or aging in an early stage.`
      : "No rule-based attention flags were detected in the matching records.",
    action: attention.length
      ? `Review the ${Math.min(3, attention.length)} highest-value attention items and confirm close dates, next owners, and stage accuracy.`
      : "Protect conversion by validating next steps on the largest late-stage opportunities.",
    caveats: caveats.length ? caveats : ["No material data-quality caveat affected this calculation."],
    sources: ["Monday.com → Deals"],
    lineage,
    records: attention
      .sort((a, b) => (b.deal.value ?? 0) - (a.deal.value ?? 0))
      .slice(0, 8)
      .map(({ deal, reason }) => recordFromDeal(deal, reason)),
    chart,
    ...answerBase(plan, quality, -Math.min(18, caveats.length * 3)),
  };
}

function strongestSectorAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary): InsightAnswer {
  const active = openDeals(usableDeals(dataset)).filter((deal) => deal.value !== null && deal.sector);
  const groups = new Map<string, { value: number; count: number; label: string }>();
  for (const deal of active) {
    const key = deal.sector as string;
    const current = groups.get(key) ?? { value: 0, count: 0, label: deal.sectorDisplay ?? titleCase(key) };
    current.value += deal.value ?? 0;
    current.count += 1;
    groups.set(key, current);
  }
  const ranked = [...groups.values()].sort((a, b) => b.value - a.value);
  const strongest = ranked[0];
  const chart = {
    title: "Active pipeline by sector",
    data: ranked.map((entry) => ({ label: entry.label, value: entry.value, formatted: formatInr(entry.value) })),
  };
  return {
    eyebrow: "SECTOR SIGNAL",
    headline: strongest ? `${strongest.label} has the strongest active pipeline at ${formatInr(strongest.value)}.` : "No reliable sector pipeline comparison is available.",
    keyMetric: strongest ? formatInr(strongest.value) : formatInr(0),
    metricLabel: strongest ? `${strongest.count} open opportunities` : "no comparable opportunities",
    signal: strongest && ranked[1]
      ? `${strongest.label} leads ${ranked[1].label} by ${formatInr(strongest.value - ranked[1].value)} in active value.`
      : "The current data does not contain enough comparable sectors.",
    evidence: ranked.slice(0, 3).map((entry, index) => ({ label: `#${index + 1} ${entry.label}`, value: formatInr(entry.value) })),
    risk: "A large pipeline does not equal forecast confidence; stage mix and close-date completeness still matter.",
    action: strongest ? `Inspect ${strongest.label}'s late-stage concentration and overdue close dates before allocating leadership attention.` : "Improve sector and deal-value completeness before comparing performance.",
    caveats: summarizeIssues(dataset.issues, { board: "deals", fields: ["value", "sector", "date"] }),
    sources: ["Monday.com → Deals"],
    lineage: [
      { label: "Source", detail: "Monday.com Deals board" },
      { label: "Scope", detail: `${active.length} usable open/on-hold deals with sector and value` },
      { label: "Calculation", detail: "SUM(valid deal value), grouped by normalized sector" },
      { label: "Ranking", detail: "Sectors sorted by active pipeline value; no probability weighting was invented" },
    ],
    records: strongest
      ? active.filter((deal) => deal.sectorDisplay === strongest.label).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 8).map((deal) => recordFromDeal(deal))
      : [],
    chart,
    ...answerBase(plan, quality, -4),
  };
}

function dealsAttentionAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  const candidates = openDeals(usableDeals(dataset))
    .filter((deal) => !plan.sector || deal.sector === normalizedKey(plan.sector))
    .map((deal) => ({ deal, reason: dealAttentionReason(deal, now) }))
    .filter((entry): entry is { deal: NormalizedDeal; reason: string } => Boolean(entry.reason))
    .sort((a, b) => (b.deal.value ?? 0) - (a.deal.value ?? 0));
  const exposedValue = sumDealValue(candidates.map((entry) => entry.deal));
  return {
    eyebrow: "DEAL ATTENTION",
    headline: `${candidates.length} active deals worth ${formatInr(exposedValue)} need a closer look.`,
    keyMetric: formatCount(candidates.length),
    metricLabel: "rule-based attention flags",
    signal: candidates.length ? "Commercial attention is concentrated in overdue, on-hold, undated, or aging early-stage opportunities." : "No active deal breached the configured attention rules.",
    evidence: [
      { label: "Value exposed", value: formatInr(exposedValue), tone: candidates.length ? "warning" : "positive" },
      { label: "Overdue", value: String(candidates.filter((item) => item.reason.includes("passed")).length) },
      { label: "Missing dates", value: String(candidates.filter((item) => item.reason.includes("Missing")).length) },
    ],
    risk: candidates[0] ? `The largest flagged item is ${candidates[0].deal.name} at ${formatInr(candidates[0].deal.value ?? 0)}.` : "No immediate rule-based risk is visible.",
    action: candidates.length ? "Assign a next step, owner, and verified close date to the top three flagged opportunities this week." : "Continue monitoring close-date slippage and stage aging.",
    caveats: ["The source data has no recent-activity field, so staleness is inferred from dates and stage age—not engagement history.", ...summarizeIssues(dataset.issues, { board: "deals" }).slice(0, 2)],
    sources: ["Monday.com → Deals"],
    lineage: [
      { label: "Source", detail: "Usable open/on-hold Deals records" },
      { label: "Rules", detail: "Past tentative close date, on-hold status, missing close date/value, or >180 days old in an early stage" },
      { label: "Ordering", detail: "Flagged records sorted by valid deal value, descending" },
    ],
    records: candidates.slice(0, 10).map(({ deal, reason }) => recordFromDeal(deal, reason)),
    chart: emptyChart("Attention value by reason"),
    ...answerBase(plan, quality, -6),
  };
}

function workOrdersRiskAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  const active = usableWorkOrders(dataset).filter(
    (order) =>
      order.executionStatus !== "completed" &&
      (!plan.sector || order.sector === normalizedKey(plan.sector)),
  );
  const atRisk = active
    .map((order) => ({ order, reason: workOrderRisk(order, now) }))
    .filter((entry): entry is { order: NormalizedWorkOrder; reason: string } => Boolean(entry.reason))
    .sort((a, b) => (b.order.amountExGst ?? 0) - (a.order.amountExGst ?? 0));
  const atRiskValue = atRisk.reduce((sum, entry) => sum + (entry.order.amountExGst ?? 0), 0);
  const riskRate = active.length ? atRisk.length / active.length : 0;
  return {
    eyebrow: "OPERATIONS SIGNAL",
    headline: `${atRisk.length} of ${active.length} active work orders are at risk under the execution rules.`,
    keyMetric: `${Math.round(riskRate * 100)}%`,
    metricLabel: "active work orders at risk",
    signal: riskRate > 0.3 ? "Execution risk is broad enough to need leadership attention." : "Execution is mostly controlled, with a focused set of exceptions.",
    evidence: [
      { label: "Active work orders", value: String(active.length) },
      { label: "At-risk value", value: formatInr(atRiskValue), tone: atRisk.length ? "warning" : "positive" },
      { label: "Paused / stuck", value: String(atRisk.filter((entry) => entry.order.executionStatus === "paused").length) },
    ],
    risk: atRisk[0] ? `${atRisk[0].order.name} is the largest flagged work order at ${formatInr(atRisk[0].order.amountExGst ?? 0)}.` : "No work order currently breaches the transparent risk rules.",
    action: atRisk.length ? "Confirm recovery owner and revised delivery date for the highest-value paused or overdue work orders." : "Maintain weekly exception monitoring and date hygiene.",
    caveats: ["Risk is rule-based from status and planned dates; the source has no explicit operational risk score.", ...summarizeIssues(dataset.issues, { board: "work_orders" }).slice(0, 3)],
    sources: ["Monday.com → Work Orders"],
    lineage: [
      { label: "Source", detail: "Monday.com Work Orders board" },
      { label: "Active scope", detail: "All usable records not normalized to completed" },
      { label: "Risk rules", detail: "Paused/stuck, client details pending, planned start passed but not started, or planned end passed while still active" },
      { label: "No invention", detail: "No missing dates or statuses were imputed" },
    ],
    records: atRisk.slice(0, 10).map(({ order, reason }) => recordFromWorkOrder(order, reason)),
    ...answerBase(plan, quality, -5),
  };
}

function revenueAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  const bounds = periodBounds(plan.period, now);
  const orders = usableWorkOrders(dataset).filter(
    (order) => !plan.sector || order.sector === normalizedKey(plan.sector),
  );
  const dated = orders.filter((order) => {
    if (!bounds.start || !bounds.end) return true;
    return isWithin(order.lastInvoiceDate, bounds.start, bounds.end);
  });
  const withBilled = dated.filter((order) => order.billedExGst !== null);
  const revenue = sumBilled(withBilled);
  const missingInvoiceDates = orders.filter((order) => !order.lastInvoiceDate && (order.billedExGst ?? 0) > 0).length;
  const receivable = dated.reduce((sum, order) => sum + Math.max(0, order.receivable ?? 0), 0);
  return {
    eyebrow: "REVENUE SIGNAL",
    headline: `${formatInr(revenue)} has been billed excluding GST for the ${bounds.label}.`,
    keyMetric: formatInr(revenue),
    metricLabel: `billed value excl. GST · ${bounds.label}`,
    signal: "Revenue is defined as billed value excluding GST; this is an auditable billing measure, not accounting-recognized revenue.",
    evidence: [
      { label: "Included work orders", value: String(withBilled.length) },
      { label: "Receivable", value: formatInr(receivable), tone: receivable > 0 ? "warning" : "positive" },
      { label: "Missing invoice dates", value: String(missingInvoiceDates), tone: missingInvoiceDates ? "warning" : "positive" },
    ],
    risk: missingInvoiceDates ? `${missingInvoiceDates} billed records have no last invoice date, so period revenue may be understated.` : "No billed records were excluded solely for a missing invoice date.",
    action: missingInvoiceDates ? "Backfill invoice dates before using this number for a period-close leadership report." : "Reconcile receivables against collection timing for the largest billed accounts.",
    caveats: ["Revenue is interpreted as billed value excluding GST because the source does not contain an accounting revenue-recognition field.", ...summarizeIssues(dataset.issues, { board: "work_orders", fields: ["billed", "invoice", "amount"] }).slice(0, 3)],
    sources: ["Monday.com → Work Orders"],
    lineage: [
      { label: "Source", detail: "Work Orders → Billed Value in Rupees (Excl of GST.)" },
      { label: "Period", detail: bounds.start ? `Last invoice date within ${bounds.label}` : "No date filter" },
      { label: "Calculation", detail: `SUM(valid billed value excl. GST) across ${withBilled.length} records` },
      { label: "Exclusions", detail: `${missingInvoiceDates} billed records without invoice dates for period analysis` },
    ],
    records: withBilled.sort((a, b) => (b.billedExGst ?? 0) - (a.billedExGst ?? 0)).slice(0, 8).map((order) => recordFromWorkOrder(order)),
    ...answerBase(plan, quality, -Math.min(20, missingInvoiceDates * 2)),
  };
}

export function computeSectorSignals(dataset: NormalizedDataset, now = new Date()): SectorSignal[] {
  const deals = openDeals(usableDeals(dataset));
  const workOrders = usableWorkOrders(dataset);
  const sectors = new Set<string>([
    ...deals.map((deal) => deal.sector).filter((value): value is string => Boolean(value)),
    ...workOrders.map((order) => order.sector).filter((value): value is string => Boolean(value)),
  ]);
  const raw = [...sectors].map((sector) => {
    const sectorDeals = deals.filter((deal) => deal.sector === sector);
    const sectorOrders = workOrders.filter((order) => order.sector === sector && order.executionStatus !== "completed");
    const atRisk = sectorOrders.filter((order) => workOrderRisk(order, now));
    return {
      sector: titleCase(sector),
      pipelineValue: sumDealValue(sectorDeals),
      openDeals: sectorDeals.length,
      activeWorkOrders: sectorOrders.length,
      atRiskWorkOrders: atRisk.length,
    };
  });
  const maxPipeline = Math.max(...raw.map((entry) => entry.pipelineValue), 1);
  return raw
    .map((entry) => {
      const pipelineScore = Math.round((entry.pipelineValue / maxPipeline) * 100);
      const executionScore = entry.activeWorkOrders
        ? Math.round((1 - entry.atRiskWorkOrders / entry.activeWorkOrders) * 100)
        : 70;
      const overall: SectorSignal["overall"] = executionScore < 50
        ? "risk"
        : pipelineScore >= 45 && executionScore >= 70
          ? "healthy"
          : "watch";
      return { ...entry, pipelineScore, executionScore, overall };
    })
    .sort((a, b) => b.pipelineValue - a.pipelineValue);
}

function crossBoardAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  const allSignals = computeSectorSignals(dataset, now);
  const signals = plan.sector
    ? allSignals.filter((signal) => normalizedKey(signal.sector) === normalizedKey(plan.sector))
    : allSignals;
  const mismatch = [...signals].sort((a, b) => (b.pipelineScore - b.executionScore) - (a.pipelineScore - a.executionScore))[0];
  const key = mismatch ?? signals[0];
  const records = key
    ? [
        ...openDeals(usableDeals(dataset)).filter((deal) => deal.sector === normalizedKey(key.sector)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 4).map((deal) => recordFromDeal(deal)),
        ...usableWorkOrders(dataset).filter((order) => order.sector === normalizedKey(key.sector) && workOrderRisk(order, now)).slice(0, 4).map((order) => recordFromWorkOrder(order, workOrderRisk(order, now) ?? undefined)),
      ]
    : [];
  return {
    eyebrow: "CROSS-BOARD SIGNAL",
    headline: key ? `${key.sector} pairs ${formatInr(key.pipelineValue)} of pipeline with ${key.atRiskWorkOrders} at-risk work orders.` : "No reliable sector-level cross-board comparison is available.",
    keyMetric: key ? key.sector : "No sector",
    metricLabel: "largest pipeline-to-execution gap",
    signal: key
      ? key.pipelineScore > key.executionScore + 20
        ? "Sales strength is running ahead of execution health—a potential capacity or delivery warning."
        : "Pipeline and execution health are comparatively balanced at sector level."
      : "Sector classification is insufficient for cross-board analysis.",
    evidence: key ? [
      { label: "Pipeline", value: formatInr(key.pipelineValue) },
      { label: "Open deals", value: String(key.openDeals) },
      { label: "Execution health", value: `${key.executionScore}%`, tone: key.executionScore < 60 ? "warning" : "positive" },
      { label: "At-risk work orders", value: String(key.atRiskWorkOrders), tone: key.atRiskWorkOrders ? "warning" : "positive" },
    ] : [],
    risk: key && key.pipelineScore > key.executionScore + 20 ? "New sales could increase delivery pressure if existing operational exceptions remain unresolved." : "No severe pipeline/execution mismatch is visible under the defined scoring model.",
    action: key ? `Review ${key.sector} capacity, recovery plans, and sales commitments together before the next leadership meeting.` : "Standardize sector values on both boards to enable comparison.",
    caveats: ["Cross-board analysis joins aggregated normalized sector values only; masked deal names and customer codes are not a safe row-level key.", ...summarizeIssues(dataset.issues).slice(0, 2)],
    sources: ["Monday.com → Deals", "Monday.com → Work Orders"],
    lineage: [
      { label: "Deals", detail: "Active pipeline summed by normalized sector" },
      { label: "Work Orders", detail: "Active and rule-based at-risk execution counts by normalized sector" },
      { label: "Join", detail: "Aggregate LEFT/FULL comparison on normalized sector—not masked names" },
      { label: "Scoring", detail: "Pipeline strength indexed to the largest sector; execution health = 1 − at-risk/active" },
    ],
    records,
    chart: {
      title: "Pipeline strength vs execution health",
      data: signals.map((signal) => ({ label: signal.sector, value: signal.pipelineScore - signal.executionScore, formatted: `${signal.pipelineScore}/${signal.executionScore}` })),
    },
    ...answerBase(plan, quality, -6),
  };
}

function dataQualityAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary): InsightAnswer {
  return {
    eyebrow: "DATA QUALITY",
    headline: `${quality.usableRecords} of ${quality.totalRecords} records are usable, with a ${quality.score}% reliability score.`,
    keyMetric: `${quality.score}%`,
    metricLabel: "data reliability score",
    signal: quality.score >= 85 ? "The data is broadly usable, with caveats concentrated in specific fields." : "Material gaps or suspicious records can affect confidence in some metrics.",
    evidence: [
      { label: "Usable records", value: String(quality.usableRecords), tone: "positive" },
      { label: "Errors", value: String(quality.countsBySeverity.error), tone: quality.countsBySeverity.error ? "warning" : "positive" },
      { label: "Warnings", value: String(quality.countsBySeverity.warning) },
    ],
    risk: quality.highlights[0] ? `${quality.highlights[0].count} instances of ${quality.highlights[0].label.toLowerCase()} are the most material current issue.` : "No material quality issue was detected.",
    action: "Prioritize identifiers, amount fields, status taxonomy, and close/invoice dates because they directly control analytical reliability.",
    caveats: quality.highlights.map((highlight) => `${highlight.count} ${highlight.label.toLowerCase()}`),
    sources: ["Monday.com → Deals", "Monday.com → Work Orders"],
    lineage: [
      { label: "Checks", detail: "Completeness, parseability, status recognition, duplicates, date order, and amount consistency" },
      { label: "Scoring", detail: "Severity-weighted issue rate plus exclusion rate; it represents data reliability, not AI certainty" },
      { label: "Preservation", detail: "Original Monday values remain attached to each normalized record" },
    ],
    records: [],
    ...answerBase(plan, quality),
  };
}

function leadershipAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  const active = openDeals(usableDeals(dataset));
  const pipeline = sumDealValue(active);
  const revenue = sumBilled(usableWorkOrders(dataset));
  const attention = active.filter((deal) => dealAttentionReason(deal, now));
  const activeOrders = usableWorkOrders(dataset).filter((order) => order.executionStatus !== "completed");
  const atRisk = activeOrders.filter((order) => workOrderRisk(order, now));
  const sector = computeSectorSignals(dataset, now)[0];
  return {
    eyebrow: "WEEKLY BUSINESS SIGNAL",
    headline: `Pipeline is ${formatInr(pipeline)}, billed revenue is ${formatInr(revenue)}, and ${atRisk.length} operations need attention.`,
    keyMetric: formatInr(pipeline),
    metricLabel: "active pipeline",
    signal: sector ? `${sector.sector} is the largest pipeline sector; execution health there is ${sector.executionScore}%.` : "Sector classification is not strong enough to name a leader.",
    evidence: [
      { label: "Billed revenue", value: formatInr(revenue) },
      { label: "Deals needing attention", value: String(attention.length), tone: attention.length ? "warning" : "positive" },
      { label: "At-risk operations", value: String(atRisk.length), tone: atRisk.length ? "warning" : "positive" },
      { label: "Data reliability", value: `${quality.score}%` },
    ],
    risk: `${attention.length} deals and ${atRisk.length} work orders currently breach transparent attention rules.`,
    action: "Leadership should review the top three commercial exceptions, the highest-value execution recovery plans, and missing dates before the weekly close.",
    caveats: ["Generated from the current Monday.com snapshot; revenue means billed value excluding GST.", ...summarizeIssues(dataset.issues).slice(0, 3)],
    sources: ["Monday.com → Deals", "Monday.com → Work Orders"],
    lineage: [
      { label: "Commercial", detail: "Open/on-hold pipeline, stage mix, overdue and incomplete opportunities" },
      { label: "Revenue", detail: "Cumulative billed value excluding GST" },
      { label: "Operations", detail: "Active and rule-based at-risk work orders" },
      { label: "Trust", detail: "Data-quality score and material caveats included in the briefing" },
    ],
    records: [
      ...attention.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 4).map((deal) => recordFromDeal(deal, dealAttentionReason(deal, now) ?? undefined)),
      ...atRisk.sort((a, b) => (b.amountExGst ?? 0) - (a.amountExGst ?? 0)).slice(0, 4).map((order) => recordFromWorkOrder(order, workOrderRisk(order, now) ?? undefined)),
    ],
    ...answerBase(plan, quality, -4),
  };
}

function sectorPerformanceAnswer(plan: QueryPlan, dataset: NormalizedDataset, quality: DataQualitySummary, now: Date): InsightAnswer {
  return crossBoardAnswer({ ...plan, intent: "cross_board", boards: ["deals", "work_orders"] }, dataset, quality, now);
}

export function buildInsightAnswer(
  plan: QueryPlan,
  dataset: NormalizedDataset,
  quality: DataQualitySummary,
  now = new Date(),
): InsightAnswer {
  switch (plan.intent) {
    case "pipeline_health":
      return pipelineAnswer(plan, dataset, quality, now);
    case "strongest_sector":
      return strongestSectorAnswer(plan, dataset, quality);
    case "deals_attention":
      return dealsAttentionAnswer(plan, dataset, quality, now);
    case "work_orders_risk":
    case "operational_summary":
      return workOrdersRiskAnswer(plan, dataset, quality, now);
    case "revenue":
      return revenueAnswer(plan, dataset, quality, now);
    case "cross_board":
      return crossBoardAnswer(plan, dataset, quality, now);
    case "sector_performance":
      return sectorPerformanceAnswer(plan, dataset, quality, now);
    case "leadership_update":
      return leadershipAnswer(plan, dataset, quality, now);
    case "data_quality":
      return dataQualityAnswer(plan, dataset, quality);
    case "clarification":
      return {
        eyebrow: "CLARIFICATION",
        headline: plan.clarificationQuestion ?? "Which business lens should I use?",
        keyMetric: "—",
        metricLabel: "one detail needed",
        signal: "The question changes materially depending on the scope, so I have not calculated a potentially misleading answer.",
        evidence: [],
        risk: "Answering without this scope could mix pipeline, billed revenue, and delivery performance.",
        action: "Choose a suggested scope and I’ll run the analysis.",
        caveats: [],
        sources: [],
        lineage: [{ label: "Planner", detail: plan.explanation }],
        records: [],
        ...answerBase(plan, quality, -20),
      };
  }
}

function stageDistribution(deals: NormalizedDeal[]): ChartDatum[] {
  const counts = new Map<string, number>();
  for (const deal of openDeals(deals)) {
    const label = deal.stage ?? "Unknown stage";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, formatted: String(value) }))
    .sort((a, b) => b.value - a.value);
}

function proactiveSignals(
  dataset: NormalizedDataset,
  quality: DataQualitySummary,
  now: Date,
): ProactiveSignal[] {
  const attentionDeals = openDeals(usableDeals(dataset)).filter((deal) => dealAttentionReason(deal, now));
  const atRiskOrders = usableWorkOrders(dataset).filter((order) => workOrderRisk(order, now));
  const highValue = [...attentionDeals].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const signals: ProactiveSignal[] = [];
  if (highValue) {
    signals.push({ id: "pipeline-risk", kind: "pipeline", severity: "warning", title: "Pipeline attention", detail: `${attentionDeals.length} deals are flagged; the largest is ${formatInr(highValue.value ?? 0)}.` });
  }
  if (atRiskOrders.length) {
    signals.push({ id: "operations-risk", kind: "operations", severity: atRiskOrders.length > 5 ? "critical" : "warning", title: "Execution exceptions", detail: `${atRiskOrders.length} active work orders are paused, late, or waiting on client details.` });
  }
  if (quality.issueCount) {
    signals.push({ id: "quality-risk", kind: "quality", severity: quality.score < 75 ? "critical" : "info", title: "Data quality", detail: `${quality.issueCount} issues detected across ${quality.totalRecords} source records.` });
  }
  return signals.slice(0, 4);
}

export function computeBusinessPulse(
  dataset: NormalizedDataset,
  quality: DataQualitySummary,
  now = new Date(),
): BusinessPulse {
  const deals = usableDeals(dataset);
  const workOrders = usableWorkOrders(dataset);
  const activeDeals = openDeals(deals);
  const activeWorkOrders = workOrders.filter((order) => order.executionStatus !== "completed");
  const atRiskOperations = activeWorkOrders.filter((order) => workOrderRisk(order, now)).length;
  return {
    pipeline: sumDealValue(activeDeals),
    revenue: sumBilled(workOrders),
    activeWorkOrders: activeWorkOrders.length,
    atRiskOperations,
    dataQuality: quality.score,
    openDeals: activeDeals.length,
    stageDistribution: stageDistribution(deals),
    sectorSignals: computeSectorSignals(dataset, now),
    proactiveSignals: proactiveSignals(dataset, quality, now),
  };
}
