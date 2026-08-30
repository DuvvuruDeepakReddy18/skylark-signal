import { generateDemoSnapshot } from "@/lib/demo/generator";
import { normalizeSnapshot, parseDateValue, parseNumber } from "@/lib/data/normalization";
import { describe, expect, it } from "vitest";

describe("normalization", () => {
  it("parses currency, commas, parentheses, and invalid numbers", () => {
    expect(parseNumber("₹12,34,500").value).toBe(1_234_500);
    expect(parseNumber("(8,250)").value).toBe(-8_250);
    expect(parseNumber("not available").error).toBeTruthy();
  });

  it("validates dates and flags ambiguous Indian-style dates", () => {
    expect(parseDateValue("2026-08-30").value?.toISOString().slice(0, 10)).toBe("2026-08-30");
    expect(parseDateValue("03/04/2026").ambiguous).toBe(true);
    expect(parseDateValue("31/02/2026").error).toBeTruthy();
  });

  it("preserves raw source items while normalizing messy records", () => {
    const snapshot = generateDemoSnapshot(new Date("2026-08-30T00:00:00Z"));
    const normalized = normalizeSnapshot(snapshot);
    expect(normalized.deals).toHaveLength(48);
    expect(normalized.workOrders).toHaveLength(30);
    expect(normalized.deals[0].source.columns.length).toBeGreaterThan(5);
    expect(normalized.issues.some((issue) => issue.code === "invalid_date")).toBe(true);
    expect(normalized.workOrders.some((order) => order.sector === "mining")).toBe(true);
  });
});
