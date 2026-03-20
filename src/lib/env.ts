import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  GRACENOTE_API_KEY: z.string().optional(),
  TMDB_API_KEY: z.string().optional(),
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
  const examplePath = path.resolve(projectRoot, ".env.example");
  let configPath = envPath;

  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    configPath = examplePath;
    console.warn(".env missing; using .env.example as a fallback.");
  }

  if (fs.existsSync(configPath)) {
    dotenv.config({ path: configPath });
  }

  envLoaded = true;
}

export function getServerEnv() {
  ensureEnvLoaded();
  return parseServerEnv(process.env);
}
