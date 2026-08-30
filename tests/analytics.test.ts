import { buildInsightAnswer, computeBusinessPulse, computeSectorSignals } from "@/lib/analytics/engine";
import { normalizeSnapshot } from "@/lib/data/normalization";
import { assessDataQuality } from "@/lib/data/quality";
import { generateDemoSnapshot } from "@/lib/demo/generator";
import type { QueryIntent, QueryPlan } from "@/lib/types";
import { describe, expect, it } from "vitest";

const now = new Date("2026-08-30T00:00:00Z");
const dataset = normalizeSnapshot(generateDemoSnapshot(now));
const quality = assessDataQuality(dataset);

function plan(intent: QueryIntent, sector: string | null = null): QueryPlan {
  return {
    intent,
    boards: intent === "revenue" || intent === "work_orders_risk" ? ["work_orders"] : ["deals", "work_orders"],
    sector,
    comparisonSector: null,
    period: intent === "pipeline_health" ? "current_quarter" : "all_time",
    metrics: [],
    needsClarification: false,
    clarificationQuestion: null,
    confidence: 0.9,
    explanation: "Test plan",
    planner: "deterministic",
  };
}

describe("deterministic analytics", () => {
  it.each([
    "pipeline_health",
    "strongest_sector",
    "deals_attention",
    "work_orders_risk",
    "cross_board",
    "leadership_update",
    "revenue",
    "data_quality",
  ] as QueryIntent[])("builds a traced %s answer", (intent) => {
    const answer = buildInsightAnswer(plan(intent), dataset, quality, now);
    expect(answer.headline.length).toBeGreaterThan(10);
    expect(answer.lineage.length).toBeGreaterThan(0);
    expect(answer.confidence).toBeGreaterThanOrEqual(35);
  });

  it("computes pulse and sector signals from records", () => {
    const pulse = computeBusinessPulse(dataset, quality, now);
    expect(pulse.pipeline).toBeGreaterThan(0);
    expect(pulse.revenue).toBeGreaterThan(0);
    expect(pulse.sectorSignals).toEqual(computeSectorSignals(dataset, now));
    expect(pulse.proactiveSignals.length).toBeGreaterThan(0);
  });

  it("explains the cross-board join limitation", () => {
    const answer = buildInsightAnswer(plan("cross_board", "renewables"), dataset, quality, now);
    expect(answer.caveats.join(" ")).toMatch(/sector/i);
    expect(answer.sources).toHaveLength(2);
  });

  it("handles empty boards without NaN or invented records", () => {
    const emptyDataset = normalizeSnapshot({
      deals: { items: [] },
      workOrders: { items: [] },
    });
    const emptyQuality = assessDataQuality(emptyDataset);
    const answer = buildInsightAnswer(plan("pipeline_health"), emptyDataset, emptyQuality, now);
    expect(answer.keyMetric).not.toMatch(/NaN|Infinity/);
    expect(answer.records).toHaveLength(0);
    expect(answer.headline).toMatch(/No reliable/i);
  });
});
