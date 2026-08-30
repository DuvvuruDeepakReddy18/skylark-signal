import { generateDemoSnapshot } from "@/lib/demo/generator";
import { getEnv, hasMondayConfiguration } from "@/lib/env";
import { readBoard } from "@/lib/monday/client";
import { logEvent } from "@/lib/observability/logger";
import type { DataSnapshot } from "@/lib/types";

interface SnapshotCache {
  value: DataSnapshot;
  expiresAt: number;
}

let cache: SnapshotCache | null = null;

export async function getDataSnapshot(options: { force?: boolean; requestId?: string } = {}): Promise<DataSnapshot> {
  const env = getEnv();
  const configured = hasMondayConfiguration(env);
  const useLive = env.DATA_MODE === "live" || (env.DATA_MODE === "auto" && configured);

  if (env.DATA_MODE === "live" && !configured) {
    throw new Error(
      "Live mode requires MONDAY_API_TOKEN, MONDAY_DEALS_BOARD_ID, and MONDAY_WORK_ORDERS_BOARD_ID.",
    );
  }

  if (!useLive) {
    return generateDemoSnapshot();
  }

  const now = Date.now();
  if (!options.force && cache && cache.expiresAt > now) {
    return { ...cache.value, freshness: "cached" };
  }

  try {
    const [deals, workOrders] = await Promise.all([
      readBoard(env.MONDAY_DEALS_BOARD_ID as string, options.requestId),
      readBoard(env.MONDAY_WORK_ORDERS_BOARD_ID as string, options.requestId),
    ]);
    const snapshot: DataSnapshot = {
      mode: "live",
      freshness: "live",
      fetchedAt: new Date().toISOString(),
      deals,
      workOrders,
    };
    cache = { value: snapshot, expiresAt: now + env.CACHE_TTL_SECONDS * 1000 };
    logEvent("data_snapshot_ready", {
      requestId: options.requestId,
      count: deals.items.length + workOrders.items.length,
      mode: "live",
    });
    return snapshot;
  } catch (error) {
    if (cache) {
      return {
        ...cache.value,
        freshness: "stale",
        warning: error instanceof Error ? error.message : "The latest Monday.com refresh failed.",
      };
    }
    throw error;
  }
}

export function clearSnapshotCache(): void {
  cache = null;
}
