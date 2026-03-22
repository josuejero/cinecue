import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1).optional(),

  GRACENOTE_BASE_URL: z.string().url().default("http://data.tmsapi.com/v1.1"),
  GRACENOTE_API_KEY: z.string().min(1).optional(),

  TMDB_BASE_URL: z.string().url().default("https://api.themoviedb.org/3"),
  TMDB_READ_ACCESS_TOKEN: z.string().min(1).optional(),
  TMDB_API_KEY: z.string().min(1).optional(),

  PHASE1_TEST_ZIP: z.string().optional(),
});

export function parseServerEnv(input: Record<string, string | undefined>) {
  return serverEnvSchema.parse(input);
}

let envLoaded = false;

function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  const projectRoot = process.cwd();
  const envPath = path.resolve(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    throw new Error(
      ".env missing; copy .env.example to .env and replace the placeholder values with real credentials before running the app.",
    );
  }

  dotenv.config({ path: envPath });
  envLoaded = true;
}

export function getServerEnv() {
  ensureEnvLoaded();
  return parseServerEnv(process.env);
}
