import { generateDemoSnapshot } from "@/lib/demo/generator";
import { getEnv, hasMondayConfiguration } from "@/lib/env";
import { readBoard } from "@/lib/monday/client";
import { logEvent } from "@/lib/observability/logger";
import type { BoardKind, DataSnapshot, RawBoardDataset } from "@/lib/types";

interface BoardCacheEntry {
  value: RawBoardDataset;
  fetchedAt: string;
  expiresAt: number;
}

const boardCache: Partial<Record<BoardKind, BoardCacheEntry>> = {};

function emptyBoard(kind: BoardKind, id = "not-requested"): RawBoardDataset {
  return { id, name: kind === "deals" ? "Deals" : "Work Orders", items: [] };
}

export async function getDataSnapshot(
  options: { force?: boolean; requestId?: string; boards?: BoardKind[] } = {},
): Promise<DataSnapshot> {
  const env = getEnv();
  const configured = hasMondayConfiguration(env);
  const useLive = env.DATA_MODE === "live" || (env.DATA_MODE === "auto" && configured);
  const requested = [...new Set(options.boards ?? ["deals", "work_orders"])] as BoardKind[];

  if (env.DATA_MODE === "live" && !configured) {
    throw new Error(
      "Live mode requires MONDAY_API_TOKEN, MONDAY_DEALS_BOARD_ID, and MONDAY_WORK_ORDERS_BOARD_ID.",
    );
  }

  if (!useLive) {
    const demo = generateDemoSnapshot();
    return {
      ...demo,
      deals: requested.includes("deals") ? demo.deals : emptyBoard("deals"),
      workOrders: requested.includes("work_orders") ? demo.workOrders : emptyBoard("work_orders"),
    };
  }

  const now = Date.now();
  const results: Partial<Record<BoardKind, RawBoardDataset>> = {};
  let usedCache = false;
  let usedStale = false;
  let warning: string | undefined;
  let latestFetchedAt = new Date(0).toISOString();

  await Promise.all(requested.map(async (kind) => {
    const cached = boardCache[kind];
    if (!options.force && cached && cached.expiresAt > now) {
      results[kind] = cached.value;
      latestFetchedAt = cached.fetchedAt > latestFetchedAt ? cached.fetchedAt : latestFetchedAt;
      usedCache = true;
      return;
    }

    const boardId = kind === "deals"
      ? env.MONDAY_DEALS_BOARD_ID as string
      : env.MONDAY_WORK_ORDERS_BOARD_ID as string;
    try {
      const value = await readBoard(boardId, options.requestId);
      const fetchedAt = new Date().toISOString();
      boardCache[kind] = { value, fetchedAt, expiresAt: now + env.CACHE_TTL_SECONDS * 1000 };
      results[kind] = value;
      latestFetchedAt = fetchedAt > latestFetchedAt ? fetchedAt : latestFetchedAt;
    } catch (error) {
      if (!cached) throw error;
      results[kind] = cached.value;
      latestFetchedAt = cached.fetchedAt > latestFetchedAt ? cached.fetchedAt : latestFetchedAt;
      usedStale = true;
      warning = error instanceof Error ? error.message : "The latest Monday.com refresh failed.";
    }
  }));

  const deals = results.deals ?? emptyBoard("deals", env.MONDAY_DEALS_BOARD_ID);
  const workOrders = results.work_orders ?? emptyBoard("work_orders", env.MONDAY_WORK_ORDERS_BOARD_ID);
  logEvent("data_snapshot_ready", {
    requestId: options.requestId,
    count: deals.items.length + workOrders.items.length,
    mode: "live",
    boards: requested.join(","),
  });
  return {
    mode: "live",
    freshness: usedStale ? "stale" : usedCache ? "cached" : "live",
    fetchedAt: latestFetchedAt,
    deals,
    workOrders,
    warning,
  };
}

export function clearSnapshotCache(): void {
  delete boardCache.deals;
  delete boardCache.work_orders;
}
