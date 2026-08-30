import { z } from "zod";

const envSchema = z.object({
  MONDAY_API_TOKEN: z.string().min(1).optional(),
  MONDAY_DEALS_BOARD_ID: z.string().regex(/^\d+$/).optional(),
  MONDAY_WORK_ORDERS_BOARD_ID: z.string().regex(/^\d+$/).optional(),
  MONDAY_API_VERSION: z.string().regex(/^\d{4}-\d{2}$/).default("2026-07"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  DATA_MODE: z.enum(["auto", "live", "demo"]).default("auto"),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(15).max(3600).default(120),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function hasMondayConfiguration(env = getEnv()): boolean {
  return Boolean(
    env.MONDAY_API_TOKEN && env.MONDAY_DEALS_BOARD_ID && env.MONDAY_WORK_ORDERS_BOARD_ID,
  );
}
