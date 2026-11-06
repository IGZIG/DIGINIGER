import { readFileSync } from "node:fs";
import pg from "pg";
for (const line of readFileSync("/home/user/diginiger/.env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const file = process.argv[2];
const sql = readFileSync(file, "utf8");
const c = new pg.Client({ host: process.env.SUPABASE_DB_HOST ?? "aws-0-eu-west-1.pooler.supabase.com", port: Number(process.env.SUPABASE_DB_PORT ?? 5432), user: "postgres.dthflsyrhhbpoiecajun", password: process.env.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(sql);
console.log("OK", file.split("/").pop());
await c.end();
