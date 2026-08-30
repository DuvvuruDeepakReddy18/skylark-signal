import { runAnalysis } from "@/lib/agent/orchestrator";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(2).max(500),
  founderMode: z.boolean().default(true),
  context: z.object({
    lastPlan: z.unknown().optional(),
    mentionedSectors: z.array(z.string().max(80)).max(6),
  }).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid business question." }, { status: 400 });
    }
    const payload = await runAnalysis(parsed.data as Parameters<typeof runAnalysis>[0]);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The analysis could not be completed.";
    return NextResponse.json(
      { error: message, retryable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
