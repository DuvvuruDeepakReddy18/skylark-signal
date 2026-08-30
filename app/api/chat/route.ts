import { runAnalysis } from "@/lib/agent/orchestrator";
import type { AnalysisStage } from "@/lib/types";
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
    const analysisRequest = parsed.data as Parameters<typeof runAnalysis>[0];
    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          const progress = (stage: AnalysisStage) => send({ type: "progress", stage });
          void runAnalysis(analysisRequest, progress)
            .then((payload) => send({ type: "result", payload }))
            .catch((error: unknown) => send({
              type: "error",
              error: error instanceof Error ? error.message : "The analysis could not be completed.",
            }))
            .finally(() => controller.close());
        },
      });
      return new NextResponse(stream, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/x-ndjson; charset=utf-8",
        },
      });
    }
    const payload = await runAnalysis(analysisRequest);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The analysis could not be completed.";
    return NextResponse.json(
      { error: message, retryable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
