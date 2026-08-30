interface LogContext {
  requestId?: string;
  durationMs?: number;
  count?: number;
  mode?: string;
  intent?: string;
  errorCode?: string;
}

export function logEvent(event: string, context: LogContext = {}): void {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      at: new Date().toISOString(),
      ...context,
    }),
  );
}

export function logError(event: string, context: LogContext = {}): void {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      at: new Date().toISOString(),
      ...context,
    }),
  );
}
