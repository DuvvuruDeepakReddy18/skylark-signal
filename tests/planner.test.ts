import { createQueryPlan, extractResponseText } from "@/lib/agent/planner";
import type { ConversationContext } from "@/lib/types";
import { describe, expect, it } from "vitest";

const sectors = ["Mining", "Renewables", "Railways", "Powerline", "Construction", "Others"];

describe("query planner fallback", () => {
  it("reads text from both raw and SDK-shaped Responses payloads", () => {
    expect(extractResponseText({ output_text: '{"ready":true}' })).toBe('{"ready":true}');
    expect(
      extractResponseText({
        output: [{ content: [{ type: "output_text", text: '{"ready":true}' }] }],
      }),
    ).toBe('{"ready":true}');
  });

  it("maps the required evaluator questions", async () => {
    expect((await createQueryPlan("How is our pipeline looking this quarter?", sectors)).intent).toBe("pipeline_health");
    expect((await createQueryPlan("Which sector has the strongest pipeline?", sectors)).intent).toBe("strongest_sector");
    expect((await createQueryPlan("Which deals need attention?", sectors)).intent).toBe("deals_attention");
    expect((await createQueryPlan("Which work orders are at risk?", sectors)).intent).toBe("work_orders_risk");
    expect((await createQueryPlan("Prepare my leadership update", sectors)).intent).toBe("leadership_update");
  });

  it("refuses to invent an absent sector", async () => {
    const plan = await createQueryPlan("How is Energy performing?", sectors);
    expect(plan.intent).toBe("clarification");
    expect(plan.clarificationQuestion).toMatch(/don.t see|find/i);
  });

  it("carries intent into a grounded follow-up", async () => {
    const prior = await createQueryPlan("How is Mining pipeline looking?", sectors);
    const context: ConversationContext = { lastPlan: prior, mentionedSectors: ["Mining"] };
    const followUp = await createQueryPlan("What about Renewables?", sectors, context);
    expect(followUp.intent).toBe("pipeline_health");
    expect(followUp.sector).toBe("Renewables");
  });

  it("asks a useful clarification for a materially ambiguous question", async () => {
    const plan = await createQueryPlan("How are we doing?", sectors);
    expect(plan.needsClarification).toBe(true);
    expect(plan.clarificationQuestion).toMatch(/pipeline.*revenue.*work-order/i);
  });
});
