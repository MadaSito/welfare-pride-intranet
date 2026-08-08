import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to apply Welfare Pride migrations.");
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const database = drizzle(connection);
  await migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("Welfare Pride database migrations are current.");
} finally {
  await connection.end();
}
