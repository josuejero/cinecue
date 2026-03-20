import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const projectRoot = process.cwd();
  const envPath = path.resolve(projectRoot, ".env");
  const examplePath = path.resolve(projectRoot, ".env.example");

  let configPath = envPath;

  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    configPath = examplePath;
    console.warn(".env missing; using .env.example as a fallback.");
  }

  dotenv.config({ path: configPath });

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  await pool.end();
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
