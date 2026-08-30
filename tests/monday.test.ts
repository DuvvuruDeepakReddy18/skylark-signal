import {
  MondayApiError,
  mondayErrorCodeForGraphql,
  mondayErrorCodeForHttpStatus,
  readBoard,
} from "@/lib/monday/client";
import { describe, expect, it } from "vitest";

describe("Monday client failures", () => {
  it("fails safely when server-side configuration is absent", async () => {
    await expect(readBoard("1234567890", "test-request")).rejects.toMatchObject({
      name: "MondayApiError",
      code: "configuration",
    } satisfies Partial<MondayApiError>);
  });

  it("classifies authentication, rate-limit, and service failures", () => {
    expect(mondayErrorCodeForHttpStatus(401)).toBe("authentication");
    expect(mondayErrorCodeForHttpStatus(403)).toBe("authentication");
    expect(mondayErrorCodeForHttpStatus(429)).toBe("rate_limit");
    expect(mondayErrorCodeForHttpStatus(503)).toBe("unavailable");
    expect(mondayErrorCodeForHttpStatus(200)).toBeNull();
  });

  it("distinguishes permission GraphQL errors from schema errors", () => {
    expect(mondayErrorCodeForGraphql([{ message: "denied", extensions: { code: "PERMISSION_DENIED" } }])).toBe("authentication");
    expect(mondayErrorCodeForGraphql([{ message: "unknown column" }])).toBe("schema");
  });
});
