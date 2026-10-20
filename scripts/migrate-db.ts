import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[Database] DATABASE_URL is required before applying migrations");
  process.exit(1);
}

const db = drizzle(databaseUrl);

function getSafeErrorChain(error: unknown) {
  const chain: Array<Record<string, string | number | undefined>> = [];
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    const item = current as { name?: unknown; code?: unknown; errno?: unknown; sqlState?: unknown; cause?: unknown };
    chain.push({
      name: typeof item.name === "string" ? item.name : undefined,
      code: typeof item.code === "string" ? item.code : undefined,
      errno: typeof item.errno === "number" ? item.errno : undefined,
      sqlState: typeof item.sqlState === "string" ? item.sqlState : undefined,
    });
    current = item.cause;
  }

  return chain;
}

async function main() {
  try {
    console.log("[Database] Applying pending schema migrations");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[Database] Schema migrations complete");
  } catch (error) {
    console.error("[Database] Migration failed", { errorChain: getSafeErrorChain(error) });
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

void main();
