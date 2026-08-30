export type DataMode = "live" | "demo";
export type Freshness = "live" | "cached" | "stale" | "simulated";
export type BoardKind = "deals" | "work_orders";
export type Severity = "info" | "warning" | "error";

export interface RawMondayColumnValue {
  id: string;
  title: string;
  type: string;
  text: string | null;
  value: unknown;
}

export interface RawBoardItem {
  id: string;
  name: string;
  columns: RawMondayColumnValue[];
}

export interface RawBoardDataset {
  id: string;
  name: string;
  items: RawBoardItem[];
}

export interface DataSnapshot {
  mode: DataMode;
  freshness: Freshness;
  fetchedAt: string;
  deals: RawBoardDataset;
  workOrders: RawBoardDataset;
  warning?: string;
}

export interface NormalizationIssue {
  code:
    | "missing_value"
    | "invalid_date"
    | "ambiguous_date"
    | "invalid_number"
    | "negative_value"
    | "unknown_status"
    | "duplicate_record"
    | "embedded_header"
    | "date_order"
    | "amount_inconsistency"
    | "missing_identifier"
    | "suspicious_value";
  severity: Severity;
  board: BoardKind;
  itemId: string;
  field: string;
  message: string;
  original?: unknown;
}

export interface NormalizedValue<T> {
  original: unknown;
  normalized: T | null;
  valid: boolean;
  warnings: string[];
}

export interface NormalizedDeal {
  id: string;
  name: string;
  clientCode: string | null;
  owner: string | null;
  status: string | null;
  stage: string | null;
  sector: string | null;
  sectorDisplay: string | null;
  product: string | null;
  probability: string | null;
  value: number | null;
  closeDate: Date | null;
  tentativeCloseDate: Date | null;
  createdDate: Date | null;
  source: RawBoardItem;
  issues: NormalizationIssue[];
  excluded: boolean;
}

export interface NormalizedWorkOrder {
  id: string;
  serial: string | null;
  name: string;
  customerCode: string | null;
  owner: string | null;
  executionStatus: string | null;
  sector: string | null;
  sectorDisplay: string | null;
  natureOfWork: string | null;
  typeOfWork: string | null;
  poDate: Date | null;
  probableStartDate: Date | null;
  probableEndDate: Date | null;
  dataDeliveryDate: Date | null;
  lastInvoiceDate: Date | null;
  amountExGst: number | null;
  billedExGst: number | null;
  collectedIncGst: number | null;
  receivable: number | null;
  amountToBillExGst: number | null;
  invoiceStatus: string | null;
  billingStatus: string | null;
  source: RawBoardItem;
  issues: NormalizationIssue[];
  excluded: boolean;
}

export interface NormalizedDataset {
  deals: NormalizedDeal[];
  workOrders: NormalizedWorkOrder[];
  issues: NormalizationIssue[];
}

export interface QualityHighlight {
  label: string;
  count: number;
  severity: Severity;
}

export interface DataQualitySummary {
  score: number;
  usableRecords: number;
  totalRecords: number;
  issueCount: number;
  countsBySeverity: Record<Severity, number>;
  highlights: QualityHighlight[];
  issues: NormalizationIssue[];
}

export type QueryIntent =
  | "pipeline_health"
  | "sector_performance"
  | "strongest_sector"
  | "deals_attention"
  | "work_orders_risk"
  | "cross_board"
  | "leadership_update"
  | "revenue"
  | "operational_summary"
  | "data_quality"
  | "clarification";

export type QueryPeriod = "current_quarter" | "last_90_days" | "all_time";

export interface QueryPlan {
  intent: QueryIntent;
  boards: BoardKind[];
  sector: string | null;
  comparisonSector: string | null;
  period: QueryPeriod;
  metrics: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  confidence: number;
  explanation: string;
  planner: "openai" | "deterministic";
}

export interface EvidencePoint {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}

export interface LineageStep {
  label: string;
  detail: string;
}

export interface SupportingRecord {
  id: string;
  name: string;
  board: BoardKind;
  sector: string | null;
  status: string | null;
  value: number | null;
  date: string | null;
  reason?: string;
}

export interface ChartDatum {
  label: string;
  value: number;
  formatted: string;
}

export interface InsightAnswer {
  eyebrow: string;
  headline: string;
  keyMetric: string;
  metricLabel: string;
  signal: string;
  evidence: EvidencePoint[];
  risk: string;
  action: string;
  caveats: string[];
  sources: string[];
  lineage: LineageStep[];
  records: SupportingRecord[];
  chart?: { title: string; data: ChartDatum[] };
  confidence: number;
  confidenceLabel: "High" | "Medium" | "Low";
  generatedAt: string;
  plan: QueryPlan;
}

export interface SectorSignal {
  sector: string;
  pipelineValue: number;
  openDeals: number;
  activeWorkOrders: number;
  atRiskWorkOrders: number;
  pipelineScore: number;
  executionScore: number;
  overall: "healthy" | "watch" | "risk";
}

export interface ProactiveSignal {
  id: string;
  kind: "pipeline" | "operations" | "quality" | "revenue";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface BusinessPulse {
  pipeline: number;
  revenue: number;
  activeWorkOrders: number;
  atRiskOperations: number;
  dataQuality: number;
  openDeals: number;
  stageDistribution: ChartDatum[];
  sectorSignals: SectorSignal[];
  proactiveSignals: ProactiveSignal[];
}

export interface BootstrapResponse {
  connection: {
    mode: DataMode;
    freshness: Freshness;
    fetchedAt: string;
    label: string;
    warning?: string;
  };
  pulse: BusinessPulse;
  quality: DataQualitySummary;
}

export interface ConversationContext {
  lastPlan?: QueryPlan;
  mentionedSectors: string[];
}

export interface ChatRequest {
  message: string;
  founderMode: boolean;
  context?: ConversationContext;
}

export interface ChatResponse {
  answer: InsightAnswer;
  context: ConversationContext;
  connection: BootstrapResponse["connection"];
  timings: Record<string, number>;
}
