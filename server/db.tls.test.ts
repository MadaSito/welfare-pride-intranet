import { afterEach, describe, expect, it } from "vitest";
import { databaseConnectionOptions } from "./db";

const originalSsl = process.env.DATABASE_SSL;
const originalRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
const originalConnectionLimit = process.env.DATABASE_CONNECTION_LIMIT;

afterEach(() => {
  process.env.DATABASE_SSL = originalSsl;
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
  process.env.DATABASE_CONNECTION_LIMIT = originalConnectionLimit;
});

describe("databaseConnectionOptions", () => {
  it("retains the portable URL connection behavior unless TLS is explicitly enabled", () => {
    process.env.DATABASE_SSL = "false";
    expect(databaseConnectionOptions("mysql://owner:password@db.example.org:3306/welfare_pride")).toBe("mysql://owner:password@db.example.org:3306/welfare_pride");
  });

  it("creates a verified TLS pool configuration for Azure Database for MySQL", () => {
    process.env.DATABASE_SSL = "true";
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = "true";
    process.env.DATABASE_CONNECTION_LIMIT = "4";

    expect(databaseConnectionOptions("mysql://owner%40tenant:secret%21@db.example.org:3307/welfare_pride")).toMatchObject({
      host: "db.example.org",
      port: 3307,
      user: "owner@tenant",
      password: "secret!",
      database: "welfare_pride",
      connectionLimit: 4,
      ssl: { rejectUnauthorized: true },
    });
  });
});
