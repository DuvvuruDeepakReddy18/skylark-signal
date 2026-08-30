import { getEnv } from "@/lib/env";
import type { ConversationContext, QueryIntent, QueryPeriod, QueryPlan } from "@/lib/types";
import { normalizedKey, titleCase } from "@/lib/utils";
import { z } from "zod";

const intents = [
  "pipeline_health",
  "sector_performance",
  "strongest_sector",
  "deals_attention",
  "work_orders_risk",
  "cross_board",
  "leadership_update",
  "revenue",
  "operational_summary",
  "data_quality",
  "clarification",
] as const;

const planOutputSchema = z.object({
  intent: z.enum(intents),
  boards: z.array(z.enum(["deals", "work_orders"])).min(1),
  sector: z.string().nullable(),
  comparisonSector: z.string().nullable(),
  period: z.enum(["current_quarter", "last_90_days", "all_time"]),
  metrics: z.array(z.string()).max(10),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1).max(240),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: intents },
    boards: { type: "array", items: { type: "string", enum: ["deals", "work_orders"] }, minItems: 1 },
    sector: { anyOf: [{ type: "string" }, { type: "null" }] },
    comparisonSector: { anyOf: [{ type: "string" }, { type: "null" }] },
    period: { type: "string", enum: ["current_quarter", "last_90_days", "all_time"] },
    metrics: { type: "array", items: { type: "string" }, maxItems: 10 },
    needsClarification: { type: "boolean" },
    clarificationQuestion: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    explanation: { type: "string" },
  },
  required: [
    "intent",
    "boards",
    "sector",
    "comparisonSector",
    "period",
    "metrics",
    "needsClarification",
    "clarificationQuestion",
    "confidence",
    "explanation",
  ],
} as const;

const metricsByIntent: Record<QueryIntent, string[]> = {
  pipeline_health: ["pipeline_value", "deal_count", "stage_distribution", "late_stage_value", "attention_deals"],
  sector_performance: ["sector_pipeline", "execution_health", "sector_risk"],
  strongest_sector: ["pipeline_by_sector", "deal_count_by_sector"],
  deals_attention: ["overdue_deals", "on_hold_deals", "missing_close_dates", "aging_deals"],
  work_orders_risk: ["active_work_orders", "at_risk_work_orders", "at_risk_value"],
  cross_board: ["sector_pipeline", "sector_execution_health", "pipeline_execution_gap"],
  leadership_update: ["pipeline_value", "billed_revenue", "sales_risks", "operational_risks", "data_quality"],
  revenue: ["billed_revenue_ex_gst", "receivables", "invoice_date_coverage"],
  operational_summary: ["active_work_orders", "execution_status", "at_risk_work_orders"],
  data_quality: ["quality_score", "exclusions", "issue_counts"],
  clarification: [],
};

function boardsFor(intent: QueryIntent): QueryPlan["boards"] {
  if (["pipeline_health", "strongest_sector", "deals_attention"].includes(intent)) return ["deals"];
  if (["work_orders_risk", "revenue", "operational_summary"].includes(intent)) return ["work_orders"];
  return ["deals", "work_orders"];
}

function periodFrom(message: string): QueryPeriod {
  if (/this quarter|current quarter|quarterly/.test(message)) return "current_quarter";
  if (/90 days|last three months|last 3 months/.test(message)) return "last_90_days";
  return "all_time";
}

function findSectors(message: string, sectors: string[]): string[] {
  const normalized = normalizedKey(message);
  return sectors.filter((sector) => {
    const key = normalizedKey(sector);
    return new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalized);
  });
}

function unsupportedSector(message: string, sectors: string[]): string | null {
  const normalized = normalizedKey(message);
  const businessWords = new Set([
    "pipeline", "revenue", "work", "orders", "deals", "deal", "sector", "sales", "execution", "quarter",
    "performance", "performing", "looking", "compare", "risk", "doing", "strongest", "attention", "leadership",
  ]);
  const candidates = normalized.match(/\b[a-z][a-z-]{3,}\b/g) ?? [];
  for (const candidate of candidates) {
    if (businessWords.has(candidate)) continue;
    if (sectors.some((sector) => normalizedKey(sector) === candidate)) continue;
    if (["energy", "solar", "aviation", "manufacturing"].includes(candidate)) return candidate;
  }
  return null;
}

