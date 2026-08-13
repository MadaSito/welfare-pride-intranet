import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to apply Welfare Pride migrations.");
  process.exit(1);
}

function migrationConnectionOptions(connectionString) {
  if (process.env.DATABASE_SSL?.toLowerCase() !== "true") return connectionString;
  const parsed = new URL(connectionString);
  if (parsed.protocol !== "mysql:" || !parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("DATABASE_URL must be a valid mysql:// URL when DATABASE_SSL=true.");
  }
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" },
  };
}

const connection = await mysql.createConnection(migrationConnectionOptions(databaseUrl));
try {
  const database = drizzle(connection);
  await migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("Welfare Pride database migrations are current.");
} finally {
  await connection.end();
}
