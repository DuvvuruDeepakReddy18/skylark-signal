import { normalizeSnapshot } from "@/lib/data/normalization";
import { assessDataQuality } from "@/lib/data/quality";
import { generateDemoSnapshot } from "@/lib/demo/generator";
import { describe, expect, it } from "vitest";

describe("data quality", () => {
  it("returns an explainable bounded reliability score", () => {
    const dataset = normalizeSnapshot(generateDemoSnapshot(new Date("2026-08-30T00:00:00Z")));
    const quality = assessDataQuality(dataset);
    expect(quality.score).toBeGreaterThanOrEqual(35);
    expect(quality.score).toBeLessThanOrEqual(100);
    expect(quality.totalRecords).toBe(78);
    expect(quality.issueCount).toBe(dataset.issues.length);
    expect(quality.highlights.length).toBeGreaterThan(0);
  });
});
