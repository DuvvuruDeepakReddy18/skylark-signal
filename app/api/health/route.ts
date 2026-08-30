import { getEnv, hasMondayConfiguration } from "@/lib/env";
import { NextResponse } from "next/server";

export function GET(): NextResponse {
  const env = getEnv();
  return NextResponse.json({
    status: "ok",
    mondayConfigured: hasMondayConfiguration(env),
    plannerConfigured: Boolean(env.OPENAI_API_KEY),
    dataMode: env.DATA_MODE,
    checkedAt: new Date().toISOString(),
  });
}
