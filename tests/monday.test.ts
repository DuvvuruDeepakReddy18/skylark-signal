import { MondayApiError, readBoard } from "@/lib/monday/client";
import { describe, expect, it } from "vitest";

describe("Monday client failures", () => {
  it("fails safely when server-side configuration is absent", async () => {
    await expect(readBoard("1234567890", "test-request")).rejects.toMatchObject({
      name: "MondayApiError",
      code: "configuration",
    } satisfies Partial<MondayApiError>);
  });
});
