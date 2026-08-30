import { buildInsightAnswer, computeBusinessPulse } from "@/lib/analytics/engine";
import { createQueryPlan } from "@/lib/agent/planner";
import { normalizeSnapshot } from "@/lib/data/normalization";
import { assessDataQuality } from "@/lib/data/quality";
import { getDataSnapshot } from "@/lib/data/repository";
import { logEvent } from "@/lib/observability/logger";
import type {
  BootstrapResponse,
  ChatRequest,
  ChatResponse,
  ConversationContext,
  DataSnapshot,
} from "@/lib/types";
import { normalizedKey, stableId, titleCase } from "@/lib/utils";

function connectionFrom(snapshot: DataSnapshot): BootstrapResponse["connection"] {
  const labels = {
    live: "Live from Monday.com",
    cached: "Monday.com · cached",
    stale: "Monday.com · stale cache",
    simulated: "Demo Mode · simulated environment",
  } as const;
  return {
    mode: snapshot.mode,
    freshness: snapshot.freshness,
    fetchedAt: snapshot.fetchedAt,
    label: labels[snapshot.freshness],
    warning: snapshot.warning,
  };
}

function availableSectors(dataset: ReturnType<typeof normalizeSnapshot>): string[] {
  return [...new Set([
    ...dataset.deals.map((deal) => deal.sectorDisplay).filter((sector): sector is string => Boolean(sector)),
    ...dataset.workOrders.map((order) => order.sectorDisplay).filter((sector): sector is string => Boolean(sector)),
  ])].sort();
}

function nextContext(
  previous: ConversationContext | undefined,
  plan: ChatResponse["answer"]["plan"],
): ConversationContext {
  const mentioned = [...(previous?.mentionedSectors ?? [])];
  for (const sector of [plan.sector, plan.comparisonSector]) {
    if (sector && !mentioned.some((existing) => normalizedKey(existing) === normalizedKey(sector))) {
      mentioned.push(titleCase(sector));
    }
  }
  return { lastPlan: plan, mentionedSectors: mentioned.slice(-6) };
}

export async function runAnalysis(request: ChatRequest): Promise<ChatResponse> {
  const requestId = stableId("analysis", `${Date.now()}-${request.message.length}`);
  const started = performance.now();
  const timings: Record<string, number> = {};
  logEvent("query_received", { requestId });

  const retrievalStarted = performance.now();
  const snapshot = await getDataSnapshot({ requestId });
  timings.retrieval = Math.round(performance.now() - retrievalStarted);

  const normalizationStarted = performance.now();
  const normalized = normalizeSnapshot(snapshot);
  timings.normalization = Math.round(performance.now() - normalizationStarted);
  logEvent("normalization_completed", { requestId, count: normalized.deals.length + normalized.workOrders.length });

  const qualityStarted = performance.now();
  const quality = assessDataQuality(normalized);
  timings.quality = Math.round(performance.now() - qualityStarted);
  logEvent("quality_check_completed", { requestId, count: quality.issueCount });

  const planningStarted = performance.now();
  const plan = await createQueryPlan(request.message, availableSectors(normalized), request.context);
  timings.planning = Math.round(performance.now() - planningStarted);
  logEvent("query_planned", { requestId, intent: plan.intent });

  const analysisStarted = performance.now();
  const answer = buildInsightAnswer(plan, normalized, quality);
  timings.analysis = Math.round(performance.now() - analysisStarted);
  timings.total = Math.round(performance.now() - started);
  logEvent("analysis_completed", { requestId, intent: plan.intent, durationMs: timings.total });

  return {
    answer,
    context: nextContext(request.context, plan),
    connection: connectionFrom(snapshot),
    timings,
  };
}

export async function getBootstrap(force = false): Promise<BootstrapResponse> {
  const requestId = stableId("bootstrap", `${Date.now()}`);
  const snapshot = await getDataSnapshot({ force, requestId });
  const normalized = normalizeSnapshot(snapshot);
  const quality = assessDataQuality(normalized);
  return {
    connection: connectionFrom(snapshot),
    pulse: computeBusinessPulse(normalized, quality),
    quality,
  };
}
