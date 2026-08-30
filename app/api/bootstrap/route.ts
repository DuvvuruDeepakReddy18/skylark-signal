import { getBootstrap } from "@/lib/agent/orchestrator";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const payload = await getBootstrap(url.searchParams.get("refresh") === "1");
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Business data could not be loaded.";
    return NextResponse.json(
      { error: message, retryable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