function deterministicPlan(
  message: string,
  sectors: string[],
  context?: ConversationContext,
): QueryPlan {
  const normalized = normalizedKey(message);
  const foundSectors = findSectors(normalized, sectors);
  const priorIntent = context?.lastPlan?.intent;
  let intent: QueryIntent;

  if (/leadership|weekly update|briefing/.test(normalized)) intent = "leadership_update";
  else if (/data quality|quality score|missing data|clean is/.test(normalized)) intent = "data_quality";
  else if (/strongest|largest|best/.test(normalized) && /sector|pipeline/.test(normalized)) intent = "strongest_sector";
  else if (/compare|versus| vs |sales.*execution|pipeline.*execution|riskier/.test(normalized)) intent = "cross_board";
  else if (/which deals|deal.*attention|need attention|overdue deal|stale deal/.test(normalized)) intent = "deals_attention";
  else if (/work order|operations|execution/.test(normalized) && /risk|status|perform|doing|summary/.test(normalized)) intent = "work_orders_risk";
  else if (/revenue|billed|billing|receivable|collection/.test(normalized)) intent = "revenue";
  else if (/pipeline/.test(normalized)) intent = "pipeline_health";
  else if (/perform|doing|how is/.test(normalized) && foundSectors.length) intent = "sector_performance";
  else if (/what about|and (mining|renewables|railways|powerline|construction|others)/.test(normalized) && priorIntent) intent = priorIntent;
  else intent = "clarification";

  const unknown = unsupportedSector(normalized, sectors);
  if (unknown && foundSectors.length === 0) {
    const choices = sectors.slice(0, 6).map(titleCase).join(", ");
    return {
      intent: "clarification",
      boards: ["deals", "work_orders"],
      sector: null,
      comparisonSector: null,
      period: periodFrom(normalized),
      metrics: [],
      needsClarification: true,
      clarificationQuestion: `I don’t see “${titleCase(unknown)}” as a source sector. Should I use one of: ${choices}?`,
      confidence: 0.96,
      explanation: `The requested sector is not present in the current Monday.com sector values, so no substitution was invented.`,
      planner: "deterministic",
    };
  }

  const inheritedSector = /what about|and what|same for/.test(normalized) ? context?.lastPlan?.sector ?? null : null;
  const sector = foundSectors[0] ?? inheritedSector;
  const comparisonSector = foundSectors[1] ?? (intent === "cross_board" ? context?.mentionedSectors.at(-2) ?? null : null);
  const needsClarification = intent === "clarification";
  return {
    intent,
    boards: boardsFor(intent),
    sector,
    comparisonSector,
    period: periodFrom(normalized),
    metrics: metricsByIntent[intent],
    needsClarification,
    clarificationQuestion: needsClarification
      ? "Should I analyze pipeline, billed revenue, work-order execution, or prepare a leadership update?"
      : null,
    confidence: needsClarification ? 0.58 : 0.9,
    explanation: needsClarification
      ? "The request does not identify a business metric, and different interpretations would produce materially different answers."
      : `Analyzing ${sector ? `${titleCase(sector)} ` : ""}${intent.replaceAll("_", " ")} using ${boardsFor(intent).join(" and ")}.`,
    planner: "deterministic",
  };
}

interface OpenAiResponse {
  output_text?: string;
}

async function modelPlan(
  message: string,
  sectors: string[],
  context?: ConversationContext,
): Promise<QueryPlan | null> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 650,
        instructions: [
          "You are a business intelligence query planner, not a calculator.",
          "Return only the structured plan. Never invent sectors, fields, metrics, or source data.",
          "Use clarification only when ambiguity materially changes the calculation.",
          "Do not expose chain-of-thought. explanation must be one concise sentence describing scope.",
          `Available normalized sectors: ${sectors.join(", ") || "none"}.`,
          "Revenue means billed value excluding GST. Cross-board analysis joins at normalized sector level.",
        ].join(" "),
        input: JSON.stringify({
          message,
          priorPlan: context?.lastPlan ?? null,
          priorSectors: context?.mentionedSectors ?? [],
        }),
        text: {
          format: {
            type: "json_schema",
            name: "business_query_plan",
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as OpenAiResponse;
    if (!payload.output_text) return null;
    const parsed = planOutputSchema.safeParse(JSON.parse(payload.output_text));
    if (!parsed.success) return null;
    return { ...parsed.data, planner: "openai" };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function groundPlan(plan: QueryPlan, sectors: string[]): QueryPlan {
  const canonical = new Map(sectors.map((sector) => [normalizedKey(sector), normalizedKey(sector)]));
  if (plan.sector && !canonical.has(normalizedKey(plan.sector))) {
    return {
      ...plan,
      intent: "clarification",
      boards: ["deals", "work_orders"],
      metrics: [],
      needsClarification: true,
      clarificationQuestion: `I can’t find “${plan.sector}” in the current source sectors. Should I use ${sectors.slice(0, 6).join(", ")}?`,
      explanation: "The requested sector is absent from the source taxonomy, so the agent will not guess a replacement.",
    };
  }
  return plan;
}

export async function createQueryPlan(
  message: string,
  sectors: string[],
  context?: ConversationContext,
): Promise<QueryPlan> {
  const planned = (await modelPlan(message, sectors, context)) ?? deterministicPlan(message, sectors, context);
  return groundPlan(planned, sectors);
}
