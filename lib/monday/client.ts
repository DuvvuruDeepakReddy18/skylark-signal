import { getEnv } from "@/lib/env";
import { logError, logEvent } from "@/lib/observability/logger";
import type { RawBoardDataset, RawBoardItem, RawMondayColumnValue } from "@/lib/types";

const MONDAY_ENDPOINT = "https://api.monday.com/v2";
const PAGE_LIMIT = 500;
const MAX_PAGES = 50;

export class MondayApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "configuration"
      | "authentication"
      | "rate_limit"
      | "timeout"
      | "schema"
      | "unavailable",
  ) {
    super(message);
    this.name = "MondayApiError";
  }
}

interface GraphqlError {
  message: string;
  extensions?: { code?: string };
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

interface ApiColumnValue {
  id: string;
  type: string;
  text: string | null;
  value: unknown;
  column?: { title?: string | null } | null;
}

interface ApiItem {
  id: string;
  name: string;
  column_values: ApiColumnValue[];
}

interface ItemPage {
  cursor: string | null;
  items: ApiItem[];
}

interface InitialPageData {
  boards: Array<{ id: string; name: string; items_page: ItemPage }>;
}

interface NextPageData {
  next_items_page: ItemPage;
}

const INITIAL_QUERY = `
  query BoardItems($boardId: ID!, $limit: Int!) {
    boards(ids: [$boardId]) {
      id
      name
      items_page(limit: $limit) {
        cursor
        items {
          id
          name
          column_values {
            id
            type
            text
            value
            column { title }
          }
        }
      }
    }
  }
`;

const NEXT_QUERY = `
  query NextBoardItems($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        id
        name
        column_values {
          id
          type
          text
          value
          column { title }
        }
      }
    }
  }
`;

function toRawItem(item: ApiItem): RawBoardItem {
  const columns: RawMondayColumnValue[] = item.column_values.map((column) => ({
    id: column.id,
    title: column.column?.title?.trim() || column.id,
    type: column.type,
    text: column.text,
    value: column.value,
  }));
  return { id: item.id, name: item.name, columns };
}

async function request<T>(query: string, variables: Record<string, unknown>, requestId?: string): Promise<T> {
  const env = getEnv();
  if (!env.MONDAY_API_TOKEN) {
    throw new MondayApiError("Monday.com is not configured.", "configuration");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const started = Date.now();

  try {
    const response = await fetch(MONDAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: env.MONDAY_API_TOKEN,
        "API-Version": env.MONDAY_API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new MondayApiError("Monday.com rejected the configured credentials.", "authentication");
    }
    if (response.status === 429) {
      throw new MondayApiError("Monday.com rate limit reached. Try again shortly.", "rate_limit");
    }
    if (!response.ok) {
      throw new MondayApiError("Monday.com is temporarily unavailable.", "unavailable");
    }

    const payload = (await response.json()) as GraphqlResponse<T>;
    if (payload.errors?.length) {
      const combined = payload.errors.map((error) => error.message).join("; ");
      const isPermission = payload.errors.some((error) =>
        ["PERMISSION_DENIED", "UNAUTHORIZED"].includes(error.extensions?.code ?? ""),
      );
      throw new MondayApiError(
        isPermission ? "Monday.com access to one of the boards was denied." : `Monday.com query failed: ${combined}`,
        isPermission ? "authentication" : "schema",
      );
    }
    if (!payload.data) {
      throw new MondayApiError("Monday.com returned an empty response.", "unavailable");
    }
    logEvent("monday_request_completed", { requestId, durationMs: Date.now() - started });
    return payload.data;
  } catch (error) {
    if (error instanceof MondayApiError) {
      logError("monday_request_failed", { requestId, errorCode: error.code });
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new MondayApiError("Monday.com did not respond before the timeout.", "timeout");
    }
    throw new MondayApiError("Monday.com could not be reached.", "unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoard(boardId: string, requestId?: string): Promise<RawBoardDataset> {
  logEvent("monday_request_started", { requestId });
  const initial = await request<InitialPageData>(
    INITIAL_QUERY,
    { boardId, limit: PAGE_LIMIT },
    requestId,
  );
  const board = initial.boards[0];
  if (!board) {
    throw new MondayApiError(`Board ${boardId} was not found or is not accessible.`, "configuration");
  }

  const items = [...board.items_page.items];
  let cursor = board.items_page.cursor;
  let page = 1;
  while (cursor && page < MAX_PAGES) {
    const next = await request<NextPageData>(NEXT_QUERY, { cursor, limit: PAGE_LIMIT }, requestId);
    items.push(...next.next_items_page.items);
    cursor = next.next_items_page.cursor;
    page += 1;
  }
  if (cursor) {
    throw new MondayApiError("Board pagination exceeded the safe page limit.", "schema");
  }

  return { id: board.id, name: board.name, items: items.map(toRawItem) };
}
