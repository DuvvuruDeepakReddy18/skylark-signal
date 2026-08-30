import type { DataQualitySummary, NormalizationIssue, NormalizedDataset, QualityHighlight } from "@/lib/types";
import { clamp } from "@/lib/utils";

const labels: Record<NormalizationIssue["code"], string> = {
  missing_value: "Missing required values",
  invalid_date: "Invalid dates",
  ambiguous_date: "Ambiguous dates",
  invalid_number: "Unparseable amounts",
  negative_value: "Negative values",
  unknown_status: "Unrecognized statuses",
  duplicate_record: "Duplicate-like records",
  embedded_header: "Embedded header rows",
  date_order: "Dates out of order",
  amount_inconsistency: "Amount inconsistencies",
  missing_identifier: "Missing identifiers",
  suspicious_value: "Suspicious values",
};

const severityRank = { error: 3, warning: 2, info: 1 } as const;

export function assessDataQuality(dataset: NormalizedDataset): DataQualitySummary {
  const totalRecords = dataset.deals.length + dataset.workOrders.length;
  const excludedRecords =
    dataset.deals.filter((record) => record.excluded).length +
    dataset.workOrders.filter((record) => record.excluded).length;
  const countsBySeverity = { info: 0, warning: 0, error: 0 };
  const byCode = new Map<NormalizationIssue["code"], NormalizationIssue[]>();

  for (const issue of dataset.issues) {
    countsBySeverity[issue.severity] += 1;
    byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);
  }

  const weightedIssues =
    countsBySeverity.error * 3.5 + countsBySeverity.warning * 1.25 + countsBySeverity.info * 0.3;
  const weightedPenalty = (weightedIssues / Math.max(totalRecords, 1)) * 8;
  const exclusionPenalty = (excludedRecords / Math.max(totalRecords, 1)) * 30;
  const score = Math.round(clamp(100 - weightedPenalty - exclusionPenalty, 35, 100));

  const highlights: QualityHighlight[] = [...byCode.entries()]
    .map(([code, issues]) => ({
      label: labels[code],
      count: issues.length,
      severity: issues.reduce<NormalizationIssue["severity"]>(
        (highest, current) => (severityRank[current.severity] > severityRank[highest] ? current.severity : highest),
        "info",
      ),
    }))
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.count - a.count)
    .slice(0, 6);

  return {
    score,
    usableRecords: totalRecords - excludedRecords,
    totalRecords,
    issueCount: dataset.issues.length,
    countsBySeverity,
    highlights,
    issues: dataset.issues,
  };
}

export function summarizeIssues(
  issues: NormalizationIssue[],
  options: { board?: NormalizationIssue["board"]; fields?: string[] } = {},
): string[] {
  const filtered = issues.filter(
    (issue) =>
      (!options.board || issue.board === options.board) &&
      (!options.fields || options.fields.some((field) => issue.field.toLowerCase().includes(field.toLowerCase()))),
  );
  const grouped = new Map<NormalizationIssue["code"], number>();
  for (const issue of filtered) grouped.set(issue.code, (grouped.get(issue.code) ?? 0) + 1);
  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, count]) => `${count} ${labels[code].toLowerCase()}`);
}
